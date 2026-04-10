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


class DensityHistoryResponse(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    zone_code: Optional[str]
    occupancy: int
    capacity: int
    utilization_pct: float
    status: Optional[str]
    recorded_at: datetime
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
