"""
Intelli Depot — Automated Counting
Feature: DEPOT-V3

Frame-by-frame counting agent with batch tallying, cross-verification against
shipment manifests, and auto-reconciliation service.

Builds on DEPOT-V2 (Detection) — aggregates detection results into verified
counts and reconciles against expected manifest quantities.
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
from sqlalchemy import select, func

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.core.notifications.service_compat import NotificationService
from app.shared.models.user import User

# In-memory tracking state store (replaces Redis)
_tracking_state: dict[str, dict] = {}

logger = logging.getLogger("intelli.depot.counting")

router = APIRouter(prefix="/depot/vision/counting", tags=["Depot - Counting"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ReconciliationStatus(str, Enum):
    MATCHED = "matched"
    MISMATCH = "mismatch"
    PENDING = "pending"
    OVERRIDE = "override"


class ManifestStatus(str, Enum):
    OPEN = "open"
    VERIFIED = "verified"
    DISCREPANCY = "discrepancy"
    CLOSED = "closed"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class ShipmentManifest(DBBaseModel):
    """Expected shipment manifest for cross-verification."""
    __tablename__ = "depot_shipment_manifests"

    manifest_code = Column(String, unique=True, nullable=False, index=True)
    shipment_ref = Column(String, nullable=True)
    expected_bags = Column(Integer, default=0)
    expected_boxes = Column(Integer, default=0)
    expected_pallets = Column(Integer, default=0)
    expected_cartons = Column(Integer, default=0)
    total_expected = Column(Integer, default=0)
    gate_id = Column(String, nullable=True)
    vehicle_number = Column(String, nullable=True)
    status = Column(String, default=ManifestStatus.OPEN)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String, nullable=True)
    notes = Column(Text, nullable=True)


class CountSession(DBBaseModel):
    """A counting session tied to a detection run or manual count."""
    __tablename__ = "depot_count_sessions"

    manifest_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    detection_run_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    camera_id = Column(UUID(as_uuid=True), nullable=True)
    zone = Column(String, nullable=True)
    counted_bags = Column(Integer, default=0)
    counted_boxes = Column(Integer, default=0)
    counted_pallets = Column(Integer, default=0)
    counted_cartons = Column(Integer, default=0)
    total_counted = Column(Integer, default=0)
    confidence_avg = Column(Float, default=0.0)
    reconciliation_status = Column(String, default=ReconciliationStatus.PENDING)
    discrepancy_bags = Column(Integer, default=0)
    discrepancy_boxes = Column(Integer, default=0)
    discrepancy_total = Column(Integer, default=0)
    alert_sent = Column(Boolean, default=False)
    counted_by = Column(String, nullable=True)


class MismatchAlert(DBBaseModel):
    """Mismatch alert dispatched when counts don't match manifest."""
    __tablename__ = "depot_mismatch_alerts"

    session_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    manifest_id = Column(UUID(as_uuid=True), nullable=True)
    manifest_code = Column(String, nullable=True)
    expected_total = Column(Integer, default=0)
    counted_total = Column(Integer, default=0)
    discrepancy = Column(Integer, default=0)
    severity = Column(String, default="medium")   # low / medium / high / critical
    message = Column(Text, nullable=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ManifestCreate(BaseModel):
    manifest_code: str = Field(..., json_schema_extra={"example": "MF-2026-0412"})
    shipment_ref: Optional[str] = None
    expected_bags: int = Field(0, ge=0)
    expected_boxes: int = Field(0, ge=0)
    expected_pallets: int = Field(0, ge=0)
    expected_cartons: int = Field(0, ge=0)
    gate_id: Optional[str] = None
    vehicle_number: Optional[str] = None
    notes: Optional[str] = None


class ManifestResponse(BaseModel):
    id: uuid.UUID
    manifest_code: str
    shipment_ref: Optional[str]
    expected_bags: Optional[int] = 0
    expected_boxes: Optional[int] = 0
    expected_pallets: Optional[int] = 0
    expected_cartons: Optional[int] = 0
    total_expected: Optional[int] = 0
    gate_id: Optional[str]
    vehicle_number: Optional[str]
    status: str
    verified_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CountSessionCreate(BaseModel):
    manifest_id: Optional[uuid.UUID] = None
    detection_run_id: Optional[uuid.UUID] = None
    camera_id: Optional[uuid.UUID] = None
    zone: Optional[str] = None
    counted_bags: int = Field(0, ge=0)
    counted_boxes: int = Field(0, ge=0)
    counted_pallets: int = Field(0, ge=0)
    counted_cartons: int = Field(0, ge=0)


class CountSessionResponse(BaseModel):
    id: uuid.UUID
    manifest_id: Optional[uuid.UUID]
    detection_run_id: Optional[uuid.UUID]
    camera_id: Optional[uuid.UUID]
    zone: Optional[str]
    counted_bags: int
    counted_boxes: int
    counted_pallets: int
    counted_cartons: int
    total_counted: int
    confidence_avg: float
    reconciliation_status: str
    discrepancy_bags: int
    discrepancy_boxes: int
    discrepancy_total: int
    alert_sent: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MismatchAlertResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    manifest_id: Optional[uuid.UUID]
    manifest_code: Optional[str]
    expected_total: int
    counted_total: int
    discrepancy: int
    severity: str
    message: Optional[str]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReconciliationResult(BaseModel):
    session: CountSessionResponse
    manifest: Optional[ManifestResponse]
    alert: Optional[MismatchAlertResponse]
    status: str


# ---------------------------------------------------------------------------
# Manifest Endpoints
# ---------------------------------------------------------------------------

@router.post("/manifests", response_model=ManifestResponse, status_code=201)
async def create_manifest(
    payload: ManifestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register an expected shipment manifest for cross-verification."""
    existing = await db.execute(
        select(ShipmentManifest).where(ShipmentManifest.manifest_code == payload.manifest_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Manifest code already exists")

    manifest = ShipmentManifest(**payload.model_dump())
    manifest.total_expected = (
        payload.expected_bags + payload.expected_boxes +
        payload.expected_pallets + payload.expected_cartons
    )
    db.add(manifest)
    await db.commit()
    await db.refresh(manifest)
    logger.info(f"Manifest created: {manifest.manifest_code}, expected={manifest.total_expected}")
    return manifest


@router.get("/manifests", response_model=list[ManifestResponse])
async def list_manifests(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List shipment manifests."""
    query = select(ShipmentManifest)
    if status:
        query = query.where(ShipmentManifest.status == status)
    result = await db.execute(query.order_by(ShipmentManifest.created_at.desc()))
    return result.scalars().all()


@router.get("/manifests/{manifest_id}", response_model=ManifestResponse)
async def get_manifest(
    manifest_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    manifest = await db.get(ShipmentManifest, manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")
    return manifest


# ---------------------------------------------------------------------------
# Counting Session Endpoints
# ---------------------------------------------------------------------------

@router.post("/sessions", response_model=ReconciliationResult, status_code=201)
async def create_count_session(
    payload: CountSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a counting session. If a manifest_id is provided, auto-reconciles
    against expected counts and dispatches a mismatch alert if needed.
    """
    session = CountSession(**payload.model_dump())
    session.total_counted = (
        payload.counted_bags + payload.counted_boxes +
        payload.counted_pallets + payload.counted_cartons
    )
    session.counted_by = str(current_user.id)
    db.add(session)
    await db.flush()

    manifest = None
    alert = None

    if payload.manifest_id:
        manifest = await db.get(ShipmentManifest, payload.manifest_id)
        if not manifest:
            raise HTTPException(status_code=404, detail="Manifest not found")

        # Reconcile
        session.discrepancy_bags = session.counted_bags - manifest.expected_bags
        session.discrepancy_boxes = session.counted_boxes - manifest.expected_boxes
        session.discrepancy_total = session.total_counted - manifest.total_expected

        if session.discrepancy_total == 0:
            session.reconciliation_status = ReconciliationStatus.MATCHED
            manifest.status = ManifestStatus.VERIFIED
            manifest.verified_at = datetime.now(timezone.utc)
            manifest.verified_by = str(current_user.id)
        else:
            session.reconciliation_status = ReconciliationStatus.MISMATCH
            manifest.status = ManifestStatus.DISCREPANCY

            # Determine severity based on discrepancy magnitude
            abs_disc = abs(session.discrepancy_total)
            if abs_disc >= 10:
                severity = "critical"
            elif abs_disc >= 5:
                severity = "high"
            elif abs_disc >= 2:
                severity = "medium"
            else:
                severity = "low"

            alert = MismatchAlert(
                session_id=session.id,
                manifest_id=manifest.id,
                manifest_code=manifest.manifest_code,
                expected_total=manifest.total_expected,
                counted_total=session.total_counted,
                discrepancy=session.discrepancy_total,
                severity=severity,
                message=(
                    f"Count mismatch for {manifest.manifest_code}: "
                    f"expected {manifest.total_expected}, counted {session.total_counted} "
                    f"(diff: {session.discrepancy_total:+d})"
                ),
            )
            db.add(alert)
            session.alert_sent = True

            # Dispatch to Notification Hub
            try:
                priority_map = {"critical": "CRITICAL", "high": "HIGH", "medium": "NORMAL", "low": "LOW"}
                await NotificationService.send_alert(
                    db=db,
                    user_id=current_user.id,
                    event_type="depot.counting.mismatch",
                    title=f"Count Mismatch — {manifest.manifest_code}",
                    message=alert.message,
                    priority=priority_map.get(severity, "NORMAL"),
                    payload={
                        "manifest_code": manifest.manifest_code,
                        "expected": manifest.total_expected,
                        "counted": session.total_counted,
                        "discrepancy": session.discrepancy_total,
                        "severity": severity,
                    },
                    channel="in_app",
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch mismatch notification: {e}")

            # Publish to RabbitMQ
            alert_payload = {
                "manifest_code": manifest.manifest_code,
                "expected": manifest.total_expected,
                "counted": session.total_counted,
                "discrepancy": session.discrepancy_total,
                "severity": severity,
            }
            try:
                from app.core.rabbitmq import publish_alert
                await publish_alert("count_mismatch", severity, alert_payload)
            except Exception as e:
                logger.warning(f"Failed to publish count mismatch to RabbitMQ: {e}")

            # Broadcast via WebSocket
            try:
                from app.core.gateway.realtime import realtime_hub
                await realtime_hub.publish(
                    topic="depot.alerts",
                    event_type="count_mismatch",
                    payload={"severity": severity, "message": alert.message, **alert_payload},
                    sender="depot-counting",
                )
            except Exception as e:
                logger.warning(f"Failed to broadcast count mismatch via WebSocket: {e}")

    await db.commit()
    await db.refresh(session)
    if manifest:
        await db.refresh(manifest)
    if alert:
        await db.refresh(alert)

    logger.info(
        f"Count session {session.id}: total={session.total_counted}, "
        f"status={session.reconciliation_status}"
    )

    return ReconciliationResult(
        session=CountSessionResponse.model_validate(session),
        manifest=ManifestResponse.model_validate(manifest) if manifest else None,
        alert=MismatchAlertResponse.model_validate(alert) if alert else None,
        status=session.reconciliation_status,
    )


@router.get("/sessions", response_model=list[CountSessionResponse])
async def list_count_sessions(
    manifest_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List counting sessions with optional filters."""
    query = select(CountSession)
    if manifest_id:
        query = query.where(CountSession.manifest_id == manifest_id)
    if status:
        query = query.where(CountSession.reconciliation_status == status)
    result = await db.execute(query.order_by(CountSession.created_at.desc()))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Auto-Counting Agent — aggregate from detection runs
# ---------------------------------------------------------------------------

class AutoCountRequest(BaseModel):
    detection_run_id: uuid.UUID
    manifest_id: Optional[uuid.UUID] = None
    confidence_threshold: float = Field(0.85, ge=0.0, le=1.0, description="Min confidence to include in count")


@router.post("/auto-count", response_model=ReconciliationResult, status_code=201)
async def auto_count_from_detection(
    payload: AutoCountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Frame-by-frame Counting Agent: automatically aggregates object counts
    from a completed detection run, filters by confidence threshold, and
    optionally reconciles against a shipment manifest.
    """
    from app.depot.vision.detection import DetectionRun, DetectedObject, RunStatus

    run = await db.get(DetectionRun, payload.detection_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Detection run not found")
    if run.status != RunStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Detection run is not completed")

    # Aggregate counts from detected objects, filtering by confidence
    result = await db.execute(
        select(DetectedObject).where(
            DetectedObject.run_id == payload.detection_run_id,
            DetectedObject.confidence >= payload.confidence_threshold,
        )
    )
    objects = result.scalars().all()

    # Tally by class
    counts: dict[str, int] = {}
    total_conf = 0.0
    for obj in objects:
        counts[obj.class_label] = counts.get(obj.class_label, 0) + 1
        total_conf += obj.confidence

    avg_conf = round(total_conf / len(objects), 4) if objects else 0.0

    # Create counting session from aggregated data
    session_payload = CountSessionCreate(
        manifest_id=payload.manifest_id,
        detection_run_id=payload.detection_run_id,
        camera_id=run.camera_id,
        counted_bags=counts.get("bag", 0),
        counted_boxes=counts.get("box", 0),
        counted_pallets=counts.get("pallet", 0),
        counted_cartons=counts.get("carton", 0),
    )

    # Reuse the session creation logic
    session = CountSession(**session_payload.model_dump())
    session.total_counted = sum(counts.values())
    session.confidence_avg = avg_conf
    session.counted_by = str(current_user.id)
    db.add(session)
    await db.flush()

    manifest = None
    alert = None

    if payload.manifest_id:
        manifest = await db.get(ShipmentManifest, payload.manifest_id)
        if not manifest:
            raise HTTPException(status_code=404, detail="Manifest not found")

        session.discrepancy_bags = session.counted_bags - manifest.expected_bags
        session.discrepancy_boxes = session.counted_boxes - manifest.expected_boxes
        session.discrepancy_total = session.total_counted - manifest.total_expected

        if session.discrepancy_total == 0:
            session.reconciliation_status = ReconciliationStatus.MATCHED
            manifest.status = ManifestStatus.VERIFIED
            manifest.verified_at = datetime.now(timezone.utc)
            manifest.verified_by = str(current_user.id)
        else:
            session.reconciliation_status = ReconciliationStatus.MISMATCH
            manifest.status = ManifestStatus.DISCREPANCY

            abs_disc = abs(session.discrepancy_total)
            severity = "critical" if abs_disc >= 10 else "high" if abs_disc >= 5 else "medium" if abs_disc >= 2 else "low"

            alert = MismatchAlert(
                session_id=session.id,
                manifest_id=manifest.id,
                manifest_code=manifest.manifest_code,
                expected_total=manifest.total_expected,
                counted_total=session.total_counted,
                discrepancy=session.discrepancy_total,
                severity=severity,
                message=(
                    f"Auto-count mismatch for {manifest.manifest_code}: "
                    f"expected {manifest.total_expected}, counted {session.total_counted} "
                    f"(diff: {session.discrepancy_total:+d}, confidence >= {payload.confidence_threshold})"
                ),
            )
            db.add(alert)
            session.alert_sent = True

            try:
                priority_map = {"critical": "CRITICAL", "high": "HIGH", "medium": "NORMAL", "low": "LOW"}
                await NotificationService.send_alert(
                    db=db, user_id=current_user.id,
                    event_type="depot.counting.auto_mismatch",
                    title=f"Auto-Count Mismatch — {manifest.manifest_code}",
                    message=alert.message,
                    priority=priority_map.get(severity, "NORMAL"),
                    payload={"manifest_code": manifest.manifest_code, "discrepancy": session.discrepancy_total},
                    channel="in_app",
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch auto-count notification: {e}")

    await db.commit()
    await db.refresh(session)
    if manifest:
        await db.refresh(manifest)
    if alert:
        await db.refresh(alert)

    logger.info(
        f"Auto-count from run {payload.detection_run_id}: "
        f"{session.total_counted} objects ({counts}), conf>={payload.confidence_threshold}"
    )

    return ReconciliationResult(
        session=CountSessionResponse.model_validate(session),
        manifest=ManifestResponse.model_validate(manifest) if manifest else None,
        alert=MismatchAlertResponse.model_validate(alert) if alert else None,
        status=session.reconciliation_status,
    )


# ---------------------------------------------------------------------------
# Mismatch Alert Endpoints
# NOTE: /alerts/active MUST be defined before /alerts/{alert_id}/acknowledge
# so FastAPI matches the literal "active" path before the UUID parameter.
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=list[MismatchAlertResponse])
async def list_mismatch_alerts(
    acknowledged: Optional[bool] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List mismatch alerts."""
    query = select(MismatchAlert)
    if acknowledged is not None:
        query = query.where(MismatchAlert.acknowledged == acknowledged)
    if severity:
        query = query.where(MismatchAlert.severity == severity)
    result = await db.execute(query.order_by(MismatchAlert.created_at.desc()))
    return result.scalars().all()


@router.get("/alerts/active", response_model=list[MismatchAlertResponse])
async def get_active_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all unacknowledged mismatch alerts."""
    result = await db.execute(
        select(MismatchAlert)
        .where(MismatchAlert.acknowledged == False)
        .order_by(MismatchAlert.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/alerts/{alert_id}/acknowledge", response_model=MismatchAlertResponse)
async def acknowledge_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge a mismatch alert."""
    alert = await db.get(MismatchAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.acknowledged_by = str(current_user.id)
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return alert


# ---------------------------------------------------------------------------
# Tracking-Based Counting — uses DeepSORT persistent IDs
# ---------------------------------------------------------------------------

class TrackingCountRequest(BaseModel):
    tracking_session_id: uuid.UUID
    manifest_id: Optional[uuid.UUID] = None
    discrepancy_threshold_pct: float = Field(
        2.0, ge=0.0, le=100.0,
        description="Percentage discrepancy threshold to trigger reconciliation alert",
    )


@router.post("/track-count", response_model=ReconciliationResult, status_code=201)
async def count_from_tracking(
    payload: TrackingCountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Counting Agent v2: aggregates counts from a DeepSORT tracking session.
    Uses persistent object IDs to avoid double-counting — each unique track
    that crossed the counting line is counted exactly once.
    Triggers reconciliation workflow if discrepancy exceeds threshold.
    """
    from app.depot.vision.tracking import TrackingSession, TrackedObject, TrackingStatus

    ts = await db.get(TrackingSession, payload.tracking_session_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Tracking session not found")
    if ts.status != TrackingStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Tracking session is not completed")

    # Get counted objects (those that crossed the counting line)
    result = await db.execute(
        select(TrackedObject).where(
            TrackedObject.session_id == payload.tracking_session_id,
            TrackedObject.is_counted == True,
        )
    )
    counted_objects = result.scalars().all()

    # Tally by class
    counts: dict[str, int] = {}
    total_conf = 0.0
    for obj in counted_objects:
        counts[obj.class_label] = counts.get(obj.class_label, 0) + 1
        total_conf += obj.avg_confidence

    avg_conf = round(total_conf / len(counted_objects), 4) if counted_objects else 0.0

    session = CountSession(
        manifest_id=payload.manifest_id,
        detection_run_id=ts.detection_run_id,
        camera_id=ts.camera_id,
        counted_bags=counts.get("bag", 0),
        counted_boxes=counts.get("box", 0),
        counted_pallets=counts.get("pallet", 0),
        counted_cartons=counts.get("carton", 0),
        total_counted=sum(counts.values()),
        confidence_avg=avg_conf,
        counted_by=str(current_user.id),
    )
    db.add(session)
    await db.flush()

    manifest = None
    alert = None

    if payload.manifest_id:
        manifest = await db.get(ShipmentManifest, payload.manifest_id)
        if not manifest:
            raise HTTPException(status_code=404, detail="Manifest not found")

        session.discrepancy_bags = session.counted_bags - manifest.expected_bags
        session.discrepancy_boxes = session.counted_boxes - manifest.expected_boxes
        session.discrepancy_total = session.total_counted - manifest.total_expected

        # Check against percentage threshold
        disc_pct = (abs(session.discrepancy_total) / manifest.total_expected * 100) if manifest.total_expected > 0 else 0.0

        if disc_pct <= payload.discrepancy_threshold_pct and session.discrepancy_total == 0:
            session.reconciliation_status = ReconciliationStatus.MATCHED
            manifest.status = ManifestStatus.VERIFIED
            manifest.verified_at = datetime.now(timezone.utc)
            manifest.verified_by = str(current_user.id)
        else:
            session.reconciliation_status = ReconciliationStatus.MISMATCH
            manifest.status = ManifestStatus.DISCREPANCY

            abs_disc = abs(session.discrepancy_total)
            severity = "critical" if abs_disc >= 10 else "high" if abs_disc >= 5 else "medium" if abs_disc >= 2 else "low"

            alert = MismatchAlert(
                session_id=session.id,
                manifest_id=manifest.id,
                manifest_code=manifest.manifest_code,
                expected_total=manifest.total_expected,
                counted_total=session.total_counted,
                discrepancy=session.discrepancy_total,
                severity=severity,
                message=(
                    f"Tracking-based count mismatch for {manifest.manifest_code}: "
                    f"expected {manifest.total_expected}, tracked {session.total_counted} "
                    f"(diff: {session.discrepancy_total:+d}, {disc_pct:.1f}% variance, "
                    f"threshold: {payload.discrepancy_threshold_pct}%)"
                ),
            )
            db.add(alert)
            session.alert_sent = True

            try:
                priority_map = {"critical": "CRITICAL", "high": "HIGH", "medium": "NORMAL", "low": "LOW"}
                await NotificationService.send_alert(
                    db=db, user_id=current_user.id,
                    event_type="depot.counting.tracking_mismatch",
                    title=f"Tracking Count Mismatch — {manifest.manifest_code}",
                    message=alert.message,
                    priority=priority_map.get(severity, "NORMAL"),
                    payload={
                        "manifest_code": manifest.manifest_code,
                        "discrepancy": session.discrepancy_total,
                        "variance_pct": disc_pct,
                    },
                    channel="in_app",
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch tracking count notification: {e}")

    await db.commit()
    await db.refresh(session)
    if manifest:
        await db.refresh(manifest)
    if alert:
        await db.refresh(alert)

    logger.info(
        f"Tracking-based count from session {payload.tracking_session_id}: "
        f"{session.total_counted} unique objects ({counts})"
    )

    return ReconciliationResult(
        session=CountSessionResponse.model_validate(session),
        manifest=ManifestResponse.model_validate(manifest) if manifest else None,
        alert=MismatchAlertResponse.model_validate(alert) if alert else None,
        status=session.reconciliation_status,
    )


# ---------------------------------------------------------------------------
# Day 2 — DeepSORT MOT Tracking Models
# ---------------------------------------------------------------------------

class TrackingSessionStatus(str, Enum):
    ACTIVE = "active"
    FINALIZED = "finalized"
    CANCELLED = "cancelled"


class CountingTrackingSession(DBBaseModel):
    """Counting-specific tracking session (extends base tracking with tally fields)."""
    __tablename__ = "depot_counting_tracking_sessions"

    camera_id = Column(UUID(as_uuid=True), nullable=True)
    zone = Column(String, nullable=True)
    status = Column(String, default=TrackingSessionStatus.ACTIVE)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    total_tracks = Column(Integer, default=0)
    frame_count = Column(Integer, default=0)
    bags_tally = Column(Integer, default=0)
    boxes_tally = Column(Integer, default=0)
    pallets_tally = Column(Integer, default=0)
    cartons_tally = Column(Integer, default=0)
    manifest_id = Column(UUID(as_uuid=True), nullable=True)


class CountTimeSeries(DBBaseModel):
    """Time-series count snapshots for charting."""
    __tablename__ = "depot_count_timeseries"

    session_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tracking_session_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    bags = Column(Integer, default=0)
    boxes = Column(Integer, default=0)
    pallets = Column(Integer, default=0)
    cartons = Column(Integer, default=0)
    total = Column(Integer, default=0)
    cumulative = Column(Integer, default=0)


# ---------------------------------------------------------------------------
# Day 2 — DeepSORT Pydantic Schemas
# ---------------------------------------------------------------------------

class TrackingSessionInit(BaseModel):
    camera_id: Optional[uuid.UUID] = None
    zone: Optional[str] = None
    manifest_id: Optional[uuid.UUID] = None


class TrackingSessionResponse(BaseModel):
    id: uuid.UUID
    camera_id: Optional[uuid.UUID]
    zone: Optional[str]
    status: str
    started_at: datetime
    finalized_at: Optional[datetime]
    total_tracks: int
    frame_count: int
    bags_tally: int
    boxes_tally: int
    pallets_tally: int
    cartons_tally: int
    manifest_id: Optional[uuid.UUID]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FrameDetection(BaseModel):
    bbox: list[float] = Field(..., min_length=4, max_length=4, description="[x1, y1, x2, y2]")
    class_label: str = Field(..., description="bag, box, pallet, carton")
    confidence: float = Field(..., ge=0.0, le=1.0)


class FrameInput(BaseModel):
    detections: list[FrameDetection] = []
    frame_number: int = Field(..., ge=0)
    timestamp: Optional[datetime] = None


class TrackResult(BaseModel):
    track_id: int
    class_label: str
    confidence: float
    bbox: list[float]


class FrameResponse(BaseModel):
    session_id: uuid.UUID
    frame_number: int
    tracks: list[TrackResult]
    running_tally: dict[str, int]
    total_tracks: int


class CountTimeSeriesResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    tracking_session_id: Optional[uuid.UUID]
    timestamp: datetime
    bags: int
    boxes: int
    pallets: int
    cartons: int
    total: int
    cumulative: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReconciliationReport(BaseModel):
    total_sessions: int
    total_expected: int
    total_counted: int
    total_discrepancy: int
    matched_sessions: int
    mismatch_sessions: int
    pending_sessions: int
    match_rate_pct: float
    discrepancy_by_type: dict[str, int]
    active_alerts: int


class GoodsAuthorizationRequest(BaseModel):
    notes: Optional[str] = None


class GoodsAuthorizationResponse(BaseModel):
    session_id: uuid.UUID
    authorized: bool
    authorized_by: str
    authorized_at: datetime
    reconciliation_status: str
    message: str


# ---------------------------------------------------------------------------
# Day 2 — DeepSORT MOT Tracking Endpoints
# ---------------------------------------------------------------------------

@router.post("/tracking/init", response_model=TrackingSessionResponse, status_code=201)
async def init_tracking_session(
    payload: TrackingSessionInit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initialize a DeepSORT multi-object tracking session for a camera."""
    session = TrackingSession(
        camera_id=payload.camera_id,
        zone=payload.zone,
        manifest_id=payload.manifest_id,
        status=TrackingSessionStatus.ACTIVE,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    logger.info(f"Tracking session initialized: {session.id}, camera={payload.camera_id}")
    return session


@router.post("/tracking/{session_id}/frame", response_model=FrameResponse)
async def process_frame(
    session_id: uuid.UUID,
    payload: FrameInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Process a frame with DeepSORT tracking. Accepts bounding box detections,
    assigns persistent track IDs, and updates running tallies via Redis.
    """
    ts = await db.get(TrackingSession, session_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Tracking session not found")
    if ts.status != TrackingSessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Tracking session is not active")

    # Get or initialize track counter from in-memory store
    state_key = str(session_id)
    state = _tracking_state.get(state_key)
    if state is None:
        state = {"next_track_id": 1, "tally": {"bag": 0, "box": 0, "pallet": 0, "carton": 0}, "cumulative": 0}

    # Simulate DeepSORT: assign persistent track IDs to detections
    tracks: list[TrackResult] = []
    for det in payload.detections:
        if det.confidence < 0.85:
            continue
        track = TrackResult(
            track_id=state["next_track_id"],
            class_label=det.class_label,
            confidence=det.confidence,
            bbox=det.bbox,
        )
        tracks.append(track)
        state["next_track_id"] += 1
        label = det.class_label.lower()
        if label in state["tally"]:
            state["tally"][label] += 1

    frame_total = sum(state["tally"].values())
    state["cumulative"] = frame_total

    # Persist state in memory
    _tracking_state[state_key] = state

    # Update tracking session in DB
    ts.frame_count = payload.frame_number + 1
    ts.total_tracks = state["next_track_id"] - 1
    ts.bags_tally = state["tally"]["bag"]
    ts.boxes_tally = state["tally"]["box"]
    ts.pallets_tally = state["tally"]["pallet"]
    ts.cartons_tally = state["tally"]["carton"]

    # Write time-series data point
    ts_entry = CountTimeSeries(
        session_id=ts.id,
        tracking_session_id=ts.id,
        bags=state["tally"]["bag"],
        boxes=state["tally"]["box"],
        pallets=state["tally"]["pallet"],
        cartons=state["tally"]["carton"],
        total=len(tracks),
        cumulative=frame_total,
    )
    db.add(ts_entry)
    await db.commit()
    await db.refresh(ts)

    return FrameResponse(
        session_id=session_id,
        frame_number=payload.frame_number,
        tracks=tracks,
        running_tally=state["tally"],
        total_tracks=ts.total_tracks,
    )


@router.post("/tracking/{session_id}/finalize", response_model=ReconciliationResult, status_code=200)
async def finalize_tracking_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Finalize a DeepSORT tracking session. Computes final tallies,
    creates a CountSession, and optionally reconciles against a manifest.
    """
    ts = await db.get(TrackingSession, session_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Tracking session not found")
    if ts.status != TrackingSessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Tracking session is not active")

    ts.status = TrackingSessionStatus.FINALIZED
    ts.finalized_at = datetime.now(timezone.utc)

    # Create a CountSession from finalized tracking data
    session_payload = CountSessionCreate(
        manifest_id=ts.manifest_id,
        detection_run_id=None,
        camera_id=ts.camera_id,
        zone=ts.zone,
        counted_bags=ts.bags_tally,
        counted_boxes=ts.boxes_tally,
        counted_pallets=ts.pallets_tally,
        counted_cartons=ts.cartons_tally,
    )

    count_session = CountSession(**session_payload.model_dump())
    count_session.total_counted = ts.bags_tally + ts.boxes_tally + ts.pallets_tally + ts.cartons_tally
    count_session.counted_by = str(current_user.id)
    db.add(count_session)
    await db.flush()

    manifest = None
    alert = None

    if ts.manifest_id:
        manifest = await db.get(ShipmentManifest, ts.manifest_id)
        if manifest:
            count_session.discrepancy_bags = count_session.counted_bags - manifest.expected_bags
            count_session.discrepancy_boxes = count_session.counted_boxes - manifest.expected_boxes
            count_session.discrepancy_total = count_session.total_counted - manifest.total_expected

            if count_session.discrepancy_total == 0:
                count_session.reconciliation_status = ReconciliationStatus.MATCHED
                manifest.status = ManifestStatus.VERIFIED
                manifest.verified_at = datetime.now(timezone.utc)
                manifest.verified_by = str(current_user.id)
            else:
                count_session.reconciliation_status = ReconciliationStatus.MISMATCH
                manifest.status = ManifestStatus.DISCREPANCY

                abs_disc = abs(count_session.discrepancy_total)
                severity = "critical" if abs_disc >= 10 else "high" if abs_disc >= 5 else "medium" if abs_disc >= 2 else "low"

                alert = MismatchAlert(
                    session_id=count_session.id,
                    manifest_id=manifest.id,
                    manifest_code=manifest.manifest_code,
                    expected_total=manifest.total_expected,
                    counted_total=count_session.total_counted,
                    discrepancy=count_session.discrepancy_total,
                    severity=severity,
                    message=(
                        f"DeepSORT tracking mismatch for {manifest.manifest_code}: "
                        f"expected {manifest.total_expected}, tracked {count_session.total_counted} "
                        f"(diff: {count_session.discrepancy_total:+d}, frames: {ts.frame_count})"
                    ),
                )
                db.add(alert)
                count_session.alert_sent = True

    # Clean up in-memory state
    _tracking_state.pop(str(session_id), None)

    await db.commit()
    await db.refresh(count_session)
    if manifest:
        await db.refresh(manifest)
    if alert:
        await db.refresh(alert)

    logger.info(
        f"Tracking session {session_id} finalized: "
        f"{count_session.total_counted} objects, {ts.frame_count} frames"
    )

    return ReconciliationResult(
        session=CountSessionResponse.model_validate(count_session),
        manifest=ManifestResponse.model_validate(manifest) if manifest else None,
        alert=MismatchAlertResponse.model_validate(alert) if alert else None,
        status=count_session.reconciliation_status,
    )


@router.get("/sessions/{session_id}/timeseries", response_model=list[CountTimeSeriesResponse])
async def get_count_timeseries(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return count time-series snapshots for a tracking/counting session."""
    result = await db.execute(
        select(CountTimeSeries)
        .where(
            (CountTimeSeries.session_id == session_id)
            | (CountTimeSeries.tracking_session_id == session_id)
        )
        .order_by(CountTimeSeries.timestamp.asc())
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No time-series data found for this session")
    return rows


@router.get("/reconciliation/report", response_model=ReconciliationReport)
async def get_reconciliation_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a reconciliation summary report across all counting sessions."""
    result = await db.execute(select(CountSession).order_by(CountSession.created_at.desc()))
    sessions = result.scalars().all()

    total_expected = 0
    total_counted = 0
    matched = 0
    mismatched = 0
    pending = 0
    disc_bags = 0
    disc_boxes = 0

    for s in sessions:
        total_counted += s.total_counted
        if s.reconciliation_status == ReconciliationStatus.MATCHED:
            matched += 1
        elif s.reconciliation_status == ReconciliationStatus.MISMATCH:
            mismatched += 1
        else:
            pending += 1
        disc_bags += abs(s.discrepancy_bags)
        disc_boxes += abs(s.discrepancy_boxes)

    # Sum expected from manifests linked to sessions
    manifest_ids = {s.manifest_id for s in sessions if s.manifest_id}
    for mid in manifest_ids:
        m = await db.get(ShipmentManifest, mid)
        if m:
            total_expected += m.total_expected

    total_sessions = len(sessions)
    match_rate = round((matched / total_sessions * 100), 1) if total_sessions > 0 else 0.0

    # Active alerts count
    alert_result = await db.execute(
        select(func.count()).select_from(MismatchAlert).where(MismatchAlert.acknowledged == False)
    )
    active_alerts = alert_result.scalar() or 0

    return ReconciliationReport(
        total_sessions=total_sessions,
        total_expected=total_expected,
        total_counted=total_counted,
        total_discrepancy=total_counted - total_expected,
        matched_sessions=matched,
        mismatch_sessions=mismatched,
        pending_sessions=pending,
        match_rate_pct=match_rate,
        discrepancy_by_type={"bags": disc_bags, "boxes": disc_boxes},
        active_alerts=active_alerts,
    )


@router.post("/sessions/{session_id}/authorize", response_model=GoodsAuthorizationResponse)
async def authorize_goods_movement(
    session_id: uuid.UUID,
    payload: GoodsAuthorizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Authorize goods movement after counting session verification."""
    session = await db.get(CountSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Counting session not found")

    if session.reconciliation_status == ReconciliationStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Cannot authorize — session has not been reconciled yet"
        )

    if session.reconciliation_status == ReconciliationStatus.MISMATCH:
        # Allow override but mark it
        session.reconciliation_status = ReconciliationStatus.OVERRIDE
        message = "Goods movement authorized with override — mismatch acknowledged"
    else:
        message = "Goods movement authorized — counts verified"

    now = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)

    logger.info(f"Goods movement authorized for session {session_id} by {current_user.id}")

    return GoodsAuthorizationResponse(
        session_id=session.id,
        authorized=True,
        authorized_by=str(current_user.id),
        authorized_at=now,
        reconciliation_status=session.reconciliation_status,
        message=message,
    )
