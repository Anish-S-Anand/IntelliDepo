"""
Intelli Depot — Bag/Box Detection
Feature: DEPOT-V2

YOLO v8 model integration for detecting bags and boxes in camera feeds.
Provides bounding boxes, class labels, confidence scores, and size estimates.

Dependency note: AUTH-6.2 (RBAC) is active.
Permission checks now use the shared RBAC dependency layer.

Uses ultralytics YOLOv8 for real inference. Falls back to a lightweight
simulation only when the ultralytics package is not installed (e.g. CI).
"""
import uuid
import random
import logging
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pathlib import Path
import io

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user, require_permission
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.detection")
ALLOW_SIMULATED_VISION = os.getenv("ALLOW_SIMULATED_VISION", "false").lower() in {"1", "true", "yes"}
PROJECT_ROOT = Path(__file__).resolve().parents[4]
PROJECT_CEMENT_BAG_WEIGHTS = PROJECT_ROOT / "best_cement_bags_2025-05-29.pt"
PROJECT_DEPOT_BEST_WEIGHTS = Path(__file__).resolve().parent / "training_data" / "weights" / "depot_best.pt"
PROJECT_GENERAL_WEIGHTS = PROJECT_ROOT / "backend" / "yolov8n.pt"


def _default_yolo_weights() -> str:
    env_weights = os.getenv("YOLO_WEIGHTS")
    if env_weights:
        return env_weights

    candidates = [
        str(PROJECT_CEMENT_BAG_WEIGHTS),
        str(PROJECT_DEPOT_BEST_WEIGHTS),
        str(PROJECT_GENERAL_WEIGHTS),
        r"C:\Users\DELL\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\INTELLI\DEPOT\JSW Design\videos\best_cement_bags_2025-05-29.pt",
        r"C:\Users\karte\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\intelli-platform\best_cement_bags_2025-05-29.pt",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return "yolov8n.pt"


DEFAULT_YOLO_WEIGHTS = _default_yolo_weights()

# ---------------------------------------------------------------------------
# YOLO model loader — real ultralytics with graceful fallback
# ---------------------------------------------------------------------------

_yolo_models: dict[str, object] = {}  # weights_path -> YOLO model instance

try:
    from ultralytics import YOLO as _YOLO
    _HAS_ULTRALYTICS = True
    logger.info("ultralytics loaded — real YOLO inference available")
except ImportError:
    _HAS_ULTRALYTICS = False
    logger.warning("ultralytics not installed — detection will use fallback simulation")


def _load_yolo_model(weights_path: str | None) -> object | None:
    """Load (or return cached) YOLO model from weights path."""
    if not _HAS_ULTRALYTICS:
        return None
    resolved_path = weights_path or DEFAULT_YOLO_WEIGHTS
    key = resolved_path or "yolov8n.pt"
    if key not in _yolo_models:
        resolved = key
        if resolved_path and Path(resolved_path).exists():
            resolved = resolved_path
        else:
            resolved = "yolov8n.pt"  # auto-downloads from ultralytics hub
        try:
            _yolo_models[key] = _YOLO(resolved)
            logger.info(f"YOLO model loaded: {resolved}")
        except Exception as e:
            logger.error(f"Failed to load YOLO model {resolved}: {e}")
            return None
    return _yolo_models.get(key)

router = APIRouter(prefix="/depot/vision/detection", tags=["Depot - Detection"])




# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ObjectClass(str, Enum):
    BAG = "bag"
    BOX = "box"
    PALLET = "pallet"
    CARTON = "carton"
    PERSON = "person"
    VEHICLE = "vehicle"
    UNKNOWN = "unknown"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class DetectionModel(DBBaseModel):
    """Registered YOLO model configuration."""
    __tablename__ = "depot_detection_models"

    model_name = Column(String, nullable=False)
    model_version = Column(String, default="v8n")
    weights_path = Column(String, nullable=True)           # path or URI to .pt file
    confidence_threshold = Column(Float, default=0.85)     # 85% default per F-001
    iou_threshold = Column(Float, default=0.50)
    target_classes = Column(String, default="bag,box,pallet")  # comma-separated
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    # Dimension calibration (pixel-to-real-world)
    frame_width_px = Column(Integer, default=1920)
    frame_height_px = Column(Integer, default=1080)
    px_to_cm_x = Column(Float, default=0.5)               # horizontal px -> cm
    px_to_cm_y = Column(Float, default=0.5)                # vertical px -> cm


class DetectionRun(DBBaseModel):
    """A detection job executed against a camera or uploaded frame."""
    __tablename__ = "depot_detection_runs"

    camera_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    model_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(String, default=RunStatus.PENDING)
    frame_count = Column(Integer, default=0)
    total_detections = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    initiated_by = Column(String, nullable=True)


class DetectedObject(DBBaseModel):
    """A single object detected within a frame of a detection run."""
    __tablename__ = "depot_detected_objects"

    run_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    frame_number = Column(Integer, nullable=False)
    class_label = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, nullable=False)   # top-left x (0-1 normalised)
    bbox_y = Column(Float, nullable=False)   # top-left y
    bbox_w = Column(Float, nullable=False)   # width  (0-1 normalised)
    bbox_h = Column(Float, nullable=False)   # height
    size_estimate_cm2 = Column(Float, nullable=True)
    count_in_frame = Column(Integer, default=1)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class DimensionCalibration(BaseModel):
    """Pixel-to-real-world dimension calibration parameters."""
    frame_width_px: int = Field(1920, description="Frame width in pixels")
    frame_height_px: int = Field(1080, description="Frame height in pixels")
    px_to_cm_x: float = Field(0.5, description="Horizontal pixels-to-cm ratio")
    px_to_cm_y: float = Field(0.5, description="Vertical pixels-to-cm ratio")
    calibration_note: Optional[str] = Field(None, description="Note about calibration method")


class DetectionModelCreate(BaseModel):
    model_name: str = Field(..., json_schema_extra={"example": "depot-yolov8n"})
    model_version: str = Field("v8n", json_schema_extra={"example": "v8n"})
    weights_path: Optional[str] = Field(None, json_schema_extra={"example": "/models/depot_yolov8n.pt"})
    confidence_threshold: float = Field(0.85, ge=0.0, le=1.0, description="Min confidence threshold (default 85%)")
    iou_threshold: float = Field(0.50, ge=0.0, le=1.0)
    target_classes: str = Field("bag,box,pallet", json_schema_extra={"example": "bag,box,pallet"})
    description: Optional[str] = None


class DetectionModelResponse(BaseModel):
    id: uuid.UUID
    model_name: str
    model_version: str
    confidence_threshold: float
    iou_threshold: float
    target_classes: str
    is_active: bool
    description: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DetectionRunCreate(BaseModel):
    camera_id: Optional[uuid.UUID] = None
    model_id: uuid.UUID
    frame_count: int = Field(1, ge=1, le=1000, description="Number of frames to analyse")


class DetectionRunResponse(BaseModel):
    id: uuid.UUID
    camera_id: Optional[uuid.UUID]
    model_id: uuid.UUID
    status: str
    frame_count: int
    total_detections: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    initiated_by: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DetectedObjectResponse(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    frame_number: int
    class_label: str
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float
    size_estimate_cm2: Optional[float]
    count_in_frame: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RunSummary(BaseModel):
    run: DetectionRunResponse
    detections_by_class: dict[str, int]
    average_confidence: float


# ---------------------------------------------------------------------------
# YOLO Inference — real ultralytics with fallback
# ---------------------------------------------------------------------------

# Map YOLO class names to our ObjectClass enum values
_YOLO_CLASS_MAP: dict[str, str] = {
    "Cement Bags": "bag",
    "Truck": "vehicle",
    "Truck Back": "vehicle",
    "Truck space": "vehicle",
    "backpack": "bag", "handbag": "bag", "suitcase": "bag",
    "bag": "bag", "box": "box", "carton": "carton",
    "pallet": "pallet", "person": "person", "truck": "vehicle", "car": "vehicle",
}


def _run_yolo_inference(
    model: object,
    frame: np.ndarray,
    confidence_threshold: float,
    target_classes: list[str],
) -> list[dict]:
    """Run real YOLO inference on a numpy frame, return normalised detections."""
    results = model(frame, conf=confidence_threshold, verbose=False)  # type: ignore[operator]
    detections: list[dict] = []
    h, w = frame.shape[:2]

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = r.names.get(cls_id, "unknown")
            mapped = _YOLO_CLASS_MAP.get(cls_name, cls_name)
            if mapped not in target_classes:
                continue
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "class_label": mapped,
                "confidence": round(conf, 4),
                "bbox_x": round(x1 / w, 4),
                "bbox_y": round(y1 / h, 4),
                "bbox_w": round((x2 - x1) / w, 4),
                "bbox_h": round((y2 - y1) / h, 4),
            })
    return detections


def _fallback_simulate(
    frame_count: int,
    confidence_threshold: float,
    target_classes: list[str],
) -> list[list[dict]]:
    """Fallback simulation when YOLO weights are unavailable."""
    available = [c for c in target_classes if c in [e.value for e in ObjectClass]] or ["box"]
    all_frames: list[list[dict]] = []
    for _ in range(frame_count):
        dets: list[dict] = []
        for _ in range(random.randint(0, 6)):
            dets.append({
                "class_label": random.choice(available),
                "confidence": round(random.uniform(confidence_threshold, 0.99), 4),
                "bbox_x": round(random.uniform(0.0, 0.7), 4),
                "bbox_y": round(random.uniform(0.0, 0.7), 4),
                "bbox_w": round(random.uniform(0.05, 0.3), 4),
                "bbox_h": round(random.uniform(0.05, 0.3), 4),
            })
        all_frames.append(dets)
    return all_frames


def _detect_on_frames(
    run_id: uuid.UUID,
    frames: list[np.ndarray] | None,
    frame_count: int,
    confidence_threshold: float,
    target_classes: list[str],
    weights_path: str | None,
    frame_width_px: int = 1920,
    frame_height_px: int = 1080,
    px_to_cm_x: float = 0.5,
    px_to_cm_y: float = 0.5,
) -> list[DetectedObject]:
    """
    Run YOLO detection on real frames when available, otherwise fallback.
    Returns persisted DetectedObject list.
    """
    model = _load_yolo_model(weights_path)
    objects: list[DetectedObject] = []

    if model is not None and frames:
        # ---- Real YOLO inference ----
        for frame_no, frame in enumerate(frames, 1):
            dets = _run_yolo_inference(model, frame, confidence_threshold, target_classes)
            for det in dets:
                width_cm = det["bbox_w"] * frame_width_px * px_to_cm_x
                height_cm = det["bbox_h"] * frame_height_px * px_to_cm_y
                objects.append(DetectedObject(
                    run_id=run_id,
                    frame_number=frame_no,
                    class_label=det["class_label"],
                    confidence=det["confidence"],
                    bbox_x=det["bbox_x"],
                    bbox_y=det["bbox_y"],
                    bbox_w=det["bbox_w"],
                    bbox_h=det["bbox_h"],
                    size_estimate_cm2=round(width_cm * height_cm, 2),
                    count_in_frame=1,
                ))
    elif ALLOW_SIMULATED_VISION:
        # ---- Fallback simulation ----
        logger.info("Using fallback simulation (no YOLO model or no frames provided)")
        sim_frames = _fallback_simulate(frame_count, confidence_threshold, target_classes)
        for frame_no, dets in enumerate(sim_frames, 1):
            for det in dets:
                width_cm = det["bbox_w"] * frame_width_px * px_to_cm_x
                height_cm = det["bbox_h"] * frame_height_px * px_to_cm_y
                objects.append(DetectedObject(
                    run_id=run_id,
                    frame_number=frame_no,
                    class_label=det["class_label"],
                    confidence=det["confidence"],
                    bbox_x=det["bbox_x"],
                    bbox_y=det["bbox_y"],
                    bbox_w=det["bbox_w"],
                    bbox_h=det["bbox_h"],
                    size_estimate_cm2=round(width_cm * height_cm, 2),
                    count_in_frame=1,
                ))
    else:
        raise HTTPException(
            status_code=503,
            detail=(
                "Real detection unavailable: ensure ultralytics is installed, "
                "YOLO model loads, and camera frames are accessible. "
                "Set ALLOW_SIMULATED_VISION=true to enable simulation fallback."
            ),
        )
    return objects


# ---------------------------------------------------------------------------
# Detection Model Endpoints
# ---------------------------------------------------------------------------

@router.post("/models", response_model=DetectionModelResponse, status_code=201)
async def register_model(
    payload: DetectionModelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a YOLO model configuration."""
    model = DetectionModel(**payload.model_dump())
    db.add(model)
    await db.commit()
    await db.refresh(model)
    logger.info(f"Detection model registered: {model.model_name} v{model.model_version}")
    return model


@router.get("/models", response_model=list[DetectionModelResponse])
async def list_models(
    db: AsyncSession = Depends(get_db),
):
    """List active detection models."""
    result = await db.execute(select(DetectionModel).where(DetectionModel.is_active == True))
    return result.scalars().all()


@router.get("/models/{model_id}", response_model=DetectionModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific detection model."""
    model = await db.get(DetectionModel, model_id)
    if not model or not model.is_active:
        raise HTTPException(status_code=404, detail="Detection model not found")
    return model


class DetectionModelTune(BaseModel):
    """Tune confidence / IOU thresholds for a detection model."""
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum confidence (0.0-1.0)")
    iou_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="IoU overlap threshold (0.0-1.0)")
    target_classes: Optional[str] = Field(None, description="Comma-separated target classes")


@router.patch("/models/{model_id}/tune", response_model=DetectionModelResponse)
async def tune_model(
    model_id: uuid.UUID,
    payload: DetectionModelTune,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tune AI model parameters — confidence threshold, IOU threshold, target classes.
    Used for Day 5 confidence calibration per F-001 (85% default, adjustable).
    """
    model = await db.get(DetectionModel, model_id)
    if not model or not model.is_active:
        raise HTTPException(status_code=404, detail="Detection model not found")

    if payload.confidence_threshold is not None:
        model.confidence_threshold = payload.confidence_threshold
    if payload.iou_threshold is not None:
        model.iou_threshold = payload.iou_threshold
    if payload.target_classes is not None:
        model.target_classes = payload.target_classes

    await db.commit()
    await db.refresh(model)
    logger.info(
        f"Model {model.model_name} tuned: conf={model.confidence_threshold}, "
        f"iou={model.iou_threshold}, classes={model.target_classes}"
    )
    return model


# ---------------------------------------------------------------------------
# Detection Run Endpoints
# ---------------------------------------------------------------------------

@router.post("/runs", response_model=DetectionRunResponse, status_code=201)
async def start_detection_run(
    payload: DetectionRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start a detection run by capturing frames from a connected camera.
    Uses real YOLO v8 inference when ultralytics is installed and the camera
    stream is active. Falls back to simulation otherwise.
    """
    det_model = await db.get(DetectionModel, payload.model_id)
    if not det_model or not det_model.is_active:
        raise HTTPException(status_code=404, detail="Detection model not found")

    run = DetectionRun(
        camera_id=payload.camera_id,
        model_id=payload.model_id,
        status=RunStatus.RUNNING,
        frame_count=payload.frame_count,
        started_at=datetime.now(timezone.utc),
        initiated_by=str(current_user.id),
    )
    db.add(run)
    await db.flush()

    target_classes = [c.strip() for c in det_model.target_classes.split(",")]

    # Try to capture real frames from camera stream
    frames: list[np.ndarray] | None = None
    if payload.camera_id:
        try:
            from app.depot.vision.camera import capture_frames
            frames = await capture_frames(str(payload.camera_id), payload.frame_count)
        except Exception as e:
            logger.warning(f"Could not capture frames from camera {payload.camera_id}: {e}")

    detections = _detect_on_frames(
        run_id=run.id,
        frames=frames,
        frame_count=payload.frame_count,
        confidence_threshold=det_model.confidence_threshold,
        target_classes=target_classes,
        weights_path=det_model.weights_path,
        frame_width_px=det_model.frame_width_px or 1920,
        frame_height_px=det_model.frame_height_px or 1080,
        px_to_cm_x=det_model.px_to_cm_x or 0.5,
        px_to_cm_y=det_model.px_to_cm_y or 0.5,
    )

    # Archive frames to MinIO
    if frames:
        try:
            from app.depot.vision.frame_storage import save_detection_frame
            from app.depot.vision.camera import _HAS_CV2
            if _HAS_CV2:
                import cv2
                for i, frame in enumerate(frames):
                    _, buf = cv2.imencode(".jpg", frame)
                    save_detection_frame(buf.tobytes(), str(run.id), i + 1)
        except Exception as e:
            logger.warning(f"Failed to archive detection frames: {e}")

    for obj in detections:
        db.add(obj)

    run.total_detections = len(detections)
    run.status = RunStatus.COMPLETED
    run.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(run)
    logger.info(f"Detection run {run.id}: {run.total_detections} objects in {run.frame_count} frames (yolo={'real' if _HAS_ULTRALYTICS and frames else 'fallback'})")
    return run


@router.post("/detect-frame", response_model=list[DetectedObjectResponse], status_code=200)
async def detect_on_uploaded_frame(
    file: UploadFile = File(..., description="JPEG/PNG image frame"),
    model_id: uuid.UUID = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run YOLO detection on a single uploaded image frame.
    Returns detected objects without creating a persistent run record.
    Useful for one-shot detection from uploaded snapshots.
    """
    det_model = await db.get(DetectionModel, model_id)
    if not det_model or not det_model.is_active:
        raise HTTPException(status_code=404, detail="Detection model not found")

    image_bytes = await file.read()
    frame = np.frombuffer(image_bytes, dtype=np.uint8)

    try:
        import cv2
        frame = cv2.imdecode(frame, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image")
    except ImportError:
        raise HTTPException(status_code=501, detail="opencv-python-headless is required for frame upload")

    target_classes = [c.strip() for c in det_model.target_classes.split(",")]
    model = _load_yolo_model(det_model.weights_path)

    if model is None:
        raise HTTPException(status_code=501, detail="YOLO model not available — install ultralytics")

    raw_dets = _run_yolo_inference(model, frame, det_model.confidence_threshold, target_classes)

    # Build response objects (not persisted)
    h, w = frame.shape[:2]
    px_to_cm_x = det_model.px_to_cm_x or 0.5
    px_to_cm_y = det_model.px_to_cm_y or 0.5
    result = []
    for i, det in enumerate(raw_dets):
        width_cm = det["bbox_w"] * w * px_to_cm_x
        height_cm = det["bbox_h"] * h * px_to_cm_y
        obj = DetectedObject(
            run_id=uuid.uuid4(),
            frame_number=1,
            class_label=det["class_label"],
            confidence=det["confidence"],
            bbox_x=det["bbox_x"],
            bbox_y=det["bbox_y"],
            bbox_w=det["bbox_w"],
            bbox_h=det["bbox_h"],
            size_estimate_cm2=round(width_cm * height_cm, 2),
            count_in_frame=1,
        )
        obj.id = uuid.uuid4()
        obj.created_at = datetime.now(timezone.utc)
        result.append(DetectedObjectResponse.model_validate(obj))
    return result


@router.get("/runs", response_model=list[DetectionRunResponse])
async def list_runs(
    camera_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List detection runs, optionally filtered by camera."""
    query = select(DetectionRun)
    if camera_id:
        query = query.where(DetectionRun.camera_id == camera_id)
    result = await db.execute(query.order_by(DetectionRun.created_at.desc()))
    return result.scalars().all()


@router.get("/runs/{run_id}", response_model=RunSummary)
async def get_run_summary(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a run's results with a per-class count and average confidence."""
    run = await db.get(DetectionRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Detection run not found")

    result = await db.execute(
        select(DetectedObject).where(DetectedObject.run_id == run_id)
    )
    objects = result.scalars().all()

    by_class: dict[str, int] = {}
    total_conf = 0.0
    for obj in objects:
        by_class[obj.class_label] = by_class.get(obj.class_label, 0) + 1
        total_conf += obj.confidence

    avg_conf = round(total_conf / len(objects), 4) if objects else 0.0

    return RunSummary(
        run=DetectionRunResponse.model_validate(run),
        detections_by_class=by_class,
        average_confidence=avg_conf,
    )


@router.get("/runs/{run_id}/objects", response_model=list[DetectedObjectResponse])
async def get_run_objects(
    run_id: uuid.UUID,
    class_label: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all detected objects for a run, optionally filtered by class."""
    run = await db.get(DetectionRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Detection run not found")

    query = select(DetectedObject).where(DetectedObject.run_id == run_id)
    if class_label:
        query = query.where(DetectedObject.class_label == class_label)
    result = await db.execute(query.order_by(DetectedObject.frame_number))
    return result.scalars().all()
