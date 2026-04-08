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
from app.core.redis_client import get_redis
from app.core.notifications.service_compat import NotificationService
from app.shared.models.user import User
import redis.asyncio as aioredis

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
    expected_bags: int
    expected_boxes: int
    expected_pallets: int
    expected_cartons: int
    total_expected: int
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    redis: aioredis.Redis = Depends(get_redis),
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
                    redis=redis,
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
    redis: aioredis.Redis = Depends(get_redis),
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
                    db=db, redis=redis, user_id=current_user.id,
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
