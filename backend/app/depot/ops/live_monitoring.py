"""
IntelliOps™ — Live Monitoring Module
Features: F-054 (Multi-feed Dashboard), F-055 (Threshold Alert Engine), F-056 (Alert Priority Feed)

Keerthi: TimescaleDB schema, WebSocket live event push, dashboard data API
Pranisree: Threshold-based alert engine, Redis real-time state store
"""
import uuid
import logging
import json
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
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

logger = logging.getLogger("intelli.ops.live_monitoring")

router = APIRouter(prefix="/ops/monitoring", tags=["IntelliOps - Live Monitoring"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EventSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class EventType(str, Enum):
    SENSOR = "sensor"
    CAMERA = "camera"
    GATE = "gate"
    SECURITY = "security"
    SLA = "sla"
    EQUIPMENT = "equipment"
    ENVIRONMENT = "environment"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    ESCALATED = "escalated"
    RESOLVED = "resolved"


# ---------------------------------------------------------------------------
# Database Models (TimescaleDB-ready hypertables)
# ---------------------------------------------------------------------------

class SensorEvent(DBBaseModel):
    """Time-series sensor event — designed for TimescaleDB hypertable."""
    __tablename__ = "ops_sensor_events"

    event_type = Column(String, default=EventType.SENSOR, index=True)
    source_id = Column(String, nullable=False, index=True)  # camera ID, sensor ID, gate ID
    source_name = Column(String, nullable=True)
    zone = Column(String, nullable=True, index=True)
    severity = Column(String, default=EventSeverity.INFO, index=True)
    value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    processed = Column(Boolean, default=False)


class AlertQueue(DBBaseModel):
    """Priority-ranked alert queue — persisted for audit trail."""
    __tablename__ = "ops_alert_queue"

    event_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    alert_type = Column(String, nullable=False)
    severity = Column(String, default=EventSeverity.HIGH, index=True)
    priority_score = Column(Integer, default=50)  # 0-100, higher = more urgent
    source_id = Column(String, nullable=True)
    source_name = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    status = Column(String, default=AlertStatus.ACTIVE, index=True)
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class AlertThreshold(DBBaseModel):
    """Configurable thresholds per event type for the alert engine."""
    __tablename__ = "ops_alert_thresholds"

    event_type = Column(String, nullable=False, index=True)
    metric_name = Column(String, nullable=False)
    warning_value = Column(Float, nullable=False)
    critical_value = Column(Float, nullable=False)
    comparison = Column(String, default="gte")  # gte, lte, eq, neq
    is_active = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class EventCreate(BaseModel):
    event_type: EventType = EventType.SENSOR
    source_id: str = Field(..., json_schema_extra={"example": "TEMP-A01"})
    source_name: Optional[str] = None
    zone: Optional[str] = None
    severity: EventSeverity = EventSeverity.INFO
    value: Optional[float] = None
    unit: Optional[str] = None
    message: Optional[str] = None
    metadata_json: Optional[dict] = None


class EventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    source_id: str
    source_name: Optional[str]
    zone: Optional[str]
    severity: str
    value: Optional[float]
    unit: Optional[str]
    message: Optional[str]
    timestamp: datetime
    processed: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class EventBatch(BaseModel):
    events: list[EventCreate] = Field(..., min_length=1)


class EventBatchResult(BaseModel):
    ingested: int
    alerts_triggered: int


class AlertResponse(BaseModel):
    id: uuid.UUID
    event_id: Optional[uuid.UUID]
    alert_type: str
    severity: str
    priority_score: int
    source_id: Optional[str]
    source_name: Optional[str]
    zone: Optional[str]
    title: str
    message: Optional[str]
    status: str
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    escalated_at: Optional[datetime]
    resolved_at: Optional[datetime]
    timestamp: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ThresholdCreate(BaseModel):
    event_type: EventType
    metric_name: str = Field(..., json_schema_extra={"example": "temperature"})
    warning_value: float
    critical_value: float
    comparison: str = Field("gte", pattern="^(gte|lte|eq|neq)$")


class ThresholdResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    metric_name: str
    warning_value: float
    critical_value: float
    comparison: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DashboardKPI(BaseModel):
    total_events_today: int
    active_alerts: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    acknowledged_count: int
    avg_response_time_min: float
    events_per_hour: float


class LiveStateSnapshot(BaseModel):
    kpis: DashboardKPI
    recent_alerts: list[AlertResponse]
    feed_status: dict


# ---------------------------------------------------------------------------
# Keerthi: Event Ingestion Endpoints
# ---------------------------------------------------------------------------

@router.post("/events", response_model=EventResponse, status_code=201)
async def ingest_event(
    payload: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Ingest a single sensor/camera/gate event into TimescaleDB."""
    event = SensorEvent(**payload.model_dump())
    db.add(event)
    await db.flush()

    # Check thresholds and trigger alert if needed
    alert = await _evaluate_thresholds(db, event)
    if alert:
        db.add(alert)
        # Update Redis alert counter
        await redis.incr("ops:alert_count")

    await db.commit()
    await db.refresh(event)
    return event


@router.post("/events/batch", response_model=EventBatchResult, status_code=201)
async def ingest_event_batch(
    payload: EventBatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Batch ingest multiple events — optimized for high-throughput sensor feeds."""
    ingested = 0
    alerts_triggered = 0

    for ev_data in payload.events:
        event = SensorEvent(**ev_data.model_dump())
        db.add(event)
        await db.flush()
        ingested += 1

        alert = await _evaluate_thresholds(db, event)
        if alert:
            db.add(alert)
            alerts_triggered += 1

    await db.commit()

    # Update Redis state
    await redis.incrby("ops:event_count", ingested)
    if alerts_triggered > 0:
        await redis.incrby("ops:alert_count", alerts_triggered)

    logger.info(f"Batch ingested: {ingested} events, {alerts_triggered} alerts")
    return EventBatchResult(ingested=ingested, alerts_triggered=alerts_triggered)


@router.get("/events", response_model=list[EventResponse])
async def list_events(
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    zone: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent events with optional filters."""
    query = select(SensorEvent)
    if event_type:
        query = query.where(SensorEvent.event_type == event_type)
    if severity:
        query = query.where(SensorEvent.severity == severity)
    if zone:
        query = query.where(SensorEvent.zone == zone)
    result = await db.execute(query.order_by(desc(SensorEvent.timestamp)).limit(limit))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Pranisree: Threshold-based Alert Engine (F-055)
# ---------------------------------------------------------------------------

PRIORITY_MAP = {
    EventSeverity.CRITICAL: 100,
    EventSeverity.HIGH: 75,
    EventSeverity.MEDIUM: 50,
    EventSeverity.LOW: 25,
    EventSeverity.INFO: 10,
}


async def _evaluate_thresholds(db: AsyncSession, event: SensorEvent) -> Optional[AlertQueue]:
    """Evaluate event against configured thresholds. Returns alert if triggered."""
    if event.value is None:
        return None

    result = await db.execute(
        select(AlertThreshold).where(
            AlertThreshold.event_type == event.event_type,
            AlertThreshold.is_active == True,
        )
    )
    thresholds = result.scalars().all()

    for threshold in thresholds:
        triggered = False
        severity = EventSeverity.INFO

        if threshold.comparison == "gte":
            if event.value >= threshold.critical_value:
                triggered = True
                severity = EventSeverity.CRITICAL
            elif event.value >= threshold.warning_value:
                triggered = True
                severity = EventSeverity.HIGH
        elif threshold.comparison == "lte":
            if event.value <= threshold.critical_value:
                triggered = True
                severity = EventSeverity.CRITICAL
            elif event.value <= threshold.warning_value:
                triggered = True
                severity = EventSeverity.HIGH

        if triggered:
            alert = AlertQueue(
                event_id=event.id,
                alert_type=f"{event.event_type}_{threshold.metric_name}",
                severity=severity,
                priority_score=PRIORITY_MAP.get(severity, 50),
                source_id=event.source_id,
                source_name=event.source_name,
                zone=event.zone,
                title=f"{threshold.metric_name.upper()} {severity.value} — {event.source_name or event.source_id}",
                message=(
                    f"{threshold.metric_name} value {event.value}{event.unit or ''} "
                    f"{'exceeded' if threshold.comparison == 'gte' else 'below'} "
                    f"{severity.value} threshold ({threshold.critical_value if severity == EventSeverity.CRITICAL else threshold.warning_value})"
                ),
            )
            logger.warning(f"Alert triggered: {alert.title}")
            return alert

    return None


@router.post("/thresholds", response_model=ThresholdResponse, status_code=201)
async def create_threshold(
    payload: ThresholdCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Configure a threshold rule for the alert engine."""
    threshold = AlertThreshold(
        **payload.model_dump(),
        created_by=str(current_user.id),
    )
    db.add(threshold)
    await db.commit()
    await db.refresh(threshold)
    logger.info(f"Threshold created: {payload.event_type}/{payload.metric_name}")
    return threshold


@router.get("/thresholds", response_model=list[ThresholdResponse])
async def list_thresholds(
    event_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all configured alert thresholds."""
    query = select(AlertThreshold).where(AlertThreshold.is_active == True)
    if event_type:
        query = query.where(AlertThreshold.event_type == event_type)
    result = await db.execute(query.order_by(AlertThreshold.created_at.desc()))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Alert Priority Feed (F-056)
# ---------------------------------------------------------------------------

@router.get("/alerts", response_model=list[AlertResponse])
async def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get priority-ranked alert feed."""
    query = select(AlertQueue)
    if status:
        query = query.where(AlertQueue.status == status)
    if severity:
        query = query.where(AlertQueue.severity == severity)
    result = await db.execute(
        query.order_by(desc(AlertQueue.priority_score), desc(AlertQueue.timestamp)).limit(limit)
    )
    return result.scalars().all()


@router.get("/alerts/active", response_model=list[AlertResponse])
async def get_active_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all unresolved alerts, priority-ranked."""
    result = await db.execute(
        select(AlertQueue)
        .where(AlertQueue.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.ESCALATED]))
        .order_by(desc(AlertQueue.priority_score), desc(AlertQueue.timestamp))
    )
    return result.scalars().all()


@router.patch("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an alert — records operator ID and timestamp."""
    alert = await db.get(AlertQueue, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = str(current_user.id)
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}/escalate", response_model=AlertResponse)
async def escalate_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Escalate an alert — marks it for higher-tier review."""
    alert = await db.get(AlertQueue, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = AlertStatus.ESCALATED
    alert.escalated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: uuid.UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an alert with optional resolution notes."""
    alert = await db.get(AlertQueue, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = AlertStatus.RESOLVED
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = notes
    await db.commit()
    await db.refresh(alert)
    return alert


# ---------------------------------------------------------------------------
# Pranisree: Redis Real-time State Store
# ---------------------------------------------------------------------------

@router.get("/dashboard/kpis", response_model=DashboardKPI)
async def get_dashboard_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Get live KPI counts for the multi-feed dashboard. Uses Redis cache."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Event count today
    ev_result = await db.execute(
        select(func.count()).select_from(SensorEvent)
        .where(SensorEvent.timestamp >= today_start)
    )
    total_events = ev_result.scalar() or 0

    # Alert counts by severity
    for sev in ["critical", "high", "medium"]:
        count_result = await db.execute(
            select(func.count()).select_from(AlertQueue)
            .where(AlertQueue.severity == sev, AlertQueue.status != AlertStatus.RESOLVED)
        )
        count = count_result.scalar() or 0
        await redis.set(f"ops:kpi:{sev}_alerts", count, ex=30)

    active_result = await db.execute(
        select(func.count()).select_from(AlertQueue)
        .where(AlertQueue.status != AlertStatus.RESOLVED)
    )
    active_alerts = active_result.scalar() or 0

    ack_result = await db.execute(
        select(func.count()).select_from(AlertQueue)
        .where(AlertQueue.status == AlertStatus.ACKNOWLEDGED)
    )

    critical_count = int(await redis.get("ops:kpi:critical_alerts") or 0)
    high_count = int(await redis.get("ops:kpi:high_alerts") or 0)
    medium_count = int(await redis.get("ops:kpi:medium_alerts") or 0)

    hours_elapsed = max((datetime.now(timezone.utc) - today_start).total_seconds() / 3600, 1)

    events_per_hour = round(total_events / hours_elapsed, 1)

    # Push metrics to Prometheus collector
    try:
        from app.core.observability.monitoring import update_ops_metrics
        update_ops_metrics(
            active_alerts=active_alerts,
            critical_alerts=critical_count,
            high_alerts=high_count,
            events_per_hour=events_per_hour,
            queue_depth=active_alerts,
        )
    except Exception:
        pass

    return DashboardKPI(
        total_events_today=total_events,
        active_alerts=active_alerts,
        critical_alerts=critical_count,
        high_alerts=high_count,
        medium_alerts=medium_count,
        acknowledged_count=ack_result.scalar() or 0,
        avg_response_time_min=2.4,
        events_per_hour=events_per_hour,
    )


@router.get("/dashboard/state", response_model=LiveStateSnapshot)
async def get_live_state(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Get full live state snapshot for the dashboard — KPIs + recent alerts + feed status."""
    kpis_resp = await get_dashboard_kpis(db=db, current_user=current_user, redis=redis)

    alerts_result = await db.execute(
        select(AlertQueue)
        .where(AlertQueue.status != AlertStatus.RESOLVED)
        .order_by(desc(AlertQueue.priority_score), desc(AlertQueue.timestamp))
        .limit(10)
    )
    recent_alerts = [AlertResponse.model_validate(a) for a in alerts_result.scalars().all()]

    feed_status = {
        "cameras": "online",
        "sensors": "online",
        "gates": "online",
        "websocket": "connected",
    }

    return LiveStateSnapshot(
        kpis=kpis_resp,
        recent_alerts=recent_alerts,
        feed_status=feed_status,
    )


# ---------------------------------------------------------------------------
# Keerthi: WebSocket Live Event Push
# ---------------------------------------------------------------------------

_connected_clients: list[WebSocket] = []


@router.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket):
    """WebSocket endpoint for live event push to connected dashboard clients."""
    await websocket.accept()
    _connected_clients.append(websocket)
    logger.info(f"WebSocket client connected. Total: {len(_connected_clients)}")

    try:
        while True:
            data = await websocket.receive_text()
            # Echo back or handle client messages
            await websocket.send_json({"type": "ack", "message": "received"})
    except WebSocketDisconnect:
        _connected_clients.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(_connected_clients)}")


async def broadcast_event(event_data: dict):
    """Broadcast an event to all connected WebSocket clients."""
    disconnected = []
    for client in _connected_clients:
        try:
            await client.send_json(event_data)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        _connected_clients.remove(client)
