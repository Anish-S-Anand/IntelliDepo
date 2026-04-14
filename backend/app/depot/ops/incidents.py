"""
IntelliOps™ — Incident Escalation Module
Features: F-069 (Auto-escalation Rules Engine), F-070 (Severity Classification Agent),
          F-071 (Multi-channel Alerting via Novu), F-073 (Audit Trail — backend)
          Cross-module: SLA breach → incident link

Keerthi: Auto-escalation rules engine evaluated by LangGraph agent.
         Incident escalation flow. Resolution workflow. SLA breach → incident link.
Pranisree: Severity classification agent (NLP + rule-based P1/P2/P3/P4).
           Multi-channel alerting via Novu. Audit trail log.
"""
import uuid
import logging
import re
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

logger = logging.getLogger("intelli.ops.incidents")

router = APIRouter(prefix="/ops/incidents", tags=["IntelliOps - Incident Escalation"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class IncidentPriority(str, Enum):
    P1 = "P1"  # Critical — immediate response
    P2 = "P2"  # High — respond within 15 min
    P3 = "P3"  # Medium — respond within 1 hr
    P4 = "P4"  # Low — respond within 4 hr


class IncidentStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    ESCALATED = "escalated"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentSource(str, Enum):
    SLA_BREACH = "sla_breach"
    ALERT = "alert"
    PERIMETER = "perimeter"
    MANUAL = "manual"
    SENSOR = "sensor"
    VISION = "vision"


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    PUSH = "push"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class OpsIncident(DBBaseModel):
    """Unified incident record for IntelliOps."""
    __tablename__ = "ops_incidents"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    incident_type = Column(String, nullable=True, index=True)       # equipment, sla, security, etc.
    source = Column(String, default=IncidentSource.MANUAL, index=True)
    source_ref_id = Column(UUID(as_uuid=True), nullable=True)       # FK to SLA/alert/breach
    priority = Column(String, default=IncidentPriority.P3, index=True)
    severity_score = Column(Float, default=0.5)                     # 0-1 confidence from classifier
    status = Column(String, default=IncidentStatus.OPEN, index=True)
    zone = Column(String, nullable=True)
    assigned_to = Column(String, nullable=True)
    escalation_level = Column(Integer, default=0)
    escalation_chain = Column(JSON, default=list)                   # tier trail
    escalation_deadline = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_steps = Column(JSON, default=list)                   # checklist of steps taken
    metadata_json = Column(JSON, nullable=True)


class IncidentNotification(DBBaseModel):
    """Notification record per incident — tracks multi-channel delivery."""
    __tablename__ = "ops_incident_notifications"

    incident_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    channel = Column(String, nullable=False)                        # in_app, email, sms, whatsapp, push
    recipient = Column(String, nullable=True)
    status = Column(String, default="sent")                         # sent, delivered, failed, read
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)


class IncidentAuditEntry(DBBaseModel):
    """Immutable audit trail per incident — every state change logged."""
    __tablename__ = "ops_incident_audit"

    incident_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String, nullable=False)                         # created, acknowledged, escalated, resolved, etc.
    actor = Column(String, nullable=True)                           # user ID or system
    actor_role = Column(String, nullable=True)                      # operator, supervisor, system
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)


class AutoEscalationRule(DBBaseModel):
    """F-069 — Configurable auto-escalation rule evaluated by the agent."""
    __tablename__ = "ops_auto_escalation_rules"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority_trigger = Column(String, nullable=False, index=True)   # P1, P2, P3, P4
    source_filter = Column(String, nullable=True)                   # sla_breach, alert, etc.
    time_window_minutes = Column(Integer, default=15)               # escalate if unack within N min
    target_tier = Column(String, nullable=True)                     # who to escalate to
    notification_channels = Column(JSON, default=lambda: ["in_app", "email"])
    is_active = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    incident_type: Optional[str] = None
    source: str = "manual"
    source_ref_id: Optional[uuid.UUID] = None
    priority: Optional[str] = None               # if None, auto-classify
    zone: Optional[str] = None
    assigned_to: Optional[str] = None
    metadata_json: Optional[dict] = None


class IncidentResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    incident_type: Optional[str]
    source: str
    source_ref_id: Optional[uuid.UUID]
    priority: str
    severity_score: float
    status: str
    zone: Optional[str]
    assigned_to: Optional[str]
    escalation_level: int
    escalation_chain: list
    escalation_deadline: Optional[datetime]
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]
    resolution_steps: list
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class IncidentAcknowledge(BaseModel):
    reason: str = Field(..., min_length=5)


class IncidentResolve(BaseModel):
    resolution_notes: str = Field(..., min_length=5)
    resolution_steps: list[str] = Field(default_factory=list)


class NotificationResponse(BaseModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    channel: str
    recipient: Optional[str]
    status: str
    sent_at: datetime
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuditEntryResponse(BaseModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    action: str
    actor: Optional[str]
    actor_role: Optional[str]
    previous_state: Optional[str]
    new_state: Optional[str]
    details: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    priority_trigger: str = "P1"
    source_filter: Optional[str] = None
    time_window_minutes: int = Field(default=15, ge=1)
    target_tier: Optional[str] = None
    notification_channels: list[str] = Field(default_factory=lambda: ["in_app", "email"])
    is_active: bool = True


class RuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    priority_trigger: str
    source_filter: Optional[str]
    time_window_minutes: int
    target_tier: Optional[str]
    notification_channels: list
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SeverityClassification(BaseModel):
    priority: str
    severity_score: float
    confidence: float
    reasoning: str
    keywords_matched: list[str]


class SLABreachIncidentRequest(BaseModel):
    sla_id: uuid.UUID
    sla_name: str
    breach_probability: float
    client_name: Optional[str] = None
    zone: Optional[str] = None


# ---------------------------------------------------------------------------
# F-070 — Severity Classification Agent (rule-based + keyword NLP)
# ---------------------------------------------------------------------------

SEVERITY_KEYWORDS = {
    "P1": ["fire", "explosion", "injury", "critical", "emergency", "security breach",
           "unauthorized", "hazmat", "spill", "collapse", "fatality", "power outage"],
    "P2": ["breach", "sla breach", "equipment failure", "temperature", "exceeded",
           "escalation", "intrusion", "camera offline", "system down", "high priority"],
    "P3": ["delay", "dwell", "warning", "maintenance", "scheduled", "queue",
           "at risk", "approaching", "threshold", "medium"],
    "P4": ["info", "low", "battery", "routine", "check", "minor", "note",
           "log", "update", "notification"],
}


def classify_severity(title: str, description: str = "", source: str = "manual") -> SeverityClassification:
    """
    F-070 — NLP + rule-based classifier: determines P1/P2/P3/P4 from
    incident text + sensor context. Outputs priority + confidence score.
    """
    text = f"{title} {description}".lower()
    scores: dict[str, float] = {"P1": 0, "P2": 0, "P3": 0, "P4": 0}
    matched: dict[str, list[str]] = {"P1": [], "P2": [], "P3": [], "P4": []}

    for priority, keywords in SEVERITY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                scores[priority] += 1
                matched[priority].append(kw)

    # Source-based boosting
    if source == "sla_breach":
        scores["P2"] += 1.5
    elif source == "perimeter":
        scores["P1"] += 1.0
    elif source == "sensor":
        scores["P2"] += 0.5

    # Find top priority
    best_priority = "P3"  # default
    best_score = 0
    for p in ["P1", "P2", "P3", "P4"]:
        if scores[p] > best_score:
            best_score = scores[p]
            best_priority = p

    # Confidence: ratio of best score to total
    total = sum(scores.values())
    confidence = round(best_score / max(total, 1), 2)

    # Severity score: P1=1.0, P2=0.75, P3=0.5, P4=0.25
    severity_map = {"P1": 1.0, "P2": 0.75, "P3": 0.5, "P4": 0.25}

    all_matched = []
    for kws in matched.values():
        all_matched.extend(kws)

    reasoning = f"Classified as {best_priority} based on {len(all_matched)} keyword matches"
    if source != "manual":
        reasoning += f" + source boost ({source})"

    return SeverityClassification(
        priority=best_priority,
        severity_score=severity_map[best_priority],
        confidence=confidence,
        reasoning=reasoning,
        keywords_matched=list(set(all_matched)),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ESCALATION_CHAIN = ["Shift Supervisor", "Operations Manager", "Site Director"]
ESCALATION_WINDOWS = {"P1": 5, "P2": 15, "P3": 60, "P4": 240}  # minutes


async def _log_audit(db: AsyncSession, incident_id: uuid.UUID, action: str,
                     actor: str = "system", actor_role: str = "system",
                     prev_state: Optional[str] = None, new_state: Optional[str] = None,
                     details: Optional[str] = None):
    """Create immutable audit trail entry."""
    entry = IncidentAuditEntry(
        incident_id=incident_id, action=action, actor=actor, actor_role=actor_role,
        previous_state=prev_state, new_state=new_state, details=details,
    )
    db.add(entry)


async def _send_notification(db: AsyncSession, incident_id: uuid.UUID,
                             channel: str, recipient: str,
                             incident: OpsIncident):
    """Record notification dispatch. In production calls Novu SDK."""
    notif = IncidentNotification(
        incident_id=incident_id, channel=channel, recipient=recipient, status="sent",
        metadata_json={
            "title": incident.title,
            "priority": incident.priority,
            "zone": incident.zone,
        },
    )
    db.add(notif)

    # Fire-and-forget to RabbitMQ
    try:
        from app.core.rabbitmq import publish_alert
        await publish_alert(
            alert_type="incident_notification",
            severity=incident.priority.lower() if incident.priority else "medium",
            payload={
                "incident_id": str(incident_id),
                "channel": channel,
                "recipient": recipient,
                "title": incident.title,
            },
        )
    except Exception:
        logger.warning("RabbitMQ unavailable — notification logged only")

    # Try Novu / platform notifications
    try:
        from app.core.notifications.service_compat import NotificationService
        redis = None
        try:
            from app.core.redis_client import redis_pool
            redis = redis_pool
        except Exception:
            pass
        await NotificationService.send_alert(
            db=db, redis=redis, user_id=recipient,
            event_type=f"ops.incident.{incident.priority}",
            title=f"[{incident.priority}] {incident.title}",
            message=incident.description or incident.title,
            priority="CRITICAL" if incident.priority in ("P1", "P2") else "HIGH",
            payload={"incident_id": str(incident_id), "zone": incident.zone},
            channel=channel,
        )
    except Exception:
        logger.debug("Platform notification service unavailable — skipping")


# ---------------------------------------------------------------------------
# Incident CRUD Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=IncidentResponse, status_code=201)
async def create_incident(
    body: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an incident, auto-classifying severity if priority not provided (F-070)."""
    if body.priority:
        priority = body.priority
        severity_score = {"P1": 1.0, "P2": 0.75, "P3": 0.5, "P4": 0.25}.get(body.priority, 0.5)
    else:
        classification = classify_severity(body.title, body.description or "", body.source)
        priority = classification.priority
        severity_score = classification.severity_score

    window = ESCALATION_WINDOWS.get(priority, 60)
    now = datetime.now(timezone.utc)

    incident = OpsIncident(
        title=body.title,
        description=body.description,
        incident_type=body.incident_type,
        source=body.source,
        source_ref_id=body.source_ref_id,
        priority=priority,
        severity_score=severity_score,
        zone=body.zone,
        assigned_to=body.assigned_to or ESCALATION_CHAIN[0],
        escalation_level=0,
        escalation_chain=[{"tier": ESCALATION_CHAIN[0], "assigned_at": now.isoformat()}],
        escalation_deadline=now + timedelta(minutes=window),
        metadata_json=body.metadata_json,
    )
    db.add(incident)
    await db.flush()

    await _log_audit(db, incident.id, "created", actor=str(current_user.id),
                     actor_role="operator", new_state=IncidentStatus.OPEN,
                     details=f"Priority: {priority}, Source: {body.source}")

    # Send initial notification (F-071)
    await _send_notification(db, incident.id, "in_app", ESCALATION_CHAIN[0], incident)

    await db.commit()
    await db.refresh(incident)
    return IncidentResponse.model_validate(incident)


@router.get("/", response_model=list[IncidentResponse])
async def list_incidents(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(OpsIncident)
    if status:
        q = q.where(OpsIncident.status == status)
    if priority:
        q = q.where(OpsIncident.priority == priority)
    if source:
        q = q.where(OpsIncident.source == source)
    q = q.order_by(desc(OpsIncident.created_at)).limit(limit)
    result = await db.execute(q)
    return [IncidentResponse.model_validate(i) for i in result.scalars().all()]


@router.get("/active", response_model=list[IncidentResponse])
async def list_active_incidents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OpsIncident)
        .where(OpsIncident.status.in_([
            IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
            IncidentStatus.ESCALATED, IncidentStatus.IN_PROGRESS,
        ]))
        .order_by(desc(OpsIncident.created_at))
    )
    return [IncidentResponse.model_validate(i) for i in result.scalars().all()]


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(OpsIncident).where(OpsIncident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")
    return IncidentResponse.model_validate(incident)


@router.patch("/{incident_id}/acknowledge", response_model=IncidentResponse)
async def acknowledge_incident(
    incident_id: uuid.UUID,
    body: IncidentAcknowledge,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(OpsIncident).where(OpsIncident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")

    prev = incident.status
    incident.status = IncidentStatus.ACKNOWLEDGED
    incident.acknowledged_at = datetime.now(timezone.utc)
    incident.acknowledged_by = str(current_user.id)

    await _log_audit(db, incident_id, "acknowledged", actor=str(current_user.id),
                     actor_role="operator", prev_state=prev,
                     new_state=IncidentStatus.ACKNOWLEDGED, details=body.reason)

    await db.commit()
    await db.refresh(incident)
    return IncidentResponse.model_validate(incident)


@router.patch("/{incident_id}/resolve", response_model=IncidentResponse)
async def resolve_incident(
    incident_id: uuid.UUID,
    body: IncidentResolve,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve incident with notes + resolution steps checklist (F-072)."""
    result = await db.execute(select(OpsIncident).where(OpsIncident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")

    prev = incident.status
    incident.status = IncidentStatus.RESOLVED
    incident.resolved_at = datetime.now(timezone.utc)
    incident.resolved_by = str(current_user.id)
    incident.resolution_notes = body.resolution_notes
    incident.resolution_steps = body.resolution_steps

    await _log_audit(db, incident_id, "resolved", actor=str(current_user.id),
                     actor_role="operator", prev_state=prev,
                     new_state=IncidentStatus.RESOLVED, details=body.resolution_notes)

    # Send resolution notification
    await _send_notification(db, incident_id, "in_app", incident.assigned_to or "system", incident)

    await db.commit()
    await db.refresh(incident)
    return IncidentResponse.model_validate(incident)


# ---------------------------------------------------------------------------
# F-069 — Auto-Escalation Rules Engine
# ---------------------------------------------------------------------------

@router.post("/rules", response_model=RuleResponse, status_code=201)
async def create_auto_escalation_rule(
    body: RuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = AutoEscalationRule(**body.model_dump(), created_by=str(current_user.id))
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return RuleResponse.model_validate(rule)


@router.get("/rules", response_model=list[RuleResponse])
async def list_auto_escalation_rules(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AutoEscalationRule)
    if active_only:
        q = q.where(AutoEscalationRule.is_active == True)
    result = await db.execute(q.order_by(desc(AutoEscalationRule.created_at)))
    return [RuleResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/evaluate-escalations", response_model=dict)
async def evaluate_auto_escalations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    F-069 — Periodic evaluation: auto-escalate incidents past their deadline.
    Evaluates active rules against open incidents. Called from scheduler.
    """
    now = datetime.now(timezone.utc)
    escalated_count = 0

    # Find open incidents past their escalation deadline
    result = await db.execute(
        select(OpsIncident).where(
            OpsIncident.status.in_([IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED]),
            OpsIncident.escalation_deadline <= now,
        )
    )
    for incident in result.scalars().all():
        # Check if there's a matching rule
        rule_result = await db.execute(
            select(AutoEscalationRule).where(
                AutoEscalationRule.is_active == True,
                AutoEscalationRule.priority_trigger == incident.priority,
            ).limit(1)
        )
        rule = rule_result.scalar_one_or_none()

        # Escalate
        level = min(incident.escalation_level + 1, len(ESCALATION_CHAIN) - 1)
        prev = incident.status
        incident.escalation_level = level
        incident.status = IncidentStatus.ESCALATED
        incident.assigned_to = ESCALATION_CHAIN[level]

        chain = list(incident.escalation_chain) if incident.escalation_chain else []
        chain.append({"tier": ESCALATION_CHAIN[level], "assigned_at": now.isoformat()})
        incident.escalation_chain = chain

        # Reset deadline based on rule or default
        window = rule.time_window_minutes if rule else ESCALATION_WINDOWS.get(incident.priority, 15)
        incident.escalation_deadline = now + timedelta(minutes=window)

        await _log_audit(db, incident.id, "auto_escalated", actor="system",
                         actor_role="escalation_agent", prev_state=prev,
                         new_state=IncidentStatus.ESCALATED,
                         details=f"Escalated to tier {level}: {ESCALATION_CHAIN[level]}")

        # Send notifications via configured channels
        channels = rule.notification_channels if rule else ["in_app", "email"]
        for ch in channels:
            await _send_notification(db, incident.id, ch, ESCALATION_CHAIN[level], incident)

        escalated_count += 1

    await db.commit()
    return {"evaluated_at": now.isoformat(), "auto_escalated": escalated_count}


# ---------------------------------------------------------------------------
# F-070 — Severity Classification Endpoint
# ---------------------------------------------------------------------------

@router.post("/classify", response_model=SeverityClassification)
async def classify_incident_severity(
    title: str = Query(...),
    description: str = Query(default=""),
    source: str = Query(default="manual"),
    current_user: User = Depends(get_current_user),
):
    """Classify incident severity using NLP + rule-based agent (F-070)."""
    return classify_severity(title, description, source)


# ---------------------------------------------------------------------------
# F-071 — Multi-channel Notification Endpoints
# ---------------------------------------------------------------------------

@router.get("/{incident_id}/notifications", response_model=list[NotificationResponse])
async def list_incident_notifications(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get alert history per incident — all channels (F-071)."""
    result = await db.execute(
        select(IncidentNotification)
        .where(IncidentNotification.incident_id == incident_id)
        .order_by(desc(IncidentNotification.sent_at))
    )
    return [NotificationResponse.model_validate(n) for n in result.scalars().all()]


@router.post("/{incident_id}/notify", response_model=NotificationResponse, status_code=201)
async def send_incident_notification(
    incident_id: uuid.UUID,
    channel: str = Query(...),
    recipient: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually send notification for an incident via specified channel (F-071)."""
    result = await db.execute(select(OpsIncident).where(OpsIncident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")

    await _send_notification(db, incident_id, channel, recipient, incident)
    await _log_audit(db, incident_id, "notification_sent", actor=str(current_user.id),
                     actor_role="operator", details=f"Channel: {channel}, Recipient: {recipient}")

    await db.commit()

    # Return the latest notification
    latest = await db.execute(
        select(IncidentNotification)
        .where(IncidentNotification.incident_id == incident_id)
        .order_by(desc(IncidentNotification.sent_at)).limit(1)
    )
    return NotificationResponse.model_validate(latest.scalar_one())


# ---------------------------------------------------------------------------
# F-073 — Audit Trail Endpoints
# ---------------------------------------------------------------------------

@router.get("/{incident_id}/audit", response_model=list[AuditEntryResponse])
async def get_incident_audit_trail(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Immutable audit timeline for an incident (F-073)."""
    result = await db.execute(
        select(IncidentAuditEntry)
        .where(IncidentAuditEntry.incident_id == incident_id)
        .order_by(IncidentAuditEntry.created_at)
    )
    return [AuditEntryResponse.model_validate(e) for e in result.scalars().all()]


@router.get("/audit/all", response_model=list[AuditEntryResponse])
async def list_all_audit_entries(
    action: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all audit entries, optionally filtered by action type."""
    q = select(IncidentAuditEntry)
    if action:
        q = q.where(IncidentAuditEntry.action == action)
    q = q.order_by(desc(IncidentAuditEntry.created_at)).limit(limit)
    result = await db.execute(q)
    return [AuditEntryResponse.model_validate(e) for e in result.scalars().all()]


# ---------------------------------------------------------------------------
# Cross-module: SLA breach → incident link
# ---------------------------------------------------------------------------

@router.post("/from-sla-breach", response_model=IncidentResponse, status_code=201)
async def create_incident_from_sla_breach(
    body: SLABreachIncidentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """When SLA breach confirmed, auto-create incident + fire escalation pipeline."""
    classification = classify_severity(
        f"SLA Breach — {body.sla_name}",
        f"Breach probability: {body.breach_probability:.0%}. Client: {body.client_name or 'N/A'}",
        source="sla_breach",
    )
    now = datetime.now(timezone.utc)
    window = ESCALATION_WINDOWS.get(classification.priority, 15)

    incident = OpsIncident(
        title=f"SLA Breach — {body.sla_name}",
        description=(
            f"Automated incident from SLA breach detection. "
            f"Breach probability: {body.breach_probability:.0%}. "
            f"Client: {body.client_name or 'N/A'}"
        ),
        incident_type="sla_breach",
        source=IncidentSource.SLA_BREACH,
        source_ref_id=body.sla_id,
        priority=classification.priority,
        severity_score=classification.severity_score,
        zone=body.zone,
        assigned_to=ESCALATION_CHAIN[0],
        escalation_level=0,
        escalation_chain=[{"tier": ESCALATION_CHAIN[0], "assigned_at": now.isoformat()}],
        escalation_deadline=now + timedelta(minutes=window),
        metadata_json={
            "sla_id": str(body.sla_id),
            "breach_probability": body.breach_probability,
            "client_name": body.client_name,
        },
    )
    db.add(incident)
    await db.flush()

    await _log_audit(db, incident.id, "created_from_sla_breach", actor="system",
                     actor_role="breach_detection_agent",
                     new_state=IncidentStatus.OPEN,
                     details=f"SLA: {body.sla_name}, Prob: {body.breach_probability:.0%}")

    # Multi-channel notification for SLA breaches
    for ch in ["in_app", "email"]:
        await _send_notification(db, incident.id, ch, ESCALATION_CHAIN[0], incident)

    await db.commit()
    await db.refresh(incident)
    return IncidentResponse.model_validate(incident)
