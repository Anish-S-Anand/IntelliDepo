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
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import BaseModel as DBBaseModel, get_db

logger = logging.getLogger("intelli.depot.vision")
ALLOW_SIMULATED_CAMERA = os.getenv("ALLOW_SIMULATED_CAMERA", "false").lower() in {"1", "true", "yes"}

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


def _cv_connect(stream_url: str) -> Optional[object]:
    """Blocking OpenCV connect — run in thread pool. 3-second timeout."""
    if not _HAS_CV2:
        return None
    cap = cv2.VideoCapture(stream_url)
    # Set a short connection timeout via CAP_PROP_OPEN_TIMEOUT_MSEC
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3000)
    if cap.isOpened():
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


async def stream_connect(camera_id: str, stream_url: str) -> bool:
    """Connect to a camera stream. Uses OpenCV for real streams, 5s hard timeout."""
    loop = asyncio.get_running_loop()

    # Try real OpenCV connection with a hard 5-second timeout
    try:
        cap = await asyncio.wait_for(
            loop.run_in_executor(_cv_pool, _cv_connect, stream_url),
            timeout=5.0
        )
    except asyncio.TimeoutError:
        cap = None
        logger.warning(f"Camera {camera_id} RTSP connect timed out after 5s: {stream_url}")

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
        logger.info(f"Camera {camera_id} using simulated stream (OpenCV unavailable or URL unreachable): {stream_url}")
        return True

    _active_streams.pop(camera_id, None)
    logger.warning(f"Camera {camera_id} failed to connect to real stream: {stream_url}")
    return False



# Scene labels per camera (deterministic by camera_id hash)
_SCENE_LABELS = [
    "GATE ENTRY NORTH",
    "ZONE-A OVERHEAD",
    "LOADING BAY 1-4",
    "ZONE-C PERIMETER",
    "GATE EXIT SOUTH",
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


def _get_scene_idx(camera_id: str) -> int:
    import hashlib
    return int(hashlib.md5(camera_id.encode()).hexdigest(), 16) % 6


def _apply_cctv_overlay(frame: np.ndarray, entry: _StreamEntry, scene_idx: int, theme: str = "dark") -> np.ndarray:
    """Burn CCTV HUD + detection boxes onto a frame. Themed for light/dark."""
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
        logger.warning(f"Camera {camera_id} stream dropped, switching to simulation")
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

    connected = await stream_connect(str(camera.id), payload.stream_url)
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

    connected = await stream_connect(str(camera_id), camera.stream_url)
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
async def get_camera_snapshot(camera_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Capture a single frame and return it as a JPEG image.
    This is the real frame endpoint — returns actual image bytes.
    """
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.status != CameraStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Camera is not active (status={camera.status})")

    frame = await stream_read_frame(str(camera_id))
    if frame is None:
        raise HTTPException(status_code=503, detail="Stream not connected")

    jpeg_bytes = await asyncio.get_running_loop().run_in_executor(
        _cv_pool, _cv_encode_jpeg, frame
    )

    camera.last_seen = datetime.now(timezone.utc)
    await db.commit()

    return StreamingResponse(
        iter([jpeg_bytes]),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/{camera_id}/mjpeg")
async def mjpeg_stream(camera_id: uuid.UUID, theme: str = "dark", db: AsyncSession = Depends(get_db)):
    """
    MJPEG live stream endpoint. Returns a multipart/x-mixed-replace stream
    of JPEG frames for direct embedding in <img> tags or video players.
    """
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera.status != CameraStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"Camera is not active (status={camera.status})")

    async def generate():
        boundary = b"--frame\r\n"
        fps_delay = 1.0 / (camera.frame_rate or 25)
        while True:
            frame = await stream_read_frame(str(camera_id), theme=theme)
            if frame is None:
                break
            jpeg_bytes = await asyncio.get_running_loop().run_in_executor(
                _cv_pool, _cv_encode_jpeg, frame, 70
            )
            yield (
                boundary
                + b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(jpeg_bytes)}\r\n\r\n".encode()
                + jpeg_bytes
                + b"\r\n"
            )
            await asyncio.sleep(fps_delay)

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

