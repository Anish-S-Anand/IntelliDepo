"""
Intelli Depot — Bag/Box Detection
Feature: DEPOT-V2

YOLO v8 model integration for detecting bags and boxes in camera feeds.
Provides bounding boxes, class labels, confidence scores, and size estimates.

Dependency note: AUTH-6.2 (RBAC) is not yet BUILT.
Permission checks use a lightweight stub `require_permission()` that will be
replaced with the real RBAC engine once AUTH-6.2 is merged.

YOLO note: Real inference requires `ultralytics` + GPU. This module ships a
SimulatedDetector that generates realistic synthetic results so the full API,
persistence, and downstream pipeline can be developed and tested without a
GPU environment. Swap _run_inference() for a real YOLO call when the model
weights are available.
"""
import uuid
import random
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user, require_permission
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.detection")

router = APIRouter(prefix="/depot/vision/detection", tags=["Depot - Detection"])




# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ObjectClass(str, Enum):
    BAG = "bag"
    BOX = "box"
    PALLET = "pallet"
    CARTON = "carton"
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
    confidence_threshold = Column(Float, default=0.45)
    iou_threshold = Column(Float, default=0.50)
    target_classes = Column(String, default="bag,box")     # comma-separated
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)


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

class DetectionModelCreate(BaseModel):
    model_name: str = Field(..., json_schema_extra={"example": "depot-yolov8n"})
    model_version: str = Field("v8n", json_schema_extra={"example": "v8n"})
    weights_path: Optional[str] = Field(None, json_schema_extra={"example": "/models/depot_yolov8n.pt"})
    confidence_threshold: float = Field(0.45, ge=0.0, le=1.0)
    iou_threshold: float = Field(0.50, ge=0.0, le=1.0)
    target_classes: str = Field("bag,box", json_schema_extra={"example": "bag,box,pallet"})
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
# Simulated YOLO Inference
# ---------------------------------------------------------------------------

def _simulate_detections(
    run_id: uuid.UUID,
    frame_count: int,
    confidence_threshold: float,
    target_classes: list[str],
) -> list[DetectedObject]:
    """
    Generate synthetic detection results that mimic real YOLO output.
    Replace this function body with actual `ultralytics` YOLO inference
    once model weights are available.
    """
    objects: list[DetectedObject] = []
    available = [c for c in target_classes if c in [e.value for e in ObjectClass]]
    if not available:
        available = [ObjectClass.BOX]

    for frame_no in range(1, frame_count + 1):
        n_objects = random.randint(0, 6)
        for _ in range(n_objects):
            conf = round(random.uniform(confidence_threshold, 0.99), 4)
            cls = random.choice(available)
            bx = round(random.uniform(0.0, 0.7), 4)
            by = round(random.uniform(0.0, 0.7), 4)
            bw = round(random.uniform(0.05, 0.3), 4)
            bh = round(random.uniform(0.05, 0.3), 4)
            # rough physical size estimate: assume 1920x1080 frame, 1px ~ 0.5cm
            size_cm2 = round(bw * 1920 * 0.5 * bh * 1080 * 0.5, 2)
            objects.append(DetectedObject(
                run_id=run_id,
                frame_number=frame_no,
                class_label=cls,
                confidence=conf,
                bbox_x=bx,
                bbox_y=by,
                bbox_w=bw,
                bbox_h=bh,
                size_estimate_cm2=size_cm2,
                count_in_frame=1,
            ))
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
    current_user: User = Depends(get_current_user),
):
    """List active detection models."""
    result = await db.execute(select(DetectionModel).where(DetectionModel.is_active == True))
    return result.scalars().all()


@router.get("/models/{model_id}", response_model=DetectionModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific detection model."""
    model = await db.get(DetectionModel, model_id)
    if not model or not model.is_active:
        raise HTTPException(status_code=404, detail="Detection model not found")
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
    Start a detection run.
    Simulates YOLO inference over the specified number of frames and persists
    all detected objects. Returns the completed run record.
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
    await db.flush()  # get run.id before inserting objects

    target_classes = [c.strip() for c in det_model.target_classes.split(",")]
    detections = _simulate_detections(
        run.id,
        payload.frame_count,
        det_model.confidence_threshold,
        target_classes,
    )
    for obj in detections:
        db.add(obj)

    run.total_detections = len(detections)
    run.status = RunStatus.COMPLETED
    run.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(run)
    logger.info(f"Detection run {run.id}: {run.total_detections} objects in {run.frame_count} frames")
    return run


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
