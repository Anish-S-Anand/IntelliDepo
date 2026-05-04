"""
Intelli Depot -- Colour Analysis & Classification
Feature: DEPOT-V2.1

OpenCV-based RGB/HSV colour extraction per detected bounding box.
Bag colour classification with mismatch alert event publishing
when count vs manifest delta exceeds threshold.

Uses real OpenCV for colour extraction from camera frames when available.
Falls back to simulation when OpenCV is unavailable or no frame data exists.

Dependency note: AUTH-6.2 (RBAC) is active.
"""
import uuid
import random
import logging
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.core.notifications.service_compat import NotificationService
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.colour_analysis")
ALLOW_SIMULATED_VISION = os.getenv("ALLOW_SIMULATED_VISION", "false").lower() in {"1", "true", "yes"}

try:
    import cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False

router = APIRouter(prefix="/depot/vision/colour", tags=["Depot - Colour Analysis"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ColourCategory(str, Enum):
    RED = "red"
    BLUE = "blue"
    GREEN = "green"
    YELLOW = "yellow"
    ORANGE = "orange"
    WHITE = "white"
    BLACK = "black"
    BROWN = "brown"
    GREY = "grey"
    UNKNOWN = "unknown"


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class ColourAnalysisRun(DBBaseModel):
    """A colour analysis job run against detection results."""
    __tablename__ = "depot_colour_analysis_runs"

    detection_run_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    camera_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    status = Column(String, default=AnalysisStatus.PENDING)
    total_analysed = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    initiated_by = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)


class ColourResult(DBBaseModel):
    """Colour extraction result for a single detected object."""
    __tablename__ = "depot_colour_results"

    analysis_run_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    detected_object_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    class_label = Column(String, nullable=False)       # bag, box, pallet, carton
    colour_category = Column(String, nullable=False)    # classified colour
    rgb_r = Column(Integer, default=0)
    rgb_g = Column(Integer, default=0)
    rgb_b = Column(Integer, default=0)
    hsv_h = Column(Float, default=0.0)                  # hue 0-360
    hsv_s = Column(Float, default=0.0)                  # saturation 0-1
    hsv_v = Column(Float, default=0.0)                  # value 0-1
    confidence = Column(Float, default=0.0)             # colour classification confidence
    bbox_x = Column(Float, nullable=True)
    bbox_y = Column(Float, nullable=True)
    bbox_w = Column(Float, nullable=True)
    bbox_h = Column(Float, nullable=True)
    frame_number = Column(Integer, nullable=True)


class ColourMismatchAlert(DBBaseModel):
    """Alert raised when bag colours don't match expected distribution."""
    __tablename__ = "depot_colour_mismatch_alerts"

    analysis_run_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    manifest_code = Column(String, nullable=True)
    expected_colour = Column(String, nullable=True)
    detected_colours = Column(Text, nullable=True)     # JSON summary
    mismatch_count = Column(Integer, default=0)
    total_analysed = Column(Integer, default=0)
    severity = Column(String, default="medium")
    message = Column(Text, nullable=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ColourAnalysisRequest(BaseModel):
    detection_run_id: uuid.UUID
    manifest_code: Optional[str] = None
    expected_colour: Optional[str] = Field(
        None,
        description="Expected bag/box colour. If provided, mismatches will trigger alerts.",
        json_schema_extra={"example": "blue"},
    )


class ColourResultResponse(BaseModel):
    id: uuid.UUID
    analysis_run_id: uuid.UUID
    detected_object_id: uuid.UUID
    class_label: str
    colour_category: str
    rgb_r: int
    rgb_g: int
    rgb_b: int
    hsv_h: float
    hsv_s: float
    hsv_v: float
    confidence: float
    bbox_x: Optional[float]
    bbox_y: Optional[float]
    bbox_w: Optional[float]
    bbox_h: Optional[float]
    frame_number: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ColourAnalysisRunResponse(BaseModel):
    id: uuid.UUID
    detection_run_id: uuid.UUID
    camera_id: Optional[uuid.UUID]
    status: str
    total_analysed: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    initiated_by: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ColourMismatchAlertResponse(BaseModel):
    id: uuid.UUID
    analysis_run_id: uuid.UUID
    manifest_code: Optional[str]
    expected_colour: Optional[str]
    detected_colours: Optional[str]
    mismatch_count: int
    total_analysed: int
    severity: str
    message: Optional[str]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ColourAnalysisSummary(BaseModel):
    run: ColourAnalysisRunResponse
    colour_distribution: dict[str, int]
    results: list[ColourResultResponse]
    alert: Optional[ColourMismatchAlertResponse]


# ---------------------------------------------------------------------------
# Simulated Colour Extraction
# ---------------------------------------------------------------------------

# HSV ranges for colour classification (hue in degrees)
_COLOUR_HSV_MAP: dict[str, tuple[tuple[int, int], tuple[float, float], tuple[float, float]]] = {
    "red":    ((0, 15),    (0.5, 1.0), (0.4, 1.0)),
    "orange": ((15, 40),   (0.6, 1.0), (0.5, 1.0)),
    "yellow": ((40, 70),   (0.5, 1.0), (0.5, 1.0)),
    "green":  ((70, 160),  (0.3, 1.0), (0.3, 1.0)),
    "blue":   ((200, 260), (0.3, 1.0), (0.3, 1.0)),
    "brown":  ((10, 30),   (0.3, 0.7), (0.2, 0.5)),
    "white":  ((0, 360),   (0.0, 0.1), (0.8, 1.0)),
    "black":  ((0, 360),   (0.0, 0.3), (0.0, 0.2)),
    "grey":   ((0, 360),   (0.0, 0.1), (0.3, 0.7)),
}


def _hsv_to_rgb(h: float, s: float, v: float) -> tuple[int, int, int]:
    """Convert HSV (h in degrees, s/v in 0-1) to RGB (0-255)."""
    import colorsys
    r, g, b = colorsys.hsv_to_rgb(h / 360.0, s, v)
    return int(r * 255), int(g * 255), int(b * 255)


def _classify_colour(h: float, s: float, v: float) -> str:
    """Classify a colour from HSV values."""
    if v < 0.15:
        return "black"
    if s < 0.1 and v > 0.8:
        return "white"
    if s < 0.1:
        return "grey"

    for name, ((h_lo, h_hi), (s_lo, s_hi), (v_lo, v_hi)) in _COLOUR_HSV_MAP.items():
        if name in ("white", "black", "grey"):
            continue
        if h_lo <= h <= h_hi and s_lo <= s <= s_hi and v_lo <= v <= v_hi:
            return name

    return "unknown"


def _extract_colour_from_roi(frame: np.ndarray, bbox_x: float, bbox_y: float,
                              bbox_w: float, bbox_h: float) -> dict:
    """
    Extract dominant colour from a bounding box region using real OpenCV.
    Returns dict with rgb, hsv, colour_category, and confidence.
    """
    h_frame, w_frame = frame.shape[:2]
    x1 = max(0, int(bbox_x * w_frame))
    y1 = max(0, int(bbox_y * h_frame))
    x2 = min(w_frame, int((bbox_x + bbox_w) * w_frame))
    y2 = min(h_frame, int((bbox_y + bbox_h) * h_frame))

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return {"rgb": (128, 128, 128), "hsv": (0.0, 0.0, 0.5),
                "colour_category": "grey", "confidence": 0.5}

    # Convert ROI to HSV and compute mean
    hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mean_hsv = cv2.mean(hsv_roi)[:3]  # H(0-180), S(0-255), V(0-255)
    mean_bgr = cv2.mean(roi)[:3]

    # Convert OpenCV HSV scale to standard (H: 0-360, S: 0-1, V: 0-1)
    h_deg = mean_hsv[0] * 2.0        # OpenCV H is 0-180
    s_norm = mean_hsv[1] / 255.0
    v_norm = mean_hsv[2] / 255.0

    colour_name = _classify_colour(h_deg, s_norm, v_norm)

    # Confidence based on colour saturation/value consistency
    std_hsv = np.std(hsv_roi.reshape(-1, 3).astype(float), axis=0)
    uniformity = 1.0 - min(1.0, (std_hsv[1] / 128.0 + std_hsv[2] / 128.0) / 2.0)
    confidence = round(max(0.5, min(0.99, uniformity)), 4)

    return {
        "rgb": (int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0])),  # BGR->RGB
        "hsv": (round(h_deg, 2), round(s_norm, 4), round(v_norm, 4)),
        "colour_category": colour_name,
        "confidence": confidence,
    }


def _analyse_colours_real(
    detected_objects: list,
    analysis_run_id: uuid.UUID,
    frames: dict[int, np.ndarray],
) -> list[ColourResult]:
    """Real OpenCV colour analysis using actual frame data."""
    results: list[ColourResult] = []
    for obj in detected_objects:
        frame = frames.get(obj.frame_number)
        if frame is None:
            continue
        info = _extract_colour_from_roi(frame, obj.bbox_x, obj.bbox_y, obj.bbox_w, obj.bbox_h)
        r, g, b = info["rgb"]
        h, s, v = info["hsv"]
        results.append(ColourResult(
            analysis_run_id=analysis_run_id,
            detected_object_id=obj.id,
            class_label=obj.class_label,
            colour_category=info["colour_category"],
            rgb_r=r, rgb_g=g, rgb_b=b,
            hsv_h=h, hsv_s=s, hsv_v=v,
            confidence=info["confidence"],
            bbox_x=obj.bbox_x, bbox_y=obj.bbox_y,
            bbox_w=obj.bbox_w, bbox_h=obj.bbox_h,
            frame_number=obj.frame_number,
        ))
    return results


def _analyse_colours_fallback(
    detected_objects: list,
    analysis_run_id: uuid.UUID,
) -> list[ColourResult]:
    """Fallback simulation when no frame data is available."""
    results: list[ColourResult] = []
    available_colours = list(_COLOUR_HSV_MAP.keys())

    for obj in detected_objects:
        colour_name = random.choice(available_colours[:6])
        ranges = _COLOUR_HSV_MAP[colour_name]
        h = random.uniform(ranges[0][0], ranges[0][1])
        s = random.uniform(ranges[1][0], ranges[1][1])
        v = random.uniform(ranges[2][0], ranges[2][1])
        r, g, b = _hsv_to_rgb(h, s, v)

        results.append(ColourResult(
            analysis_run_id=analysis_run_id,
            detected_object_id=obj.id,
            class_label=obj.class_label,
            colour_category=colour_name,
            rgb_r=r, rgb_g=g, rgb_b=b,
            hsv_h=round(h, 2), hsv_s=round(s, 4), hsv_v=round(v, 4),
            confidence=round(random.uniform(0.80, 0.99), 4),
            bbox_x=obj.bbox_x, bbox_y=obj.bbox_y,
            bbox_w=obj.bbox_w, bbox_h=obj.bbox_h,
            frame_number=obj.frame_number,
        ))

    return results


# ---------------------------------------------------------------------------
# Colour Analysis Endpoints
# ---------------------------------------------------------------------------

@router.post("/analyse", response_model=ColourAnalysisSummary, status_code=201)
async def run_colour_analysis(
    payload: ColourAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run colour analysis on all detected objects from a completed detection run.
    Extracts RGB/HSV values per bounding box, classifies colours, and raises
    mismatch alerts if expected_colour is provided and mismatches are found.
    """
    from app.depot.vision.detection import DetectionRun, DetectedObject, RunStatus

    # Validate detection run
    det_run = await db.get(DetectionRun, payload.detection_run_id)
    if not det_run:
        raise HTTPException(status_code=404, detail="Detection run not found")
    if det_run.status != RunStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Detection run is not completed")

    # Create analysis run
    analysis_run = ColourAnalysisRun(
        detection_run_id=payload.detection_run_id,
        camera_id=det_run.camera_id,
        status=AnalysisStatus.PENDING,
        started_at=datetime.now(timezone.utc),
        initiated_by=str(current_user.id),
    )
    db.add(analysis_run)
    await db.flush()

    # Fetch detected objects
    result = await db.execute(
        select(DetectedObject).where(DetectedObject.run_id == payload.detection_run_id)
    )
    detected_objects = result.scalars().all()

    if not detected_objects:
        analysis_run.status = AnalysisStatus.COMPLETED
        analysis_run.total_analysed = 0
        analysis_run.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(analysis_run)
        return ColourAnalysisSummary(
            run=ColourAnalysisRunResponse.model_validate(analysis_run),
            colour_distribution={},
            results=[],
            alert=None,
        )

    # Run colour extraction — try real OpenCV with frames from camera
    frames: dict[int, np.ndarray] = {}
    if _HAS_CV2 and det_run.camera_id:
        try:
            from app.depot.vision.camera import stream_read_frame
            frame_numbers = sorted(set(obj.frame_number for obj in detected_objects))
            for fn in frame_numbers:
                f = await stream_read_frame(str(det_run.camera_id))
                if f is not None:
                    frames[fn] = f
        except Exception as e:
            logger.warning(f"Could not capture frames for colour analysis: {e}")

    if _HAS_CV2 and frames:
        colour_results = _analyse_colours_real(detected_objects, analysis_run.id, frames)
        logger.info(f"Colour analysis used real OpenCV extraction on {len(frames)} frames")
    elif ALLOW_SIMULATED_VISION:
        colour_results = _analyse_colours_fallback(detected_objects, analysis_run.id)
        logger.info("Colour analysis used fallback simulation")
    else:
        raise HTTPException(
            status_code=503,
            detail=(
                "Real colour analysis unavailable: ensure OpenCV is installed and camera frames "
                "are accessible. Set ALLOW_SIMULATED_VISION=true to enable simulation fallback."
            ),
        )
    for cr in colour_results:
        db.add(cr)

    analysis_run.total_analysed = len(colour_results)
    analysis_run.status = AnalysisStatus.COMPLETED
    analysis_run.completed_at = datetime.now(timezone.utc)

    # Build colour distribution
    distribution: dict[str, int] = {}
    for cr in colour_results:
        distribution[cr.colour_category] = distribution.get(cr.colour_category, 0) + 1

    # Check for colour mismatch if expected_colour is provided
    alert = None
    if payload.expected_colour:
        expected = payload.expected_colour.lower()
        mismatch_count = sum(
            1 for cr in colour_results
            if cr.colour_category != expected and cr.class_label == "bag"
        )
        total_bags = sum(1 for cr in colour_results if cr.class_label == "bag")

        if mismatch_count > 0 and total_bags > 0:
            mismatch_pct = mismatch_count / total_bags
            if mismatch_pct >= 0.5:
                severity = "critical"
            elif mismatch_pct >= 0.25:
                severity = "high"
            elif mismatch_pct >= 0.1:
                severity = "medium"
            else:
                severity = "low"

            import json
            alert = ColourMismatchAlert(
                analysis_run_id=analysis_run.id,
                manifest_code=payload.manifest_code,
                expected_colour=expected,
                detected_colours=json.dumps(distribution),
                mismatch_count=mismatch_count,
                total_analysed=total_bags,
                severity=severity,
                message=(
                    f"Colour mismatch: expected '{expected}' bags, "
                    f"found {mismatch_count}/{total_bags} bags with different colours. "
                    f"Distribution: {distribution}"
                ),
            )
            db.add(alert)

            # Dispatch alert notification (in-app + RabbitMQ + WebSocket)
            alert_payload = {
                "manifest_code": payload.manifest_code,
                "expected_colour": expected,
                "mismatch_count": mismatch_count,
                "total_bags": total_bags,
                "distribution": distribution,
            }
            try:
                priority_map = {"critical": "CRITICAL", "high": "HIGH", "medium": "NORMAL", "low": "LOW"}
                await NotificationService.send_alert(
                    db=db,
                    user_id=current_user.id,
                    event_type="depot.colour.mismatch",
                    title=f"Colour Mismatch — {payload.manifest_code or 'Unlinked'}",
                    message=alert.message,
                    priority=priority_map.get(severity, "NORMAL"),
                    payload=alert_payload,
                    channel="in_app",
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch colour mismatch notification: {e}")

            # Publish to RabbitMQ
            try:
                from app.core.rabbitmq import publish_alert
                await publish_alert("colour_mismatch", severity, alert_payload)
            except Exception as e:
                logger.warning(f"Failed to publish colour mismatch to RabbitMQ: {e}")

            # Broadcast via WebSocket (RealTimeHub)
            try:
                from app.core.gateway.realtime import realtime_hub
                await realtime_hub.publish(
                    topic="depot.alerts",
                    event_type="colour_mismatch",
                    payload={
                        "alert_id": str(alert.id) if hasattr(alert, "id") else None,
                        "severity": severity,
                        "message": alert.message,
                        **alert_payload,
                    },
                    sender="depot-vision",
                )
            except Exception as e:
                logger.warning(f"Failed to broadcast colour mismatch via WebSocket: {e}")

    await db.commit()
    await db.refresh(analysis_run)
    if alert:
        await db.refresh(alert)

    logger.info(
        f"Colour analysis {analysis_run.id}: {analysis_run.total_analysed} objects analysed, "
        f"distribution={distribution}"
    )

    return ColourAnalysisSummary(
        run=ColourAnalysisRunResponse.model_validate(analysis_run),
        colour_distribution=distribution,
        results=[ColourResultResponse.model_validate(cr) for cr in colour_results],
        alert=ColourMismatchAlertResponse.model_validate(alert) if alert else None,
    )


@router.get("/runs", response_model=list[ColourAnalysisRunResponse])
async def list_colour_runs(
    detection_run_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List colour analysis runs."""
    query = select(ColourAnalysisRun)
    if detection_run_id:
        query = query.where(ColourAnalysisRun.detection_run_id == detection_run_id)
    result = await db.execute(query.order_by(ColourAnalysisRun.created_at.desc()))
    return result.scalars().all()


@router.get("/runs/{run_id}/results", response_model=list[ColourResultResponse])
async def get_colour_results(
    run_id: uuid.UUID,
    colour: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get colour analysis results for a run, optionally filtered by colour."""
    analysis_run = await db.get(ColourAnalysisRun, run_id)
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Colour analysis run not found")

    query = select(ColourResult).where(ColourResult.analysis_run_id == run_id)
    if colour:
        query = query.where(ColourResult.colour_category == colour.lower())
    result = await db.execute(query.order_by(ColourResult.frame_number))
    return result.scalars().all()


@router.get("/alerts", response_model=list[ColourMismatchAlertResponse])
async def list_colour_alerts(
    acknowledged: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List colour mismatch alerts."""
    query = select(ColourMismatchAlert)
    if acknowledged is not None:
        query = query.where(ColourMismatchAlert.acknowledged == acknowledged)
    result = await db.execute(query.order_by(ColourMismatchAlert.created_at.desc()))
    return result.scalars().all()


@router.patch("/alerts/{alert_id}/acknowledge", response_model=ColourMismatchAlertResponse)
async def acknowledge_colour_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge a colour mismatch alert."""
    alert = await db.get(ColourMismatchAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.acknowledged_by = str(current_user.id)
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.get("/alerts/active", response_model=list[ColourMismatchAlertResponse])
async def get_active_colour_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all unacknowledged colour mismatch alerts."""
    result = await db.execute(
        select(ColourMismatchAlert)
        .where(ColourMismatchAlert.acknowledged == False)
        .order_by(ColourMismatchAlert.created_at.desc())
    )
    return result.scalars().all()
