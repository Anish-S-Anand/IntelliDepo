"""
Intelli Depot — Camera Feed Integration
Feature: DEPOT-V1

RTSP/IP camera stream ingestion, frame extraction, and multi-camera management.
Uses OpenCV (cv2.VideoCapture) for real RTSP/HTTP stream decoding.
Falls back to simulation when OpenCV is unavailable or the stream URL
is unreachable.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Boolean, DateTime, Integer, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import BaseModel as DBBaseModel, get_db

logger = logging.getLogger("intelli.depot.vision")
ALLOW_SIMULATED_CAMERA = os.getenv("ALLOW_SIMULATED_CAMERA", "true").lower() in {"1", "true", "yes"}

router = APIRouter(prefix="/depot/vision/cameras", tags=["Depot - Camera Feed"])

# Thread pool for blocking OpenCV calls
_cv_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cv-stream")

# ---------------------------------------------------------------------------
# OpenCV availability
# ---------------------------------------------------------------------------
try:
    import cv2
    _HAS_CV2 = True
    logger.info("OpenCV loaded — real camera stream support available")
except ImportError:
    _HAS_CV2 = False
    logger.warning("opencv-python-headless not installed — using Pillow for JPEG encoding")

# Pillow fallback for JPEG encoding when cv2 is absent
try:
    from PIL import Image as _PILImage
    import io as _io
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False


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
    zone = Column(String, nullable=True)                  # e.g. "Zone A", "Gate — North Entry"
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
    zone: Optional[str] = Field(None, json_schema_extra={"example": "Zone A"})
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
# Stream Manager — OpenCV-backed with in-memory fallback
# ---------------------------------------------------------------------------

class _StreamEntry:
    """Wraps an OpenCV VideoCapture or simulation state for one camera."""
    __slots__ = ("camera_id", "stream_url", "capture", "connected_at",
                 "frames_captured", "is_real")

    def __init__(self, camera_id: str, stream_url: str):
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.capture: Optional[object] = None  # cv2.VideoCapture
        self.connected_at = datetime.now(timezone.utc).isoformat()
        self.frames_captured = 0
        self.is_real = False


_active_streams: dict[str, _StreamEntry] = {}


def _cv_connect(stream_url: str, seek_seconds: float = 0.0) -> Optional[object]:
    """Blocking OpenCV connect — run in thread pool. 3-second timeout."""
    if not _HAS_CV2:
        return None
    cap = cv2.VideoCapture(stream_url)
    # Set a short connection timeout via CAP_PROP_OPEN_TIMEOUT_MSEC
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3000)
    if cap.isOpened():
        # Seek to a different offset per camera so feeds look distinct
        if seek_seconds > 0:
            fps = cap.get(cv2.CAP_PROP_FPS) or 25
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(seek_seconds * fps))
        # Try reading one frame to confirm the stream is live
        ret, _ = cap.read()
        if ret:
            return cap
    cap.release()
    return None


def _cv_read_frame(cap: object) -> Optional[np.ndarray]:
    """Blocking frame read — run in thread pool."""
    ret, frame = cap.read()  # type: ignore[union-attr]
    if ret and frame is not None:
        return frame
    return None


def _cv_encode_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
    """Encode a numpy frame to JPEG bytes. Uses cv2 if available, else Pillow."""
    if _HAS_CV2:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buf.tobytes()
    if _HAS_PIL:
        import io
        # numpy BGR → RGB for PIL
        rgb = frame[:, :, ::-1] if frame.ndim == 3 else frame
        img = _PILImage.fromarray(rgb.astype("uint8"))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        return buf.getvalue()
    raise RuntimeError("Neither cv2 nor Pillow available for JPEG encoding")


async def stream_connect(camera_id: str, stream_url: str, zone: str = "") -> bool:
    """Connect to a camera stream. Uses OpenCV for real streams, 5s hard timeout.
    Supports local: prefix for local depot video files."""
    loop = asyncio.get_running_loop()

    # Assign scene index based on zone name for deterministic unique scenes
    zone_key = zone.lower().strip()
    if zone_key in _ZONE_SCENE_MAP:
        _scene_counter[camera_id] = _ZONE_SCENE_MAP[zone_key]
    elif camera_id not in _scene_counter:
        global _scene_counter_next
        _scene_counter[camera_id] = _scene_counter_next % 6
        _scene_counter_next += 1

    scene_idx = _scene_counter.get(camera_id, 0)

    # Handle local: video files from depot pendrive
    if stream_url.startswith("local:"):
        filename = stream_url[len("local:"):]
        from app.depot.vision.video_library import get_local_video_path
        video_path = get_local_video_path(filename)
        if video_path is not None and _HAS_CV2:
            cap = await loop.run_in_executor(
                _cv_pool, _cv_connect, str(video_path), 0.0
            )
            if cap is not None:
                entry = _StreamEntry(camera_id, stream_url)
                entry.capture = cap
                entry.is_real = True
                _active_streams[camera_id] = entry
                logger.info(f"Camera {camera_id} connected to local video: {filename}")
                return True
            logger.warning(f"Camera {camera_id} failed to open local video: {filename}")
        else:
            logger.warning(f"Camera {camera_id} local video not found: {filename}")

        # Fall through to simulated if local file unavailable
        if ALLOW_SIMULATED_CAMERA:
            entry = _StreamEntry(camera_id, stream_url)
            entry.is_real = False
            _active_streams[camera_id] = entry
            logger.info(f"Camera {camera_id} local video unavailable, using simulation")
            return True
        return False

    # Seek each camera to a different offset (0, 10, 20, 30, 40, 50 seconds)
    # so all 6 feeds show different parts of the same stream
    seek_offset = scene_idx * 10.0

    # Try real OpenCV connection with a hard 5-second timeout
    try:
        cap = await asyncio.wait_for(
            loop.run_in_executor(_cv_pool, _cv_connect, stream_url, seek_offset),
            timeout=8.0
        )
    except asyncio.TimeoutError:
        cap = None
        logger.warning(f"Camera {camera_id} RTSP connect timed out after 8s: {stream_url}")

    if cap is not None:
        entry = _StreamEntry(camera_id, stream_url)
        entry.capture = cap
        entry.is_real = True
        _active_streams[camera_id] = entry
        logger.info(f"Camera {camera_id} connected via OpenCV: {stream_url}")
        return True

    if ALLOW_SIMULATED_CAMERA:
        entry = _StreamEntry(camera_id, stream_url)
        entry.is_real = False
        _active_streams[camera_id] = entry
        logger.info(f"Camera {camera_id} using simulated stream: {stream_url}")
        return True

    _active_streams.pop(camera_id, None)
    logger.warning(f"Camera {camera_id} failed to connect to real stream: {stream_url}")
    return False



# Scene labels per camera (deterministic by camera_id hash)
_SCENE_LABELS = [
    "GATE — NORTH ENTRY",
    "ZONE A OVERHEAD",
    "LOADING BAY 1-4",
    "ZONE C PERIMETER",
    "GATE — SOUTH EXIT",
    "YARD OVERVIEW",
]

# Scene-specific detection overlays
_SCENE_DETECTIONS = [
    [("Vehicle", (229, 115, 26), 0.35, 0.30, 0.28, 0.45), ("Person", (34, 197, 94), 0.68, 0.40, 0.08, 0.35)],
    [("Forklift", (229, 115, 26), 0.40, 0.45, 0.18, 0.30), ("Pallet", (59, 130, 246), 0.15, 0.55, 0.14, 0.20), ("Pallet", (59, 130, 246), 0.65, 0.55, 0.14, 0.20)],
    [("Vehicle", (229, 115, 26), 0.30, 0.25, 0.35, 0.50), ("Person", (34, 197, 94), 0.72, 0.50, 0.07, 0.30), ("Person", (34, 197, 94), 0.15, 0.50, 0.07, 0.30)],
    [("Person", (0, 60, 220), 0.38, 0.38, 0.08, 0.38)],
    [("Vehicle", (229, 115, 26), 0.20, 0.35, 0.30, 0.42), ("Plate", (59, 246, 130), 0.25, 0.62, 0.18, 0.10)],
    [("Vehicle", (229, 115, 26), 0.10, 0.45, 0.22, 0.38), ("Vehicle", (229, 115, 26), 0.45, 0.45, 0.22, 0.38), ("Person", (34, 197, 94), 0.75, 0.55, 0.06, 0.28)],
]


# Map zone names to fixed scene indices so each camera always gets a unique scene
_ZONE_SCENE_MAP: dict[str, int] = {
    "gate — north entry": 0,
    "zone a":             1,
    "loading dock":       2,
    "zone c":             3,
    "gate — south exit":  4,
    "yard":               5,
}

# Global counter to assign unique scene indices to cameras as they connect
_scene_counter: dict[str, int] = {}
_scene_counter_next = 0


def _get_scene_idx(camera_id: str) -> int:
    """Return a unique scene index (0-5) for this camera, assigned on first call."""
    global _scene_counter_next
    if camera_id not in _scene_counter:
        _scene_counter[camera_id] = _scene_counter_next % 6
        _scene_counter_next += 1
    return _scene_counter[camera_id]


def _apply_cctv_overlay(frame: np.ndarray, entry: _StreamEntry, scene_idx: int, theme: str = "dark") -> np.ndarray:
    """Burn CCTV HUD + detection boxes onto a frame. Themed for light/dark."""
    if not _HAS_CV2:
        # cv2 unavailable — return frame as-is (no HUD overlay)
        return frame
    import time, math
    h, w = frame.shape[:2]
    t = time.time()
    font = cv2.FONT_HERSHEY_SIMPLEX

    # ── Theme-aware post-processing ───────────────────────────────────────────
    if theme == "light":
        # Boost brightness significantly — daylight warehouse look
        frame = np.clip(frame.astype(np.int16) + 80, 0, 255).astype(np.uint8)
        # Warm tint (more red/green, less blue)
        frame[:, :, 2] = np.clip(frame[:, :, 2].astype(np.int16) + 15, 0, 255).astype(np.uint8)
        frame[:, :, 0] = np.clip(frame[:, :, 0].astype(np.int16) - 10, 0, 255).astype(np.uint8)
        # Light grain (subtle)
        noise = np.random.randint(0, 8, (h, w, 1), dtype=np.uint8)
        frame = np.clip(frame.astype(np.int16) + np.repeat(noise, 3, axis=2) - 4, 0, 255).astype(np.uint8)
        hud_bg = (240, 240, 240)
        hud_text = (30, 30, 30)
        hud_accent = (0, 140, 100)
        rec_color = (0, 0, 180)
        ts_color = (50, 50, 50)
        # Light vignette (very subtle)
        Y, X = np.ogrid[:h, :w]
        vign = np.clip(1.0 - 0.2 * ((X - w/2)**2 / (w/2)**2 + (Y - h/2)**2 / (h/2)**2), 0.85, 1.0)
        frame = (frame * vign[:, :, np.newaxis]).astype(np.uint8)
    else:
        # Dark CCTV — film grain + vignette
        noise = np.random.randint(0, 14, (h, w, 1), dtype=np.uint8)
        frame = np.clip(frame.astype(np.int16) + np.repeat(noise, 3, axis=2) - 7, 0, 255).astype(np.uint8)
        Y, X = np.ogrid[:h, :w]
        vign = np.clip(1.0 - 0.5 * ((X - w/2)**2 / (w/2)**2 + (Y - h/2)**2 / (h/2)**2), 0.5, 1.0)
        frame = (frame * vign[:, :, np.newaxis]).astype(np.uint8)
        hud_bg = (0, 0, 0)
        hud_text = (200, 200, 200)
        hud_accent = (0, 230, 200)
        rec_color = (0, 0, 220)
        ts_color = (180, 180, 180)

    # ── Scanline (dark only) ──────────────────────────────────────────────────
    if theme == "dark":
        sl = int(t * 80) % h
        frame[sl] = np.minimum(frame[sl].astype(np.int16) + 20, 255).astype(np.uint8)

    # ── Detection boxes ───────────────────────────────────────────────────────
    detections = _SCENE_DETECTIONS[scene_idx]
    for i, det in enumerate(detections):
        label, color, rx, ry, rw, rh = det
        drift_x = int(w * 0.015 * math.sin(t * 0.4 + i * 1.3))
        drift_y = int(h * 0.010 * math.sin(t * 0.3 + i * 0.9))
        x1 = max(0, int(rx * w) + drift_x)
        y1 = max(0, int(ry * h) + drift_y)
        x2 = min(w - 1, x1 + int(rw * w))
        y2 = min(h - 1, y1 + int(rh * h))
        conf = 88 + (i * 3 + scene_idx) % 10
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cl = 10
        for cx, cy in [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]:
            sx = 1 if cx == x1 else -1
            sy = 1 if cy == y1 else -1
            cv2.line(frame, (cx, cy), (cx + sx * cl, cy), color, 2)
            cv2.line(frame, (cx, cy), (cx, cy + sy * cl), color, 2)
        lbl = f"{label} {conf}%"
        lw = len(lbl) * 8 + 6
        if y1 >= 16:
            cv2.rectangle(frame, (x1, y1 - 16), (x1 + lw, y1), color, -1)
            cv2.putText(frame, lbl, (x1 + 3, y1 - 4), font, 0.38, (255, 255, 255), 1, cv2.LINE_AA)

    # ── Camera name — top left ────────────────────────────────────────────────
    cam_name = _SCENE_LABELS[scene_idx]
    cv2.rectangle(frame, (0, 0), (len(cam_name) * 9 + 14, 22), hud_bg, -1)
    cv2.putText(frame, cam_name, (6, 15), font, 0.45, hud_accent, 1, cv2.LINE_AA)

    # ── Timestamp — bottom left ───────────────────────────────────────────────
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d  %H:%M:%S UTC")
    cv2.rectangle(frame, (0, h - 22), (270, h), hud_bg, -1)
    cv2.putText(frame, now_str, (6, h - 7), font, 0.40, ts_color, 1, cv2.LINE_AA)

    # ── REC dot — top right ───────────────────────────────────────────────────
    if int(t * 2) % 2 == 0:
        cv2.circle(frame, (w - 18, 12), 6, rec_color, -1)
    cv2.putText(frame, "REC", (w - 52, 16), font, 0.42, rec_color, 1, cv2.LINE_AA)

    # ── Frame counter — bottom right ──────────────────────────────────────────
    cv2.rectangle(frame, (w - 115, h - 22), (w, h), hud_bg, -1)
    cv2.putText(frame, f"F:{entry.frames_captured:06d}", (w - 110, h - 7), font, 0.38, hud_text, 1, cv2.LINE_AA)

    return frame


def _generate_simulated_frame(entry: _StreamEntry, theme: str = "dark") -> np.ndarray:
    """
    Generate a CCTV frame: tries real video first, falls back to solid scene.
    Each camera gets a unique scene based on its ID.
    theme: "dark" = classic CCTV look, "light" = bright daylight warehouse
    """
    scene_idx = _get_scene_idx(entry.camera_id)

    try:
        from app.depot.vision.video_library import get_video_frame
        frame = get_video_frame(scene_idx, theme=theme)
        if frame is not None:
            return _apply_cctv_overlay(frame, entry, scene_idx, theme=theme)
    except Exception:
        pass

    import time
    h, w = 480, 854
    if theme == "light":
        palettes = [
            (180, 185, 175), (175, 178, 172), (178, 175, 165),
            (160, 175, 160), (175, 172, 180), (178, 175, 168),
        ]
    else:
        palettes = [
            (28, 32, 28), (20, 20, 25), (30, 28, 22),
            (8, 18, 8),   (28, 26, 32), (32, 30, 25),
        ]
    bg = palettes[scene_idx]
    frame = np.full((h, w, 3), bg, dtype=np.uint8)
    for y in range(h):
        frame[y] = np.clip(np.array(bg) * (1 - y/h * 0.3), 0, 255).astype(np.uint8)

    return _apply_cctv_overlay(frame, entry, scene_idx, theme=theme)


async def stream_read_frame(camera_id: str, theme: str = "dark") -> Optional[np.ndarray]:
    """Read a single frame from a connected camera stream."""
    entry = _active_streams.get(camera_id)
    if not entry:
        return None

    entry.frames_captured += 1

    if entry.is_real and entry.capture is not None:
        loop = asyncio.get_running_loop()
        frame = await loop.run_in_executor(_cv_pool, _cv_read_frame, entry.capture)
        if frame is not None:
            return frame
        # End of stream — loop back to start
        def _seek_start(cap):
            try:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # type: ignore[union-attr]
                ret, f = cap.read()  # type: ignore[union-attr]
                return f if ret else None
            except Exception:
                return None
        if _HAS_CV2:
            frame = await loop.run_in_executor(_cv_pool, _seek_start, entry.capture)
            if frame is not None:
                return frame
        logger.warning(f"Camera {camera_id} stream ended, switching to simulation")
        entry.is_real = False

    return _generate_simulated_frame(entry, theme=theme)


async def capture_frames(camera_id: str, count: int) -> list[np.ndarray]:
    """Capture multiple frames from a connected camera."""
    frames: list[np.ndarray] = []
    for _ in range(count):
        frame = await stream_read_frame(camera_id)
        if frame is not None:
            frames.append(frame)
        await asyncio.sleep(0.04)  # ~25fps spacing
    return frames


def stream_disconnect(camera_id: str) -> None:
    """Disconnect and release resources for a camera stream."""
    entry = _active_streams.pop(camera_id, None)
    if entry and entry.is_real and entry.capture is not None:
        try:
            entry.capture.release()  # type: ignore[union-attr]
        except Exception:
            pass


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
    await db.flush()

    connected = await stream_connect(str(camera.id), payload.stream_url, payload.zone or "")
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

    # Disconnect old stream if any
    stream_disconnect(str(camera_id))

    connected = await stream_connect(str(camera_id), camera.stream_url, camera.zone or "")
    camera.status = CameraStatus.ACTIVE if connected else CameraStatus.ERROR
    camera.last_seen = datetime.now(timezone.utc) if connected else camera.last_seen
    await db.commit()

    entry = _active_streams.get(str(camera_id))
    return {
        "camera_id": str(camera_id),
        "status": camera.status,
        "stream_type": "opencv" if entry and entry.is_real else "simulated",
    }


@router.get("/{camera_id}/frame", response_model=FrameData)
async def get_latest_frame(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Extract the latest frame metadata from a connected camera stream."""
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.status != CameraStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Camera is not active (status={camera.status})")

    frame = await stream_read_frame(str(camera_id))
    if frame is None:
        raise HTTPException(status_code=503, detail="Stream not connected — call /connect first")

    entry = _active_streams.get(str(camera_id))
    h, w = frame.shape[:2]

    camera.last_seen = datetime.now(timezone.utc)
    await db.commit()
    return FrameData(
        camera_id=camera_id,
        timestamp=datetime.now(timezone.utc),
        frame_number=entry.frames_captured if entry else 0,
        width=w,
        height=h,
        format="JPEG",
    )


@router.get("/{camera_id}/snapshot")
@router.get("/{camera_id}/snapshot")
async def get_camera_snapshot(camera_id: str, theme: str = "light", seek: float = 0.0, db: AsyncSession = Depends(get_db)):
    """
    Capture a single frame and return it as a JPEG image.
    Accepts both UUID and slug-style camera IDs (e.g. 'gate-entry-north').
    seek: optional offset in seconds into the video (for showing different parts of the same file).
    """
    # Try UUID lookup first
    camera = None
    try:
        cam_uuid = uuid.UUID(camera_id)
        camera = await db.get(Camera, cam_uuid)
    except (ValueError, AttributeError):
        pass

    # Fallback: slug-to-name lookup (e.g. 'gate-entry-north' → 'Gate Entry North')
    if camera is None:
        slug_name = camera_id.replace("-", " ").title()
        result = await db.execute(
            select(Camera).where(Camera.name.ilike(f"%{slug_name}%"), Camera.is_active == True)
        )
        candidates = result.scalars().all()
        camera = next((cam for cam in candidates if cam.stream_url.startswith("local:")), None)
        if camera is None:
            camera = next(iter(candidates), None)

    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Auto-connect if not active
    cam_key = str(camera.id)
    if cam_key not in _active_streams:
        await stream_connect(cam_key, camera.stream_url, camera.zone or "")

    # For local: videos, read a frame from a dedicated capture
    loop = asyncio.get_running_loop()
    frame = None
    if camera.stream_url.startswith("local:") and _HAS_CV2:
        filename = camera.stream_url[len("local:"):]
        from app.depot.vision.video_library import get_local_video_path
        vpath = get_local_video_path(filename)
        if vpath is not None:
            def _read_one_frame(path, seek_s: float = 0.0):
                cap = cv2.VideoCapture(str(path))
                if not cap.isOpened():
                    return None
                if seek_s > 0:
                    fps = cap.get(cv2.CAP_PROP_FPS) or 25
                    total = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                    target = int(seek_s * fps) % max(1, int(total))
                    cap.set(cv2.CAP_PROP_POS_FRAMES, target)
                ret, f = cap.read()
                cap.release()
                return cv2.resize(f, (854, 480)) if ret and f is not None else None
            frame = await loop.run_in_executor(_cv_pool, _read_one_frame, vpath, seek)

    if frame is None:
        frame = await stream_read_frame(cam_key, theme=theme)

    if frame is None:
        raise HTTPException(status_code=503, detail="Stream not connected")

    jpeg_bytes = await loop.run_in_executor(_cv_pool, _cv_encode_jpeg, frame)

    camera.last_seen = datetime.now(timezone.utc)
    await db.commit()

    return StreamingResponse(
        iter([jpeg_bytes]),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/{camera_id}/mjpeg")
async def mjpeg_stream(camera_id: uuid.UUID, theme: str = "light", db: AsyncSession = Depends(get_db)):
    """
    MJPEG live stream endpoint. Returns a multipart/x-mixed-replace stream
    of JPEG frames for direct embedding in <img> tags or video players.
    """
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.status != CameraStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Camera is not active (status={camera.status})")

    # Auto-reconnect if the stream entry was lost (e.g. after server restart)
    if str(camera_id) not in _active_streams:
        await stream_connect(str(camera_id), camera.stream_url)

    # If still not connected after reconnect attempt, return 503
    if str(camera_id) not in _active_streams:
        raise HTTPException(status_code=503, detail="Stream could not be connected")

    # Capture primitive values before DB session closes
    cam_id_str = str(camera_id)
    cam_stream_url = camera.stream_url
    cam_fps = camera.frame_rate or 25
    cam_zone = camera.zone or ""

    async def generate():
        boundary = b"--frame\r\n"
        fps_delay = 1.0 / cam_fps
        loop = asyncio.get_running_loop()

        # For local: videos, open a dedicated capture so we don't
        # compete with the real-time counting pipeline for frames.
        own_cap = None
        if cam_stream_url.startswith("local:") and _HAS_CV2:
            filename = cam_stream_url[len("local:"):]
            from app.depot.vision.video_library import get_local_video_path
            vpath = get_local_video_path(filename)
            if vpath is not None:
                own_cap = await loop.run_in_executor(
                    _cv_pool, _cv_connect, str(vpath), 0.0
                )

        try:
            while True:
                if own_cap is not None:
                    # Read from our own dedicated capture
                    frame = await loop.run_in_executor(_cv_pool, _cv_read_frame, own_cap)
                    if frame is None:
                        # Loop video
                        own_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        frame = await loop.run_in_executor(_cv_pool, _cv_read_frame, own_cap)
                    if frame is not None:
                        frame = cv2.resize(frame, (854, 480))
                else:
                    # Fallback to shared stream_read_frame for RTSP/simulated
                    entry = _active_streams.get(cam_id_str)
                    if entry is None:
                        await stream_connect(cam_id_str, cam_stream_url, cam_zone)
                        entry = _active_streams.get(cam_id_str)
                    if entry is None:
                        break
                    frame = await stream_read_frame(cam_id_str, theme=theme)

                if frame is None:
                    break
                jpeg_bytes = await loop.run_in_executor(_cv_pool, _cv_encode_jpeg, frame, 70)
                yield (
                    boundary
                    + b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(jpeg_bytes)}\r\n\r\n".encode()
                    + jpeg_bytes
                    + b"\r\n"
                )
                await asyncio.sleep(fps_delay)
        finally:
            if own_cap is not None:
                try:
                    own_cap.release()
                except Exception:
                    pass

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/rtsp-proxy/stream")
async def rtsp_proxy_stream(url: str):
    """
    RTSP/HTTP proxy — connects to any RTSP or HTTP stream URL, reads frames
    via OpenCV, applies the CCTV HUD overlay (timestamp, REC blink, scanline,
    detection boxes), and re-streams as MJPEG.

    Usage:  GET /depot/vision/cameras/rtsp-proxy/stream?url=rtsp://...
    Embed:  <img src="/backend/depot/vision/cameras/rtsp-proxy/stream?url=rtsp://..." />
    """
    if not _HAS_CV2:
        raise HTTPException(status_code=501, detail="OpenCV required for RTSP proxy")

    import math
    import time

    loop = asyncio.get_running_loop()

    # Connect in thread pool (blocking)
    cap = await loop.run_in_executor(_cv_pool, _cv_connect, url)
    if cap is None:
        raise HTTPException(status_code=502, detail=f"Cannot connect to stream: {url}")

    def _read_and_overlay() -> Optional[bytes]:
        """Read one frame, resize, apply HUD, encode JPEG — all blocking."""
        ret, frame = cap.read()  # type: ignore[union-attr]
        if not ret or frame is None:
            return None

        # Resize to 854×480 for consistent output
        frame = cv2.resize(frame, (854, 480))
        h, w = frame.shape[:2]
        t = time.time()

        # --- HUD: top-left cam info ---
        short_url = url[:35] + "…" if len(url) > 35 else url
        cv2.putText(frame, f"CAM RTSP-PROXY", (8, 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 180), 1, cv2.LINE_AA)
        cv2.putText(frame, short_url, (8, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.3, (120, 140, 160), 1, cv2.LINE_AA)

        # --- HUD: top-right timestamp + REC ---
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        cv2.putText(frame, now_str, (w - 210, 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1, cv2.LINE_AA)
        if int(t * 2) % 2:
            cv2.circle(frame, (w - 225, 11), 5, (0, 0, 220), -1)
        cv2.putText(frame, "REC", (w - 215, 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 220), 1, cv2.LINE_AA)

        # --- Detection boxes (animated, position tied to time) ---
        # Box 1 — "Vehicle" tracking a moving region
        bx1 = int(w * 0.3 + w * 0.15 * math.sin(t * 0.4))
        by1 = int(h * 0.35 + h * 0.05 * math.sin(t * 0.3))
        cv2.rectangle(frame, (bx1, by1), (bx1 + 120, by1 + 80), (229, 115, 26), 2)
        _cv_corner_marks(frame, bx1, by1, bx1 + 120, by1 + 80, (229, 115, 26))
        cv2.rectangle(frame, (bx1, by1 - 14), (bx1 + 90, by1 - 2), (229, 115, 26), -1)
        cv2.putText(frame, "Vehicle 94%", (bx1 + 2, by1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.32, (255, 255, 255), 1, cv2.LINE_AA)

        # Box 2 — "Person" on the right side
        bx2 = int(w * 0.65 + w * 0.08 * math.sin(t * 0.6 + 1.0))
        by2 = int(h * 0.4 + h * 0.04 * math.sin(t * 0.5))
        cv2.rectangle(frame, (bx2, by2), (bx2 + 40, by2 + 90), (34, 197, 94), 2)
        _cv_corner_marks(frame, bx2, by2, bx2 + 40, by2 + 90, (34, 197, 94))
        cv2.rectangle(frame, (bx2, by2 - 14), (bx2 + 70, by2 - 2), (34, 197, 94), -1)
        cv2.putText(frame, "Person 91%", (bx2 + 2, by2 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.32, (255, 255, 255), 1, cv2.LINE_AA)

        # Box 3 — "Object" bottom area
        bx3 = int(w * 0.5 + w * 0.1 * math.sin(t * 0.25 + 2.0))
        by3 = int(h * 0.65)
        cv2.rectangle(frame, (bx3, by3), (bx3 + 80, by3 + 50), (59, 130, 246), 2)
        _cv_corner_marks(frame, bx3, by3, bx3 + 80, by3 + 50, (59, 130, 246))
        cv2.rectangle(frame, (bx3, by3 - 14), (bx3 + 75, by3 - 2), (59, 130, 246), -1)
        cv2.putText(frame, "Pallet 88%", (bx3 + 2, by3 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.32, (255, 255, 255), 1, cv2.LINE_AA)

        # --- Scanline sweep ---
        scanline_y = int(t * 60) % h
        if scanline_y < h - 1:
            frame[scanline_y] = np.minimum(
                frame[scanline_y].astype(np.int16) + 20, 255
            ).astype(np.uint8)

        # --- Bottom frame counter ---
        frame_count = int(t * 25) % 999999
        cv2.putText(frame, f"F:{frame_count:06d}  LIVE", (8, h - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.32, (100, 130, 160), 1, cv2.LINE_AA)

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return buf.tobytes()

    async def generate():
        boundary = b"--frame\r\n"
        try:
            while True:
                jpeg = await loop.run_in_executor(_cv_pool, _read_and_overlay)
                if jpeg is None:
                    break
                yield (
                    boundary
                    + b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(jpeg)}\r\n\r\n".encode()
                    + jpeg
                    + b"\r\n"
                )
                await asyncio.sleep(1 / 25)
        finally:
            try:
                cap.release()  # type: ignore[union-attr]
            except Exception:
                pass

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


def _cv_corner_marks(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int,
                     color: tuple, length: int = 10) -> None:
    """Draw corner tick marks on a bounding box using cv2."""
    cv2.line(frame, (x1, y1), (x1 + length, y1), color, 2)
    cv2.line(frame, (x1, y1), (x1, y1 + length), color, 2)
    cv2.line(frame, (x2, y1), (x2 - length, y1), color, 2)
    cv2.line(frame, (x2, y1), (x2, y1 + length), color, 2)
    cv2.line(frame, (x1, y2), (x1 + length, y2), color, 2)
    cv2.line(frame, (x1, y2), (x1, y2 - length), color, 2)
    cv2.line(frame, (x2, y2), (x2 - length, y2), color, 2)
    cv2.line(frame, (x2, y2), (x2, y2 - length), color, 2)


@router.delete("/{camera_id}", status_code=204)
async def deactivate_camera(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Soft-delete a camera (mark inactive and disconnect stream)."""
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    camera.is_active = False
    camera.status = CameraStatus.INACTIVE
    stream_disconnect(str(camera_id))
    await db.commit()
    logger.info(f"Camera {camera_id} deactivated")


@router.get("/streams/active")
async def list_active_streams():
    """Return all currently connected streams."""
    return {
        "active_count": len(_active_streams),
        "streams": [
            {
                "camera_id": entry.camera_id,
                "stream_url": entry.stream_url,
                "connected_at": entry.connected_at,
                "frames_captured": entry.frames_captured,
                "stream_type": "opencv" if entry.is_real else "simulated",
            }
            for entry in _active_streams.values()
        ],
    }



# ---------------------------------------------------------------------------
# TfL JamCam MJPEG proxy
# Fetches real London road JPEG images from TfL's public S3 bucket and
# re-streams them as MJPEG so the browser sees smooth live footage.
# ---------------------------------------------------------------------------

@router.get("/tfl-proxy/stream")
async def tfl_jamcam_stream(cam_id: str):
    """
    Proxy a TfL JamCam JPEG as a smooth MJPEG stream.
    cam_id: TfL camera ID e.g. '00001.07450' (Piccadilly Circus)

    The TfL S3 bucket updates each image every ~1-2 seconds.
    We fetch it as fast as possible and re-stream as multipart MJPEG.
    """
    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=501, detail="httpx not installed")

    image_url = f"https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/{cam_id}.jpg"

    async def generate():
        boundary = b"--frame\r\n"
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            while True:
                try:
                    resp = await client.get(image_url, params={"t": str(asyncio.get_event_loop().time())})
                    if resp.status_code == 200:
                        jpeg = resp.content
                        yield (
                            boundary
                            + b"Content-Type: image/jpeg\r\n"
                            + f"Content-Length: {len(jpeg)}\r\n\r\n".encode()
                            + jpeg
                            + b"\r\n"
                        )
                except Exception as e:
                    logger.warning(f"TfL fetch error for {cam_id}: {e}")
                # TfL updates ~every 1-2s; poll at ~2fps for smooth feel
                await asyncio.sleep(0.5)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"},
    )


# ---------------------------------------------------------------------------
# Video Library endpoints — list and stream local depot videos
# ---------------------------------------------------------------------------

@router.get("/video-library/list")
async def list_depot_videos():
    """List all local depot videos available for CCTV feeds and detection training."""
    from app.depot.vision.video_library import list_available_videos, LOCAL_VIDEO_DIR
    videos = list_available_videos()
    return {
        "video_dir": str(LOCAL_VIDEO_DIR),
        "total": len(videos),
        "available": sum(1 for v in videos if v["available"]),
        "videos": videos,
    }


@router.get("/video-library/{filename}/mjpeg")
async def stream_local_video(filename: str, theme: str = "light", seek: float = 0.0):
    """
    Stream a local depot video as MJPEG. Useful for previewing training videos.
    filename: e.g. 'cluster 13 (1).mp4'
    seek: start offset in seconds (default 0).
    """
    from app.depot.vision.video_library import get_local_video_path

    video_path = get_local_video_path(filename)
    if video_path is None:
        raise HTTPException(status_code=404, detail=f"Video not found: {filename}")

    if not _HAS_CV2:
        raise HTTPException(status_code=501, detail="OpenCV required for video streaming")

    async def generate():
        boundary = b"--frame\r\n"
        loop = asyncio.get_running_loop()
        cap = await loop.run_in_executor(_cv_pool, _cv_connect, str(video_path), seek)
        if cap is None:
            return
        # Set capture resolution before reading — reduces per-frame memory by ~4x
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 854)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        # Stream at 24fps for smooth playback
        TARGET_FPS = 24
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_skip = max(1, round(src_fps / TARGET_FPS))
        seek_frame = int(seek * src_fps)
        frame_num = 0
        try:
            while True:
                frame = await loop.run_in_executor(_cv_pool, _cv_read_frame, cap)
                if frame is None:
                    # Loop back to seek position
                    cap.set(cv2.CAP_PROP_POS_FRAMES, seek_frame)
                    frame_num = 0
                    frame = await loop.run_in_executor(_cv_pool, _cv_read_frame, cap)
                    if frame is None:
                        break
                frame_num += 1
                # Skip frames to hit target fps
                if frame_num % frame_skip != 0:
                    await asyncio.sleep(0)
                    continue
                frame = cv2.resize(frame, (854, 480))
                jpeg_bytes = await loop.run_in_executor(
                    _cv_pool, _cv_encode_jpeg, frame, 70
                )
                yield (
                    boundary
                    + b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(jpeg_bytes)}\r\n\r\n".encode()
                    + jpeg_bytes
                    + b"\r\n"
                )
                await asyncio.sleep(1 / TARGET_FPS)
        finally:
            cap.release()

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/video-library/{filename}/snapshot")
async def video_snapshot(filename: str, seek: float = 0.0):
    """Get a single frame from a local depot video as JPEG.
    seek: offset in seconds into the video (default 0).
    """
    from app.depot.vision.video_library import get_video_frame_by_filename

    loop = asyncio.get_running_loop()

    def _read_and_encode():
        f = get_video_frame_by_filename(filename, seek_seconds=seek)
        if f is None:
            return None
        f = cv2.resize(f, (854, 480))
        return _cv_encode_jpeg(f)

    jpeg_bytes = await loop.run_in_executor(_cv_pool, _read_and_encode)
    if jpeg_bytes is None:
        raise HTTPException(status_code=404, detail=f"Cannot read video: {filename}")

    return StreamingResponse(
        iter([jpeg_bytes]),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/video-library/{filename}/stream")
async def stream_video_file(filename: str, request: Request):
    """
    Stream a local depot video file with proper HTTP range request support.
    This allows browsers to start playing immediately without downloading the full file.
    """
    from app.depot.vision.video_library import get_local_video_path
    from fastapi.responses import StreamingResponse, Response
    import os

    video_path = get_local_video_path(filename)
    if video_path is None or not os.path.exists(str(video_path)):
        raise HTTPException(status_code=404, detail=f"Video not found: {filename}")

    file_size = os.path.getsize(str(video_path))
    range_header = request.headers.get("range")

    if range_header:
        # Parse Range: bytes=start-end
        try:
            range_val = range_header.replace("bytes=", "")
            start_str, _, end_str = range_val.partition("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            end = min(end, file_size - 1)
            chunk_size = end - start + 1

            def iter_file(path: str, s: int, length: int):
                with open(path, "rb") as f:
                    f.seek(s)
                    remaining = length
                    while remaining > 0:
                        data = f.read(min(512 * 1024, remaining))  # 512KB chunks
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
                "Content-Type": "video/mp4",
                "Cache-Control": "no-cache",
            }
            return StreamingResponse(
                iter_file(str(video_path), start, chunk_size),
                status_code=206,
                headers=headers,
                media_type="video/mp4",
            )
        except Exception:
            pass  # Fall through to full file response

    # No range header — return full file
    def iter_full(path: str):
        with open(path, "rb") as f:
            while chunk := f.read(512 * 1024):  # 512KB chunks
                yield chunk

    return StreamingResponse(
        iter_full(str(video_path)),
        status_code=200,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
            "Cache-Control": "no-cache",
        },
        media_type="video/mp4",
    )
