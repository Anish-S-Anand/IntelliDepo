"""
Intelli Depot — Cluster Mapping
Feature: DEPOT-V4

Spatial heatmap engine with IoT sensor data ingestion, density analytics,
and capacity threshold alert triggers.
"""
import uuid
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.cluster")

router = APIRouter(prefix="/depot/vision/cluster", tags=["Depot - Cluster Mapping"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ZoneStatus(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class DepotZone(DBBaseModel):
    """Physical zone definition within the depot."""
    __tablename__ = "depot_zones"

    zone_code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    zone_type = Column(String, default="storage")   # storage, staging, loading, cold, hazmat
    floor = Column(String, default="ground")
    area_sqm = Column(Float, nullable=True)
    max_capacity_units = Column(Integer, default=1000)
    current_occupancy = Column(Integer, default=0)
    utilization_pct = Column(Float, default=0.0)
    status = Column(String, default=ZoneStatus.NORMAL)
    polygon_coords = Column(JSON, nullable=True)  # [[x,y], ...] for map rendering
    assigned_cameras = Column(JSON, nullable=True)  # list of camera UUIDs
    is_active = Column(Boolean, default=True)


class SensorReading(DBBaseModel):
    """IoT sensor data point ingested from depot sensors."""
    __tablename__ = "depot_sensor_readings"

    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sensor_id = Column(String, nullable=False, index=True)
    sensor_type = Column(String, nullable=False)  # temperature, humidity, occupancy, weight, motion
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=True)  # celsius, %, count, kg
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_anomaly = Column(Boolean, default=False)


class CapacityAlert(DBBaseModel):
    """Alert triggered when a zone exceeds capacity threshold."""
    __tablename__ = "depot_capacity_alerts"

    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    zone_code = Column(String, nullable=True)
    threshold_pct = Column(Float, nullable=False)
    current_pct = Column(Float, nullable=False)
    severity = Column(String, default="warning")
    message = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ZoneCreate(BaseModel):
    zone_code: str = Field(..., json_schema_extra={"example": "Z-A01"})
    name: str = Field(..., json_schema_extra={"example": "Storage Bay A1"})
    zone_type: str = Field("storage")
    floor: str = Field("ground")
    area_sqm: Optional[float] = None
    max_capacity_units: int = Field(1000, ge=1)
    polygon_coords: Optional[list] = None
    assigned_cameras: Optional[list] = None


class ZoneResponse(BaseModel):
    id: uuid.UUID
    zone_code: str
    name: str
    zone_type: str
    floor: str
    area_sqm: Optional[float]
    max_capacity_units: int
    current_occupancy: int
    utilization_pct: float
    status: str
    polygon_coords: Optional[list]
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ZoneOccupancyUpdate(BaseModel):
    current_occupancy: int = Field(..., ge=0)


class SensorReadingCreate(BaseModel):
    zone_id: uuid.UUID
    sensor_id: str = Field(..., json_schema_extra={"example": "TEMP-A01-01"})
    sensor_type: str = Field(..., json_schema_extra={"example": "temperature"})
    value: float
    unit: Optional[str] = None


class SensorReadingResponse(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    sensor_id: str
    sensor_type: str
    value: float
    unit: Optional[str]
    timestamp: datetime
    is_anomaly: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CapacityAlertResponse(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    zone_code: Optional[str]
    threshold_pct: float
    current_pct: float
    severity: str
    message: Optional[str]
    resolved: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HeatmapEntry(BaseModel):
    zone_code: str
    name: str
    utilization_pct: float
    status: str
    current_occupancy: int
    max_capacity_units: int


# ---------------------------------------------------------------------------
# Zone Endpoints
# ---------------------------------------------------------------------------

@router.post("/zones", response_model=ZoneResponse, status_code=201)
async def create_zone(
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Define a new depot zone for cluster mapping."""
    existing = await db.execute(
        select(DepotZone).where(DepotZone.zone_code == payload.zone_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Zone code already exists")

    zone = DepotZone(**payload.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    logger.info(f"Zone created: {zone.zone_code}")
    return zone


@router.get("/zones", response_model=list[ZoneResponse])
async def list_zones(
    zone_type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(DepotZone).where(DepotZone.is_active == True)
    if zone_type:
        query = query.where(DepotZone.zone_type == zone_type)
    if status:
        query = query.where(DepotZone.status == status)
    result = await db.execute(query.order_by(DepotZone.zone_code))
    return result.scalars().all()


@router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    zone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zone = await db.get(DepotZone, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.patch("/zones/{zone_id}/occupancy", response_model=ZoneResponse)
async def update_occupancy(
    zone_id: uuid.UUID,
    payload: ZoneOccupancyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update zone occupancy and recalculate utilization. Triggers capacity alert if threshold exceeded."""
    zone = await db.get(DepotZone, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=404, detail="Zone not found")

    zone.current_occupancy = payload.current_occupancy
    zone.utilization_pct = round(
        (payload.current_occupancy / zone.max_capacity_units) * 100, 1
    ) if zone.max_capacity_units > 0 else 0.0

    # Status thresholds
    if zone.utilization_pct >= 95:
        zone.status = ZoneStatus.CRITICAL
    elif zone.utilization_pct >= 80:
        zone.status = ZoneStatus.WARNING
    else:
        zone.status = ZoneStatus.NORMAL

    # Dispatch capacity alert if warning/critical
    if zone.utilization_pct >= 80:
        severity = "critical" if zone.utilization_pct >= 95 else "warning"
        alert = CapacityAlert(
            zone_id=zone.id,
            zone_code=zone.zone_code,
            threshold_pct=80.0 if severity == "warning" else 95.0,
            current_pct=zone.utilization_pct,
            severity=severity,
            message=f"Zone {zone.zone_code} at {zone.utilization_pct}% capacity",
        )
        db.add(alert)

    await db.commit()
    await db.refresh(zone)
    return zone


# ---------------------------------------------------------------------------
# Heatmap Endpoint
# ---------------------------------------------------------------------------

@router.get("/heatmap", response_model=list[HeatmapEntry])
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get spatial heatmap data — utilization across all active zones."""
    result = await db.execute(
        select(DepotZone).where(DepotZone.is_active == True).order_by(DepotZone.zone_code)
    )
    zones = result.scalars().all()
    return [
        HeatmapEntry(
            zone_code=z.zone_code,
            name=z.name,
            utilization_pct=z.utilization_pct,
            status=z.status,
            current_occupancy=z.current_occupancy,
            max_capacity_units=z.max_capacity_units,
        )
        for z in zones
    ]


# ---------------------------------------------------------------------------
# Sensor Endpoints
# ---------------------------------------------------------------------------

@router.post("/sensors/readings", response_model=SensorReadingResponse, status_code=201)
async def ingest_sensor_reading(
    payload: SensorReadingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ingest an IoT sensor data point."""
    zone = await db.get(DepotZone, payload.zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    reading = SensorReading(**payload.model_dump())
    db.add(reading)
    await db.commit()
    await db.refresh(reading)
    return reading


@router.get("/sensors/readings", response_model=list[SensorReadingResponse])
async def list_sensor_readings(
    zone_id: Optional[uuid.UUID] = None,
    sensor_type: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(SensorReading)
    if zone_id:
        query = query.where(SensorReading.zone_id == zone_id)
    if sensor_type:
        query = query.where(SensorReading.sensor_type == sensor_type)
    result = await db.execute(query.order_by(SensorReading.timestamp.desc()).limit(limit))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Capacity Alert Endpoints
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=list[CapacityAlertResponse])
async def list_capacity_alerts(
    resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(CapacityAlert)
    if resolved is not None:
        query = query.where(CapacityAlert.resolved == resolved)
    result = await db.execute(query.order_by(CapacityAlert.created_at.desc()))
    return result.scalars().all()


@router.patch("/alerts/{alert_id}/resolve", response_model=CapacityAlertResponse)
async def resolve_capacity_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = await db.get(CapacityAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return alert


# ---------------------------------------------------------------------------
# Zone Density History (Time-Series)
# ---------------------------------------------------------------------------

class ZoneDensityHistory(DBBaseModel):
    """Time-series record of zone occupancy for historical trend analysis."""
    __tablename__ = "depot_zone_density_history"

    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    zone_code = Column(String, nullable=True)
    occupancy = Column(Integer, nullable=False)
    capacity = Column(Integer, nullable=False)
    utilization_pct = Column(Float, nullable=False)
    status = Column(String, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Day 2 — Zone History & Capacity Threshold Models
# ---------------------------------------------------------------------------

class ZoneHistory(DBBaseModel):
    """Historical utilization snapshots for trend analysis."""
    __tablename__ = "depot_zone_history"

    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    zone_code = Column(String, nullable=True)
    utilization_pct = Column(Float, default=0.0)
    occupancy = Column(Integer, default=0)
    max_capacity = Column(Integer, default=0)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class CapacityThresholdConfig(DBBaseModel):
    """Configurable capacity thresholds per zone."""
    __tablename__ = "depot_capacity_thresholds"

    zone_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    zone_code = Column(String, nullable=True)
    warning_pct = Column(Float, default=80.0)
    critical_pct = Column(Float, default=95.0)
    is_global = Column(Boolean, default=False)
    updated_by = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Day 2 — Additional Pydantic Schemas
# ---------------------------------------------------------------------------

class ZoneBoundaryUpdate(BaseModel):
    polygon_coords: list[list[float]] = Field(..., min_length=3, description="[[x,y], ...] polygon vertices")


class DensityEntry(BaseModel):
    zone_code: str
    name: str
    area_sqm: Optional[float]
    current_occupancy: int
    objects_per_sqm: float
    density_level: str  # low, medium, high, critical


class DensityHistoryResponse(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    zone_code: Optional[str]
    occupancy: int
    capacity: int
    utilization_pct: float
    status: Optional[str]
    recorded_at: datetime


class ZoneHistoryResponse(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    zone_code: Optional[str]
    utilization_pct: float
    occupancy: int
    max_capacity: int
    timestamp: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post("/density/snapshot", response_model=list[DensityHistoryResponse], status_code=201)
async def record_density_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record a point-in-time snapshot of all zone densities.
    Call periodically (e.g., every 15 minutes) to build historical trends.
    """
    result = await db.execute(
        select(DepotZone).where(DepotZone.is_active == True)
    )
    zones = result.scalars().all()

    records = []
    for zone in zones:
        record = ZoneDensityHistory(
            zone_id=zone.id,
            zone_code=zone.zone_code,
            occupancy=zone.current_occupancy,
            capacity=zone.max_capacity_units,
            utilization_pct=zone.utilization_pct,
            status=zone.status,
        )
        db.add(record)
        records.append(record)

    await db.commit()
    for r in records:
        await db.refresh(r)
    return records


@router.get("/density/history", response_model=list[DensityHistoryResponse])
async def get_density_history(
    zone_id: Optional[uuid.UUID] = None,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get zone density history for trend analysis."""
    query = select(ZoneDensityHistory)
    if zone_id:
        query = query.where(ZoneDensityHistory.zone_id == zone_id)
    result = await db.execute(query.order_by(ZoneDensityHistory.recorded_at.desc()).limit(limit))
    return result.scalars().all()


class ThresholdCreate(BaseModel):
    zone_id: Optional[uuid.UUID] = None
    zone_code: Optional[str] = None
    warning_pct: float = Field(80.0, ge=0.0, le=100.0)
    critical_pct: float = Field(95.0, ge=0.0, le=100.0)
    is_global: bool = False


class ThresholdResponse(BaseModel):
    id: uuid.UUID
    zone_id: Optional[uuid.UUID]
    zone_code: Optional[str]
    warning_pct: float
    critical_pct: float
    is_global: bool
    updated_by: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CapacityStatusEntry(BaseModel):
    zone_code: str
    name: str
    utilization_pct: float
    status: str
    current_occupancy: int
    max_capacity_units: int
    warning_threshold: float
    critical_threshold: float
    exceeds_warning: bool
    exceeds_critical: bool


class MqttSensorBatch(BaseModel):
    readings: list[SensorReadingCreate] = Field(..., min_length=1)


class MqttBatchResponse(BaseModel):
    ingested: int
    anomalies: int


# ---------------------------------------------------------------------------
# Day 2 — Zone Boundary Endpoint
# ---------------------------------------------------------------------------

@router.patch("/zones/{zone_id}/boundary", response_model=ZoneResponse)
async def update_zone_boundary(
    zone_id: uuid.UUID,
    payload: ZoneBoundaryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update zone polygon boundary coordinates for map rendering."""
    zone = await db.get(DepotZone, zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(status_code=404, detail="Zone not found")
    zone.polygon_coords = payload.polygon_coords
    await db.commit()
    await db.refresh(zone)
    logger.info(f"Zone {zone.zone_code} boundary updated: {len(payload.polygon_coords)} vertices")
    return zone


# ---------------------------------------------------------------------------
# Day 2 — Density Analytics Endpoint
# ---------------------------------------------------------------------------

@router.get("/density", response_model=list[DensityEntry])
async def get_density_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get density analytics per zone (objects per sqm, density level)."""
    result = await db.execute(
        select(DepotZone).where(DepotZone.is_active == True).order_by(DepotZone.zone_code)
    )
    zones = result.scalars().all()

    entries = []
    for z in zones:
        area = z.area_sqm or 1.0
        density = round(z.current_occupancy / area, 4) if area > 0 else 0.0

        if density >= 0.40:
            level = "critical"
        elif density >= 0.30:
            level = "high"
        elif density >= 0.15:
            level = "medium"
        else:
            level = "low"

        entries.append(DensityEntry(
            zone_code=z.zone_code,
            name=z.name,
            area_sqm=z.area_sqm,
            current_occupancy=z.current_occupancy,
            objects_per_sqm=density,
            density_level=level,
        ))
    return entries


# ---------------------------------------------------------------------------
# Day 2 — Zone History Endpoint
# ---------------------------------------------------------------------------

@router.get("/zones/{zone_id}/history", response_model=list[ZoneHistoryResponse])
async def get_zone_history(
    zone_id: uuid.UUID,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get historical utilization data for a zone (time-series for trend charts)."""
    zone = await db.get(DepotZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    result = await db.execute(
        select(ZoneHistory)
        .where(ZoneHistory.zone_id == zone_id)
        .order_by(ZoneHistory.timestamp.desc())
        .limit(limit)
    )
    rows = result.scalars().all()

    # If no history yet, generate a snapshot from current state
    if not rows:
        snapshot = ZoneHistory(
            zone_id=zone.id,
            zone_code=zone.zone_code,
            utilization_pct=zone.utilization_pct,
            occupancy=zone.current_occupancy,
            max_capacity=zone.max_capacity_units,
        )
        db.add(snapshot)
        await db.commit()
        await db.refresh(snapshot)
        rows = [snapshot]

    return list(reversed(rows))


# ---------------------------------------------------------------------------
# Day 2 — Capacity Threshold Configuration
# ---------------------------------------------------------------------------

@router.post("/threshold", response_model=ThresholdResponse, status_code=201)
async def configure_threshold(
    payload: ThresholdCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Configure capacity alert thresholds (default 85%). Can be global or per-zone."""
    if payload.warning_pct >= payload.critical_pct:
        raise HTTPException(
            status_code=400,
            detail="Warning threshold must be lower than critical threshold"
        )

    threshold = CapacityThresholdConfig(
        zone_id=payload.zone_id,
        zone_code=payload.zone_code,
        warning_pct=payload.warning_pct,
        critical_pct=payload.critical_pct,
        is_global=payload.is_global,
        updated_by=str(current_user.id),
    )
    db.add(threshold)
    await db.commit()
    await db.refresh(threshold)
    logger.info(
        f"Threshold configured: warning={payload.warning_pct}%, "
        f"critical={payload.critical_pct}%, global={payload.is_global}"
    )
    return threshold


@router.get("/threshold", response_model=list[ThresholdResponse])
async def list_thresholds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all configured capacity thresholds."""
    result = await db.execute(
        select(CapacityThresholdConfig).order_by(CapacityThresholdConfig.created_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Day 2 — Capacity Status Endpoint
# ---------------------------------------------------------------------------

@router.get("/capacity/status", response_model=list[CapacityStatusEntry])
async def get_capacity_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get capacity status across all zones with threshold comparison."""
    zones_result = await db.execute(
        select(DepotZone).where(DepotZone.is_active == True).order_by(DepotZone.zone_code)
    )
    zones = zones_result.scalars().all()

    # Get global threshold (most recent)
    global_result = await db.execute(
        select(CapacityThresholdConfig)
        .where(CapacityThresholdConfig.is_global == True)
        .order_by(CapacityThresholdConfig.created_at.desc())
        .limit(1)
    )
    global_threshold = global_result.scalar_one_or_none()

    default_warning = global_threshold.warning_pct if global_threshold else 80.0
    default_critical = global_threshold.critical_pct if global_threshold else 95.0

    entries = []
    for z in zones:
        # Check for zone-specific threshold
        zone_thresh_result = await db.execute(
            select(CapacityThresholdConfig)
            .where(
                CapacityThresholdConfig.zone_id == z.id,
                CapacityThresholdConfig.is_global == False,
            )
            .order_by(CapacityThresholdConfig.created_at.desc())
            .limit(1)
        )
        zone_thresh = zone_thresh_result.scalar_one_or_none()

        warn = zone_thresh.warning_pct if zone_thresh else default_warning
        crit = zone_thresh.critical_pct if zone_thresh else default_critical

        entries.append(CapacityStatusEntry(
            zone_code=z.zone_code,
            name=z.name,
            utilization_pct=z.utilization_pct,
            status=z.status,
            current_occupancy=z.current_occupancy,
            max_capacity_units=z.max_capacity_units,
            warning_threshold=warn,
            critical_threshold=crit,
            exceeds_warning=z.utilization_pct >= warn,
            exceeds_critical=z.utilization_pct >= crit,
        ))
    return entries


# ---------------------------------------------------------------------------
# Day 2 — MQTT IoT Sensor Batch Ingestion
# ---------------------------------------------------------------------------

@router.post("/mqtt/ingest", response_model=MqttBatchResponse, status_code=201)
async def mqtt_batch_ingest(
    payload: MqttSensorBatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    MQTT IoT sensor batch ingestion stub. Accepts multiple sensor readings
    in a single request (simulating MQTT broker forwarding).
    """
    ingested = 0
    anomalies = 0

    for reading_data in payload.readings:
        zone = await db.get(DepotZone, reading_data.zone_id)
        if not zone:
            continue

        reading = SensorReading(**reading_data.model_dump())

        # Simple anomaly detection: flag readings outside expected ranges
        if reading_data.sensor_type == "temperature" and (reading_data.value > 50 or reading_data.value < -10):
            reading.is_anomaly = True
            anomalies += 1
        elif reading_data.sensor_type == "humidity" and (reading_data.value > 95 or reading_data.value < 5):
            reading.is_anomaly = True
            anomalies += 1
        elif reading_data.sensor_type == "occupancy" and reading_data.value < 0:
            reading.is_anomaly = True
            anomalies += 1

        db.add(reading)
        ingested += 1

        # If occupancy sensor, update zone occupancy
        if reading_data.sensor_type == "occupancy" and not reading.is_anomaly:
            zone.current_occupancy = int(reading_data.value)
            zone.utilization_pct = round(
                (zone.current_occupancy / zone.max_capacity_units) * 100, 1
            ) if zone.max_capacity_units > 0 else 0.0

            if zone.utilization_pct >= 95:
                zone.status = ZoneStatus.CRITICAL
            elif zone.utilization_pct >= 80:
                zone.status = ZoneStatus.WARNING
            else:
                zone.status = ZoneStatus.NORMAL

            # Record history snapshot
            snapshot = ZoneHistory(
                zone_id=zone.id,
                zone_code=zone.zone_code,
                utilization_pct=zone.utilization_pct,
                occupancy=zone.current_occupancy,
                max_capacity=zone.max_capacity_units,
            )
            db.add(snapshot)

    await db.commit()
    logger.info(f"MQTT batch ingested: {ingested} readings, {anomalies} anomalies")
    return MqttBatchResponse(ingested=ingested, anomalies=anomalies)
