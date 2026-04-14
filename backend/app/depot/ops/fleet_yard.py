"""
IntelliOps™ — Fleet & Yard View Module
Features: F-064 (Fleet GPS Tracking), F-066 (Dwell Time Analytics),
          F-068 (Queue Optimization Recommendation Engine)

Keerthi: Fleet GPS tracking API — ingestion of GPS feeds, vehicle position state in Redis.
Pranisree: Dwell time analytics — per-vehicle dwell timer, >2 hr threshold alert via RabbitMQ.
           Queue optimization — ranks vehicles by wait time, suggests optimal dock assignment.
"""
import uuid
import logging
import random
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.core.redis_client import get_redis
from app.shared.models.user import User
import redis.asyncio as aioredis

logger = logging.getLogger("intelli.ops.fleet_yard")

router = APIRouter(prefix="/ops/fleet", tags=["IntelliOps - Fleet & Yard"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class VehicleStatus(str, Enum):
    IN_TRANSIT = "in_transit"
    AT_GATE = "at_gate"
    IN_YARD = "in_yard"
    AT_DOCK = "at_dock"
    DEPARTED = "departed"
    IDLE = "idle"


class DockStatus(str, Enum):
    FREE = "free"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    MAINTENANCE = "maintenance"


class DwellAlertLevel(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"       # > 1 hr
    CRITICAL = "critical"     # > 2 hr


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class Vehicle(DBBaseModel):
    """Fleet vehicle with latest GPS position."""
    __tablename__ = "ops_vehicles"

    vehicle_id = Column(String, nullable=False, unique=True, index=True)  # plate or fleet code
    vehicle_type = Column(String, default="truck")                        # truck, trailer, van
    driver_name = Column(String, nullable=True)
    driver_contact = Column(String, nullable=True)
    status = Column(String, default=VehicleStatus.IN_TRANSIT, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    speed_kmh = Column(Float, default=0)
    heading = Column(Float, default=0)                                    # 0-360 degrees
    current_zone = Column(String, nullable=True, index=True)              # yard zone ID
    assigned_dock = Column(String, nullable=True)
    entered_yard_at = Column(DateTime(timezone=True), nullable=True)
    last_gps_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)


class DockSlot(DBBaseModel):
    """Dock bay in the yard."""
    __tablename__ = "ops_dock_slots"

    dock_id = Column(String, nullable=False, unique=True, index=True)     # e.g., "DOCK-A1"
    dock_name = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    status = Column(String, default=DockStatus.FREE, index=True)
    assigned_vehicle_id = Column(String, nullable=True)
    reserved_for = Column(String, nullable=True)                          # vehicle_id of reservation
    reserved_from = Column(DateTime(timezone=True), nullable=True)
    reserved_until = Column(DateTime(timezone=True), nullable=True)
    capacity_tonnes = Column(Float, default=20.0)
    dock_type = Column(String, default="standard")                        # standard, refrigerated, hazmat
    x_position = Column(Float, default=0)                                 # SVG x for yard map
    y_position = Column(Float, default=0)                                 # SVG y for yard map


class DwellRecord(DBBaseModel):
    """Per-vehicle dwell time tracking."""
    __tablename__ = "ops_dwell_records"

    vehicle_id = Column(String, nullable=False, index=True)
    vehicle_type = Column(String, nullable=True)
    zone = Column(String, nullable=True, index=True)
    dock_id = Column(String, nullable=True)
    entered_at = Column(DateTime(timezone=True), nullable=False)
    exited_at = Column(DateTime(timezone=True), nullable=True)
    dwell_minutes = Column(Float, default=0)
    alert_level = Column(String, default=DwellAlertLevel.NORMAL, index=True)
    alert_sent = Column(Boolean, default=False)
    metadata_json = Column(JSON, nullable=True)


class DockSchedule(DBBaseModel):
    """Dock booking / scheduling entry."""
    __tablename__ = "ops_dock_schedules"

    dock_id = Column(String, nullable=False, index=True)
    vehicle_id = Column(String, nullable=True)
    client_name = Column(String, nullable=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=False)
    scheduled_end = Column(DateTime(timezone=True), nullable=False)
    actual_arrival = Column(DateTime(timezone=True), nullable=True)
    actual_departure = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="scheduled", index=True)              # scheduled, active, completed, cancelled
    delay_risk = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

# --- Vehicle / GPS ---

class GPSUpdate(BaseModel):
    vehicle_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    speed_kmh: float = Field(default=0, ge=0)
    heading: float = Field(default=0, ge=0, le=360)
    vehicle_type: Optional[str] = "truck"
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    metadata_json: Optional[dict] = None


class GPSBatch(BaseModel):
    updates: list[GPSUpdate] = Field(..., min_length=1)


class VehicleResponse(BaseModel):
    id: uuid.UUID
    vehicle_id: str
    vehicle_type: Optional[str]
    driver_name: Optional[str]
    driver_contact: Optional[str]
    status: str
    latitude: Optional[float]
    longitude: Optional[float]
    speed_kmh: Optional[float]
    heading: Optional[float]
    current_zone: Optional[str]
    assigned_dock: Optional[str]
    entered_yard_at: Optional[datetime]
    last_gps_at: Optional[datetime]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Dock Slots ---

class DockSlotCreate(BaseModel):
    dock_id: str
    dock_name: Optional[str] = None
    zone: Optional[str] = None
    capacity_tonnes: float = 20.0
    dock_type: str = "standard"
    x_position: float = 0
    y_position: float = 0


class DockSlotResponse(BaseModel):
    id: uuid.UUID
    dock_id: str
    dock_name: Optional[str]
    zone: Optional[str]
    status: str
    assigned_vehicle_id: Optional[str]
    reserved_for: Optional[str]
    reserved_from: Optional[datetime]
    reserved_until: Optional[datetime]
    capacity_tonnes: float
    dock_type: str
    x_position: float
    y_position: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Dwell Time ---

class DwellRecordResponse(BaseModel):
    id: uuid.UUID
    vehicle_id: str
    vehicle_type: Optional[str]
    zone: Optional[str]
    dock_id: Optional[str]
    entered_at: datetime
    exited_at: Optional[datetime]
    dwell_minutes: float
    alert_level: str
    alert_sent: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DwellHeatmapEntry(BaseModel):
    zone: str
    avg_dwell_minutes: float
    total_vehicles: int
    over_threshold_count: int


# --- Dock Schedule ---

class DockScheduleCreate(BaseModel):
    dock_id: str
    vehicle_id: Optional[str] = None
    client_name: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    notes: Optional[str] = None


class DockScheduleResponse(BaseModel):
    id: uuid.UUID
    dock_id: str
    vehicle_id: Optional[str]
    client_name: Optional[str]
    scheduled_start: datetime
    scheduled_end: datetime
    actual_arrival: Optional[datetime]
    actual_departure: Optional[datetime]
    status: str
    delay_risk: bool
    notes: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Queue Optimization ---

class QueueRecommendation(BaseModel):
    vehicle_id: str
    vehicle_type: Optional[str]
    wait_minutes: float
    recommended_dock: str
    dock_type: str
    priority_score: float
    reason: str


class QueueOptimizationResult(BaseModel):
    recommendations: list[QueueRecommendation]
    total_vehicles_waiting: int
    avg_wait_minutes: float
    generated_at: datetime


# ---------------------------------------------------------------------------
# F-064 — Fleet GPS Tracking API
# ---------------------------------------------------------------------------

YARD_BOUNDARY = {
    "lat_min": 12.95, "lat_max": 13.05,
    "lng_min": 77.55, "lng_max": 77.65,
}

YARD_ZONES = {
    "inbound_gate":  {"lat_min": 12.950, "lat_max": 12.960, "lng_min": 77.550, "lng_max": 77.570},
    "staging_area":  {"lat_min": 12.960, "lat_max": 12.980, "lng_min": 77.550, "lng_max": 77.590},
    "dock_area":     {"lat_min": 12.980, "lat_max": 13.000, "lng_min": 77.570, "lng_max": 77.610},
    "cold_storage":  {"lat_min": 12.970, "lat_max": 12.990, "lng_min": 77.610, "lng_max": 77.640},
    "parking_yard":  {"lat_min": 13.000, "lat_max": 13.020, "lng_min": 77.550, "lng_max": 77.600},
    "outbound_gate": {"lat_min": 13.020, "lat_max": 13.050, "lng_min": 77.580, "lng_max": 77.620},
}


def _detect_zone(lat: float, lng: float) -> Optional[str]:
    for zone_name, bounds in YARD_ZONES.items():
        if (bounds["lat_min"] <= lat <= bounds["lat_max"] and
                bounds["lng_min"] <= lng <= bounds["lng_max"]):
            return zone_name
    return None


def _detect_status(zone: Optional[str], speed: float) -> str:
    if zone is None:
        return VehicleStatus.IN_TRANSIT
    if speed < 2:
        if zone == "dock_area":
            return VehicleStatus.AT_DOCK
        if zone in ("inbound_gate", "outbound_gate"):
            return VehicleStatus.AT_GATE
        return VehicleStatus.IN_YARD
    return VehicleStatus.IN_YARD


@router.post("/gps", response_model=VehicleResponse, status_code=201)
async def ingest_gps(
    body: GPSUpdate,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """Ingest a single GPS position update for a vehicle (F-064)."""
    now = datetime.now(timezone.utc)
    zone = _detect_zone(body.latitude, body.longitude)
    status = _detect_status(zone, body.speed_kmh)

    # Upsert vehicle
    result = await db.execute(
        select(Vehicle).where(Vehicle.vehicle_id == body.vehicle_id)
    )
    vehicle = result.scalar_one_or_none()

    if vehicle:
        vehicle.latitude = body.latitude
        vehicle.longitude = body.longitude
        vehicle.speed_kmh = body.speed_kmh
        vehicle.heading = body.heading
        vehicle.current_zone = zone
        vehicle.status = status
        vehicle.last_gps_at = now
        if body.driver_name:
            vehicle.driver_name = body.driver_name
        if body.driver_contact:
            vehicle.driver_contact = body.driver_contact
        # Track yard entry
        if zone and not vehicle.entered_yard_at:
            vehicle.entered_yard_at = now
    else:
        vehicle = Vehicle(
            vehicle_id=body.vehicle_id,
            vehicle_type=body.vehicle_type,
            driver_name=body.driver_name,
            driver_contact=body.driver_contact,
            latitude=body.latitude,
            longitude=body.longitude,
            speed_kmh=body.speed_kmh,
            heading=body.heading,
            current_zone=zone,
            status=status,
            entered_yard_at=now if zone else None,
            last_gps_at=now,
            metadata_json=body.metadata_json,
        )
        db.add(vehicle)

    await db.flush()

    # Cache position in Redis for sub-5s dashboard refresh
    try:
        import json
        await redis.setex(
            f"ops:vehicle:{body.vehicle_id}",
            30,
            json.dumps({
                "vehicle_id": body.vehicle_id,
                "lat": body.latitude,
                "lng": body.longitude,
                "speed": body.speed_kmh,
                "zone": zone,
                "status": status,
                "ts": now.isoformat(),
            }),
        )
    except Exception:
        pass

    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.post("/gps/batch", response_model=dict)
async def ingest_gps_batch(
    body: GPSBatch,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """Batch ingest GPS updates (F-064)."""
    now = datetime.now(timezone.utc)
    ingested = 0
    for upd in body.updates:
        zone = _detect_zone(upd.latitude, upd.longitude)
        status = _detect_status(zone, upd.speed_kmh)
        result = await db.execute(
            select(Vehicle).where(Vehicle.vehicle_id == upd.vehicle_id)
        )
        vehicle = result.scalar_one_or_none()
        if vehicle:
            vehicle.latitude = upd.latitude
            vehicle.longitude = upd.longitude
            vehicle.speed_kmh = upd.speed_kmh
            vehicle.heading = upd.heading
            vehicle.current_zone = zone
            vehicle.status = status
            vehicle.last_gps_at = now
            if zone and not vehicle.entered_yard_at:
                vehicle.entered_yard_at = now
        else:
            db.add(Vehicle(
                vehicle_id=upd.vehicle_id,
                vehicle_type=upd.vehicle_type,
                driver_name=upd.driver_name,
                latitude=upd.latitude,
                longitude=upd.longitude,
                speed_kmh=upd.speed_kmh,
                heading=upd.heading,
                current_zone=zone,
                status=status,
                entered_yard_at=now if zone else None,
                last_gps_at=now,
            ))
        ingested += 1
    await db.commit()
    return {"ingested": ingested, "timestamp": now.isoformat()}


@router.get("/vehicles", response_model=list[VehicleResponse])
async def list_vehicles(
    status: Optional[str] = None,
    zone: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tracked vehicles, optionally filtered by status or zone."""
    q = select(Vehicle)
    if status:
        q = q.where(Vehicle.status == status)
    if zone:
        q = q.where(Vehicle.current_zone == zone)
    q = q.order_by(desc(Vehicle.last_gps_at)).limit(limit)
    result = await db.execute(q)
    return [VehicleResponse.model_validate(v) for v in result.scalars().all()]


@router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    return VehicleResponse.model_validate(vehicle)


@router.get("/vehicles/yard/summary", response_model=dict)
async def yard_vehicle_summary(
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
):
    """KPI summary of vehicles currently in the yard."""
    result = await db.execute(
        select(
            Vehicle.status,
            func.count(Vehicle.id).label("count"),
        ).group_by(Vehicle.status)
    )
    by_status = {row.status: row.count for row in result.all()}

    result = await db.execute(
        select(
            Vehicle.current_zone,
            func.count(Vehicle.id).label("count"),
        ).where(Vehicle.current_zone.isnot(None))
        .group_by(Vehicle.current_zone)
    )
    by_zone = {row.current_zone: row.count for row in result.all()}

    total_in_yard = sum(
        v for k, v in by_status.items()
        if k in (VehicleStatus.IN_YARD, VehicleStatus.AT_DOCK, VehicleStatus.AT_GATE)
    )

    # Cache for dashboard
    try:
        import json
        await redis.setex("ops:yard_summary", 30, json.dumps({
            "total_in_yard": total_in_yard,
            "by_status": by_status,
            "by_zone": by_zone,
        }))
    except Exception:
        pass

    return {
        "total_in_yard": total_in_yard,
        "by_status": by_status,
        "by_zone": by_zone,
    }


# ---------------------------------------------------------------------------
# Dock Slot Management
# ---------------------------------------------------------------------------

@router.post("/docks", response_model=DockSlotResponse, status_code=201)
async def create_dock_slot(
    body: DockSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a dock bay in the yard."""
    dock = DockSlot(**body.model_dump())
    db.add(dock)
    await db.commit()
    await db.refresh(dock)
    return DockSlotResponse.model_validate(dock)


@router.get("/docks", response_model=list[DockSlotResponse])
async def list_dock_slots(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(DockSlot)
    if status:
        q = q.where(DockSlot.status == status)
    q = q.order_by(DockSlot.dock_id)
    result = await db.execute(q)
    return [DockSlotResponse.model_validate(d) for d in result.scalars().all()]


@router.patch("/docks/{dock_id}/assign", response_model=DockSlotResponse)
async def assign_vehicle_to_dock(
    dock_id: str,
    vehicle_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign a vehicle to a dock slot."""
    result = await db.execute(select(DockSlot).where(DockSlot.dock_id == dock_id))
    dock = result.scalar_one_or_none()
    if not dock:
        raise HTTPException(404, "Dock slot not found")
    if dock.status == DockStatus.OCCUPIED:
        raise HTTPException(400, f"Dock {dock_id} is already occupied")

    dock.status = DockStatus.OCCUPIED
    dock.assigned_vehicle_id = vehicle_id

    # Update vehicle status
    vr = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id))
    vehicle = vr.scalar_one_or_none()
    if vehicle:
        vehicle.assigned_dock = dock_id
        vehicle.status = VehicleStatus.AT_DOCK

    await db.commit()
    await db.refresh(dock)
    return DockSlotResponse.model_validate(dock)


@router.patch("/docks/{dock_id}/release", response_model=DockSlotResponse)
async def release_dock(
    dock_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Release a dock slot."""
    result = await db.execute(select(DockSlot).where(DockSlot.dock_id == dock_id))
    dock = result.scalar_one_or_none()
    if not dock:
        raise HTTPException(404, "Dock slot not found")

    # Clear vehicle assignment
    if dock.assigned_vehicle_id:
        vr = await db.execute(
            select(Vehicle).where(Vehicle.vehicle_id == dock.assigned_vehicle_id)
        )
        vehicle = vr.scalar_one_or_none()
        if vehicle:
            vehicle.assigned_dock = None
            vehicle.status = VehicleStatus.IN_YARD

    dock.status = DockStatus.FREE
    dock.assigned_vehicle_id = None
    dock.reserved_for = None
    await db.commit()
    await db.refresh(dock)
    return DockSlotResponse.model_validate(dock)


# ---------------------------------------------------------------------------
# F-066 — Dwell Time Analytics
# ---------------------------------------------------------------------------

DWELL_WARNING_MINUTES = 60
DWELL_CRITICAL_MINUTES = 120


@router.post("/dwell/check-in", response_model=DwellRecordResponse, status_code=201)
async def dwell_check_in(
    vehicle_id: str = Query(...),
    zone: Optional[str] = None,
    dock_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record vehicle check-in for dwell time tracking (F-066)."""
    # Look up vehicle type
    vr = await db.execute(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id))
    vehicle = vr.scalar_one_or_none()

    record = DwellRecord(
        vehicle_id=vehicle_id,
        vehicle_type=vehicle.vehicle_type if vehicle else None,
        zone=zone,
        dock_id=dock_id,
        entered_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return DwellRecordResponse.model_validate(record)


@router.patch("/dwell/{record_id}/check-out", response_model=DwellRecordResponse)
async def dwell_check_out(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record vehicle departure, calculate final dwell time."""
    result = await db.execute(select(DwellRecord).where(DwellRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Dwell record not found")

    now = datetime.now(timezone.utc)
    record.exited_at = now
    delta = now - record.entered_at
    record.dwell_minutes = delta.total_seconds() / 60
    await db.commit()
    await db.refresh(record)
    return DwellRecordResponse.model_validate(record)


@router.post("/dwell/evaluate-alerts", response_model=dict)
async def evaluate_dwell_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Periodic evaluation: flag vehicles exceeding dwell thresholds (F-066).
    >1 hr = WARNING, >2 hr = CRITICAL + RabbitMQ alert to Yard Controller.
    """
    now = datetime.now(timezone.utc)
    warnings = 0
    criticals = 0

    # Find all active dwell records (no exit)
    result = await db.execute(
        select(DwellRecord).where(DwellRecord.exited_at.is_(None))
    )
    for record in result.scalars().all():
        dwell_minutes = (now - record.entered_at).total_seconds() / 60
        record.dwell_minutes = dwell_minutes

        if dwell_minutes >= DWELL_CRITICAL_MINUTES:
            record.alert_level = DwellAlertLevel.CRITICAL
            criticals += 1
            if not record.alert_sent:
                record.alert_sent = True
                try:
                    from app.core.rabbitmq import publish_alert
                    await publish_alert(
                        alert_type="dwell_time",
                        severity="critical",
                        payload={
                            "vehicle_id": record.vehicle_id,
                            "zone": record.zone,
                            "dock_id": record.dock_id,
                            "dwell_minutes": round(dwell_minutes, 1),
                            "threshold_minutes": DWELL_CRITICAL_MINUTES,
                        },
                    )
                except Exception:
                    logger.warning("RabbitMQ unavailable — dwell alert logged only")
        elif dwell_minutes >= DWELL_WARNING_MINUTES:
            record.alert_level = DwellAlertLevel.WARNING
            warnings += 1

    await db.commit()
    return {
        "evaluated_at": now.isoformat(),
        "warnings": warnings,
        "criticals": criticals,
    }


@router.get("/dwell/active", response_model=list[DwellRecordResponse])
async def list_active_dwell(
    zone: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all vehicles currently dwelling (no checkout)."""
    q = select(DwellRecord).where(DwellRecord.exited_at.is_(None))
    if zone:
        q = q.where(DwellRecord.zone == zone)
    q = q.order_by(DwellRecord.entered_at)
    result = await db.execute(q)
    return [DwellRecordResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/dwell/heatmap", response_model=list[DwellHeatmapEntry])
async def dwell_heatmap(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate dwell time data by zone for heatmap visualization (F-066)."""
    result = await db.execute(
        select(
            DwellRecord.zone,
            func.avg(DwellRecord.dwell_minutes).label("avg_dwell"),
            func.count(DwellRecord.id).label("total"),
            func.count(
                func.nullif(DwellRecord.alert_level == DwellAlertLevel.NORMAL, True)
            ).label("over_threshold"),
        )
        .where(DwellRecord.zone.isnot(None))
        .group_by(DwellRecord.zone)
    )
    return [
        DwellHeatmapEntry(
            zone=row.zone,
            avg_dwell_minutes=round(float(row.avg_dwell or 0), 1),
            total_vehicles=row.total,
            over_threshold_count=row.over_threshold,
        )
        for row in result.all()
    ]


# ---------------------------------------------------------------------------
# Dock Scheduling (supports F-067 UI)
# ---------------------------------------------------------------------------

@router.post("/schedules", response_model=DockScheduleResponse, status_code=201)
async def create_dock_schedule(
    body: DockScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Book a dock slot in advance (F-067)."""
    # Check dock exists
    dr = await db.execute(select(DockSlot).where(DockSlot.dock_id == body.dock_id))
    dock = dr.scalar_one_or_none()
    if not dock:
        raise HTTPException(404, f"Dock {body.dock_id} not found")

    # Check for overlapping bookings
    result = await db.execute(
        select(DockSchedule).where(
            DockSchedule.dock_id == body.dock_id,
            DockSchedule.status.in_(["scheduled", "active"]),
            DockSchedule.scheduled_start < body.scheduled_end,
            DockSchedule.scheduled_end > body.scheduled_start,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(409, "Time slot conflicts with existing booking")

    schedule = DockSchedule(**body.model_dump())
    db.add(schedule)

    # Mark dock as reserved
    dock.status = DockStatus.RESERVED
    dock.reserved_for = body.vehicle_id
    dock.reserved_from = body.scheduled_start
    dock.reserved_until = body.scheduled_end

    await db.commit()
    await db.refresh(schedule)
    return DockScheduleResponse.model_validate(schedule)


@router.get("/schedules", response_model=list[DockScheduleResponse])
async def list_dock_schedules(
    dock_id: Optional[str] = None,
    week_offset: int = Query(default=0, ge=-4, le=4),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List dock schedules for a given week (F-067)."""
    now = datetime.now(timezone.utc)
    start_of_week = now - timedelta(days=now.weekday()) + timedelta(weeks=week_offset)
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + timedelta(days=7)

    q = select(DockSchedule).where(
        DockSchedule.scheduled_start >= start_of_week,
        DockSchedule.scheduled_start < end_of_week,
    )
    if dock_id:
        q = q.where(DockSchedule.dock_id == dock_id)
    q = q.order_by(DockSchedule.scheduled_start)
    result = await db.execute(q)
    return [DockScheduleResponse.model_validate(s) for s in result.scalars().all()]


@router.delete("/schedules/{schedule_id}", status_code=204)
async def cancel_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(DockSchedule).where(DockSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    schedule.status = "cancelled"

    # Release dock reservation
    dr = await db.execute(select(DockSlot).where(DockSlot.dock_id == schedule.dock_id))
    dock = dr.scalar_one_or_none()
    if dock and dock.reserved_for == schedule.vehicle_id:
        dock.status = DockStatus.FREE
        dock.reserved_for = None

    await db.commit()


# ---------------------------------------------------------------------------
# F-068 — Queue Optimization Recommendation Engine
# ---------------------------------------------------------------------------

@router.get("/queue/optimize", response_model=QueueOptimizationResult)
async def optimize_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dwell Time Optimization Agent: ranks waiting vehicles by dwell time,
    suggests optimal dock assignment based on dock availability and vehicle type (F-068).
    """
    now = datetime.now(timezone.utc)

    # Get all vehicles waiting in yard (not at dock, not departed)
    vr = await db.execute(
        select(Vehicle).where(
            Vehicle.status.in_([VehicleStatus.IN_YARD, VehicleStatus.AT_GATE, VehicleStatus.IDLE]),
            Vehicle.current_zone.isnot(None),
        ).order_by(Vehicle.entered_yard_at)
    )
    waiting_vehicles = vr.scalars().all()

    # Get all free dock slots
    dr = await db.execute(
        select(DockSlot).where(DockSlot.status == DockStatus.FREE).order_by(DockSlot.dock_id)
    )
    free_docks = list(dr.scalars().all())

    recommendations: list[QueueRecommendation] = []
    dock_idx = 0

    for vehicle in waiting_vehicles:
        wait_minutes = 0.0
        if vehicle.entered_yard_at:
            wait_minutes = (now - vehicle.entered_yard_at).total_seconds() / 60

        # Priority: longer wait → higher score
        priority_score = min(100, wait_minutes / 2)  # 0-100 scale, 200 min = max

        # Match dock type to vehicle type where possible
        best_dock = None
        if dock_idx < len(free_docks):
            # Prefer refrigerated dock for refrigerated trucks
            if vehicle.vehicle_type == "refrigerated":
                for d in free_docks[dock_idx:]:
                    if d.dock_type == "refrigerated" and d.status == DockStatus.FREE:
                        best_dock = d
                        break
            if not best_dock:
                best_dock = free_docks[dock_idx]
                dock_idx += 1

        if best_dock:
            reason = f"Longest wait ({round(wait_minutes)}min)"
            if vehicle.vehicle_type == "refrigerated" and best_dock.dock_type == "refrigerated":
                reason += " + type-matched dock"
            recommendations.append(QueueRecommendation(
                vehicle_id=vehicle.vehicle_id,
                vehicle_type=vehicle.vehicle_type,
                wait_minutes=round(wait_minutes, 1),
                recommended_dock=best_dock.dock_id,
                dock_type=best_dock.dock_type,
                priority_score=round(priority_score, 1),
                reason=reason,
            ))
        else:
            recommendations.append(QueueRecommendation(
                vehicle_id=vehicle.vehicle_id,
                vehicle_type=vehicle.vehicle_type,
                wait_minutes=round(wait_minutes, 1),
                recommended_dock="NONE",
                dock_type="n/a",
                priority_score=round(priority_score, 1),
                reason="No dock available — vehicle queued",
            ))

    avg_wait = (
        sum(r.wait_minutes for r in recommendations) / len(recommendations)
        if recommendations else 0
    )

    return QueueOptimizationResult(
        recommendations=sorted(recommendations, key=lambda r: r.priority_score, reverse=True),
        total_vehicles_waiting=len(waiting_vehicles),
        avg_wait_minutes=round(avg_wait, 1),
        generated_at=now,
    )


@router.get("/queue/departure-schedule", response_model=list[dict])
async def departure_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Live queue counter + departure schedule with delay risk scoring (Day 4 UI support)."""
    now = datetime.now(timezone.utc)

    # Vehicles at dock
    result = await db.execute(
        select(Vehicle).where(Vehicle.status == VehicleStatus.AT_DOCK).order_by(Vehicle.entered_yard_at)
    )
    at_dock = result.scalars().all()

    schedule = []
    for v in at_dock:
        dwell = 0.0
        if v.entered_yard_at:
            dwell = (now - v.entered_yard_at).total_seconds() / 60
        delay_risk = dwell > DWELL_WARNING_MINUTES
        schedule.append({
            "vehicle_id": v.vehicle_id,
            "dock": v.assigned_dock,
            "dwell_minutes": round(dwell, 1),
            "delay_risk": delay_risk,
            "status": v.status,
            "entered_yard_at": v.entered_yard_at.isoformat() if v.entered_yard_at else None,
        })

    return schedule
