"""
Intelli Depot — Camera Feed Integration
Feature: DEPOT-V1

RTSP/IP camera stream ingestion, frame extraction, and multi-camera management.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import BaseModel as DBBaseModel, get_db

logger = logging.getLogger("intelli.depot.vision")

router = APIRouter(prefix="/depot/vision/cameras", tags=["Depot - Camera Feed"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CameraStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    CONNECTING = "connecting"


class StreamProtocol(str, Enum):
    RTSP = "rtsp"
    HTTP = "http"
    HTTPS = "https"


# ---------------------------------------------------------------------------
# Database Model
# ---------------------------------------------------------------------------

class Camera(DBBaseModel):
    """Represents a registered camera in the warehouse."""
    __tablename__ = "depot_cameras"

    name = Column(String, nullable=False)
    stream_url = Column(String, nullable=False)           # e.g. rtsp://192.168.1.10:554/stream
    protocol = Column(String, default=StreamProtocol.RTSP)
    zone = Column(String, nullable=True)                  # e.g. "Zone-A", "Entry Gate"
    status = Column(String, default=CameraStatus.INACTIVE)
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    frame_rate = Column(Integer, default=25)              # FPS
    resolution = Column(String, default="1920x1080")


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class CameraRegister(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Gate-A Camera 1"})
    stream_url: str = Field(..., json_schema_extra={"example": "rtsp://192.168.1.10:554/stream1"})
    protocol: StreamProtocol = StreamProtocol.RTSP
    zone: Optional[str] = Field(None, json_schema_extra={"example": "Zone-A"})
    frame_rate: int = Field(25, ge=1, le=60)
    resolution: str = Field("1920x1080", json_schema_extra={"example": "1920x1080"})


class CameraResponse(BaseModel):
    id: uuid.UUID
    name: str
    stream_url: str
    protocol: str
    zone: Optional[str]
    status: str
    is_active: bool
    last_seen: Optional[datetime]
    frame_rate: int
    resolution: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FrameData(BaseModel):
    camera_id: uuid.UUID
    timestamp: datetime
    frame_number: int
    width: int
    height: int
    format: str = "JPEG"


# ---------------------------------------------------------------------------
# In-Memory Stream Registry (simulates live connection tracking)
# ---------------------------------------------------------------------------

_active_streams: dict[str, dict] = {}   # camera_id -> stream metadata


async def _simulate_stream_connect(camera_id: str, stream_url: str) -> bool:
    """
    Simulate connecting to a camera stream.
    In production: use OpenCV (cv2.VideoCapture) or aiortsp for real RTSP.
    """
    await asyncio.sleep(0.1)   # simulate network handshake
    _active_streams[camera_id] = {
        "stream_url": stream_url,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "frames_captured": 0,
    }
    logger.info(f"Camera {camera_id} stream connected: {stream_url}")
    return True


async def _simulate_frame_extract(camera_id: str) -> Optional[FrameData]:
    """
    Simulate extracting the latest frame from a stream.
    In production: call cv2.VideoCapture.read() or decode RTSP frame.
    """
    if camera_id not in _active_streams:
        return None

    _active_streams[camera_id]["frames_captured"] += 1
    return FrameData(
        camera_id=uuid.UUID(camera_id),
        timestamp=datetime.now(timezone.utc),
        frame_number=_active_streams[camera_id]["frames_captured"],
        width=1920,
        height=1080,
        format="JPEG",
    )


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=CameraResponse, status_code=201)
async def register_camera(payload: CameraRegister, db: AsyncSession = Depends(get_db)):
    """Register a new camera and attempt to connect to its stream."""
    camera = Camera(
        name=payload.name,
        stream_url=payload.stream_url,
        protocol=payload.protocol,
        zone=payload.zone,
        frame_rate=payload.frame_rate,
        resolution=payload.resolution,
        status=CameraStatus.CONNECTING,
    )
    db.add(camera)
    await db.flush()   # get the UUID before commit

    connected = await _simulate_stream_connect(str(camera.id), payload.stream_url)
    camera.status = CameraStatus.ACTIVE if connected else CameraStatus.ERROR
    camera.last_seen = datetime.now(timezone.utc) if connected else None

    await db.commit()
    await db.refresh(camera)
    logger.info(f"Registered camera '{camera.name}' (id={camera.id}), status={camera.status}")
    return camera


@router.get("/", response_model=list[CameraResponse])
async def list_cameras(zone: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """List all registered cameras, optionally filtered by zone."""
    from sqlalchemy import select
    query = select(Camera).where(Camera.is_active == True)
    if zone:
        query = query.where(Camera.zone == zone)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get details of a specific camera."""
    camera = await db.get(Camera, camera_id)
    if not camera or not camera.is_active:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.post("/{camera_id}/connect")
async def connect_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Connect (or reconnect) a camera stream."""
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera.status = CameraStatus.CONNECTING
    await db.commit()

    connected = await _simulate_stream_connect(str(camera_id), camera.stream_url)
    camera.status = CameraStatus.ACTIVE if connected else CameraStatus.ERROR
    camera.last_seen = datetime.now(timezone.utc) if connected else camera.last_seen
    await db.commit()

    return {"camera_id": str(camera_id), "status": camera.status}


@router.get("/{camera_id}/frame", response_model=FrameData)
async def get_latest_frame(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Extract the latest frame from a connected camera stream."""
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.status != CameraStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Camera is not active (status={camera.status})")

    frame = await _simulate_frame_extract(str(camera_id))
    if not frame:
        raise HTTPException(status_code=503, detail="Stream not connected — call /connect first")

    camera.last_seen = datetime.now(timezone.utc)
    await db.commit()
    return frame


@router.delete("/{camera_id}", status_code=204)
async def deactivate_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Soft-delete a camera (mark inactive and disconnect stream)."""
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera.is_active = False
    camera.status = CameraStatus.INACTIVE
    _active_streams.pop(str(camera_id), None)
    await db.commit()
    logger.info(f"Camera {camera_id} deactivated")


@router.get("/streams/active")
async def list_active_streams():
    """Return all currently connected streams (in-memory registry)."""
    return {
        "active_count": len(_active_streams),
        "streams": [
            {"camera_id": cid, **meta}
            for cid, meta in _active_streams.items()
        ],
    }
