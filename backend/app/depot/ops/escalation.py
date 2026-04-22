"""
IntelliOps™ — SLA Escalation & Penalty Module
Features: F-061 (Automated Escalation Workflows), F-062 (Penalty Calculation Engine)

Keerthi: Automated escalation workflows — breach prob >80% triggers 3-tier
         notification chain (P1 within 5 min, P2 within 15 min, P3 within 30 min).
Keerthi: Penalty calculation engine — breach duration x penalty rate per SLA contract.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User

logger = logging.getLogger("intelli.ops.escalation")

router = APIRouter(prefix="/ops/escalation", tags=["IntelliOps - Escalation & Penalty"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EscalationTier(str, Enum):
    TIER_1 = "tier_1"  # Shift Supervisor — notified within 5 min
    TIER_2 = "tier_2"  # Operations Manager — notified within 15 min
    TIER_3 = "tier_3"  # Site Director — notified within 30 min


class EscalationStatus(str, Enum):
    PENDING = "pending"
    TIER_1_NOTIFIED = "tier_1_notified"
    TIER_2_NOTIFIED = "tier_2_notified"
    TIER_3_NOTIFIED = "tier_3_notified"
    RESOLVED = "resolved"
    EXPIRED = "expired"


class PenaltyStatus(str, Enum):
    PENDING = "pending"
    CALCULATED = "calculated"
    INVOICED = "invoiced"
    WAIVED = "waived"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class EscalationRule(DBBaseModel):
    """Configurable escalation rule: severity -> time window -> contact tier."""
    __tablename__ = "ops_escalation_rules"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity_trigger = Column(String, nullable=False, index=True)     # critical, high, medium
    breach_probability_threshold = Column(Float, default=0.80)        # trigger when prob >= this
    tier_1_delay_minutes = Column(Integer, default=5)                 # notify tier 1 after N min
    tier_2_delay_minutes = Column(Integer, default=15)                # notify tier 2 after N min
    tier_3_delay_minutes = Column(Integer, default=30)                # notify tier 3 after N min
    tier_1_contacts = Column(JSON, default=list)                      # ["shift_supervisor@depot.com"]
    tier_2_contacts = Column(JSON, default=list)
    tier_3_contacts = Column(JSON, default=list)
    notification_channels = Column(JSON, default=lambda: ["in_app", "email"])  # sms, whatsapp, email, in_app
    is_active = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)


class EscalationWorkflow(DBBaseModel):
    """Active escalation workflow instance — tracks progression through tiers."""
    __tablename__ = "ops_escalation_workflows"

    rule_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    sla_id = Column(UUID(as_uuid=True), nullable=True, index=True)    # FK to SLA definition
    incident_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    trigger_type = Column(String, default="sla_breach")               # sla_breach, alert, manual
    trigger_source = Column(String, nullable=True)                    # what triggered this
    breach_probability = Column(Float, nullable=True)
    severity = Column(String, nullable=False, index=True)
    status = Column(String, default=EscalationStatus.PENDING, index=True)
    current_tier = Column(String, default=EscalationTier.TIER_1)
    tier_1_notified_at = Column(DateTime(timezone=True), nullable=True)
    tier_2_notified_at = Column(DateTime(timezone=True), nullable=True)
    tier_3_notified_at = Column(DateTime(timezone=True), nullable=True)
    tier_1_deadline = Column(DateTime(timezone=True), nullable=True)
    tier_2_deadline = Column(DateTime(timezone=True), nullable=True)
    tier_3_deadline = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    notifications_sent = Column(JSON, default=list)                   # audit log of notifications
    metadata_json = Column(JSON, nullable=True)


class SLAPenalty(DBBaseModel):
    """Penalty record for SLA breach — breach duration x penalty rate."""
    __tablename__ = "ops_sla_penalties"

    sla_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    sla_name = Column(String, nullable=True)
    client_name = Column(String, nullable=True, index=True)
    breach_started_at = Column(DateTime(timezone=True), nullable=False)
    breach_ended_at = Column(DateTime(timezone=True), nullable=True)
    breach_duration_minutes = Column(Float, default=0)
    penalty_rate_per_hour = Column(Float, default=0)                  # $/hr
    penalty_amount = Column(Float, default=0)
    currency = Column(String, default="USD")
    status = Column(String, default=PenaltyStatus.PENDING, index=True)
    waiver_reason = Column(Text, nullable=True)
    invoiced_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

# --- Escalation Rules ---

class EscalationRuleCreate(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Critical SLA Breach Escalation"})
    description: Optional[str] = None
    severity_trigger: str = Field(default="critical")
    breach_probability_threshold: float = Field(default=0.80, ge=0.0, le=1.0)
    tier_1_delay_minutes: int = Field(default=5, ge=1)
    tier_2_delay_minutes: int = Field(default=15, ge=1)
    tier_3_delay_minutes: int = Field(default=30, ge=1)
    tier_1_contacts: list[str] = Field(default_factory=list)
    tier_2_contacts: list[str] = Field(default_factory=list)
    tier_3_contacts: list[str] = Field(default_factory=list)
    notification_channels: list[str] = Field(default_factory=lambda: ["in_app", "email"])
    is_active: bool = True


class EscalationRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    severity_trigger: str
    breach_probability_threshold: float
    tier_1_delay_minutes: int
    tier_2_delay_minutes: int
    tier_3_delay_minutes: int
    tier_1_contacts: list
    tier_2_contacts: list
    tier_3_contacts: list
    notification_channels: list
    is_active: bool
    created_by: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class EscalationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    severity_trigger: Optional[str] = None
    breach_probability_threshold: Optional[float] = None
    tier_1_delay_minutes: Optional[int] = None
    tier_2_delay_minutes: Optional[int] = None
    tier_3_delay_minutes: Optional[int] = None
    tier_1_contacts: Optional[list[str]] = None
    tier_2_contacts: Optional[list[str]] = None
    tier_3_contacts: Optional[list[str]] = None
    notification_channels: Optional[list[str]] = None
    is_active: Optional[bool] = None


# --- Escalation Workflows ---

class WorkflowTrigger(BaseModel):
    sla_id: Optional[uuid.UUID] = None
    incident_id: Optional[uuid.UUID] = None
    trigger_type: str = Field(default="sla_breach")
    trigger_source: Optional[str] = None
    breach_probability: Optional[float] = None
    severity: str = Field(default="critical")
    metadata_json: Optional[dict] = None


class WorkflowResponse(BaseModel):
    id: uuid.UUID
    rule_id: Optional[uuid.UUID]
    sla_id: Optional[uuid.UUID]
    incident_id: Optional[uuid.UUID]
    trigger_type: str
    trigger_source: Optional[str]
    breach_probability: Optional[float]
    severity: str
    status: str
    current_tier: str
    tier_1_notified_at: Optional[datetime]
    tier_2_notified_at: Optional[datetime]
    tier_3_notified_at: Optional[datetime]
    tier_1_deadline: Optional[datetime]
    tier_2_deadline: Optional[datetime]
    tier_3_deadline: Optional[datetime]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]
    notifications_sent: list
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WorkflowResolve(BaseModel):
    resolution_notes: Optional[str] = None


# --- Penalties ---

class PenaltyCreate(BaseModel):
    sla_id: Optional[uuid.UUID] = None
    sla_name: Optional[str] = None
    client_name: Optional[str] = None
    breach_started_at: datetime
    breach_ended_at: Optional[datetime] = None
    penalty_rate_per_hour: float = Field(default=100.0, ge=0)
    currency: str = "USD"
    metadata_json: Optional[dict] = None


class PenaltyResponse(BaseModel):
    id: uuid.UUID
    sla_id: Optional[uuid.UUID]
    sla_name: Optional[str]
    client_name: Optional[str]
    breach_started_at: datetime
    breach_ended_at: Optional[datetime]
    breach_duration_minutes: float
    penalty_rate_per_hour: float
    penalty_amount: float
    currency: str
    status: str
    waiver_reason: Optional[str]
    invoiced_at: Optional[datetime]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PenaltyCalculation(BaseModel):
    """Return shape for penalty forecast endpoint."""
    total_penalties: float
    total_breaches: int
    avg_breach_duration_minutes: float
    penalties_by_client: list[dict]
    penalties_by_status: dict[str, int]
    currency: str = "USD"


class PenaltyWaiver(BaseModel):
    waiver_reason: str


# ---------------------------------------------------------------------------
# F-061 — Automated Escalation Workflow Endpoints
# ---------------------------------------------------------------------------

ESCALATION_CHAIN = {
    EscalationTier.TIER_1: "Shift Supervisor",
    EscalationTier.TIER_2: "Operations Manager",
    EscalationTier.TIER_3: "Site Director",
}


async def _find_matching_rule(db: AsyncSession, severity: str) -> Optional[EscalationRule]:
    """Find the first active escalation rule matching the severity."""
    result = await db.execute(
        select(EscalationRule)
        .where(EscalationRule.severity_trigger == severity, EscalationRule.is_active == True)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _dispatch_notification(tier: str, workflow: EscalationWorkflow, channels: list[str]) -> dict:
    """Dispatch notification through configured channels. Returns audit entry."""
    now = datetime.now(timezone.utc)
    contact = ESCALATION_CHAIN.get(tier, "Unknown")
    entry = {
        "tier": tier,
        "contact_role": contact,
        "channels": channels,
        "sent_at": now.isoformat(),
        "workflow_id": str(workflow.id),
        "severity": workflow.severity,
    }
    # In production this calls Novu SDK — for now we log and record
    try:
        from app.core.rabbitmq import publish_alert
        await publish_alert(
            alert_type="escalation",
            severity=workflow.severity,
            payload={
                "workflow_id": str(workflow.id),
                "tier": tier,
                "contact_role": contact,
                "trigger_type": workflow.trigger_type,
                "sla_id": str(workflow.sla_id) if workflow.sla_id else None,
            },
        )
    except Exception:
        logger.warning("RabbitMQ unavailable — escalation logged only")
    logger.info("Escalation %s → %s via %s", workflow.id, contact, channels)
    return entry


# --- Escalation Rule CRUD ---

@router.post("/rules", response_model=EscalationRuleResponse, status_code=201)
async def create_escalation_rule(
    body: EscalationRuleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a configurable escalation rule (F-061)."""
    rule = EscalationRule(**body.model_dump(), created_by="dashboard")
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return EscalationRuleResponse.model_validate(rule)


@router.get("/rules", response_model=list[EscalationRuleResponse])
async def list_escalation_rules(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List all escalation rules."""
    q = select(EscalationRule)
    if active_only:
        q = q.where(EscalationRule.is_active == True)
    q = q.order_by(desc(EscalationRule.created_at))
    result = await db.execute(q)
    return [EscalationRuleResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/rules/{rule_id}", response_model=EscalationRuleResponse)
async def get_escalation_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EscalationRule).where(EscalationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Escalation rule not found")
    return EscalationRuleResponse.model_validate(rule)


@router.patch("/rules/{rule_id}", response_model=EscalationRuleResponse)
async def update_escalation_rule(
    rule_id: uuid.UUID,
    body: EscalationRuleUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EscalationRule).where(EscalationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Escalation rule not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return EscalationRuleResponse.model_validate(rule)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_escalation_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EscalationRule).where(EscalationRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Escalation rule not found")
    rule.is_active = False  # soft-disable
    await db.commit()


# --- Escalation Workflow Triggers ---

@router.post("/workflows/trigger", response_model=WorkflowResponse, status_code=201)
async def trigger_escalation(
    body: WorkflowTrigger,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a new escalation workflow (F-061).
    Finds matching rule by severity, creates workflow with tier deadlines,
    and dispatches tier-1 notification immediately.
    """
    rule = await _find_matching_rule(db, body.severity)

    now = datetime.now(timezone.utc)
    t1_delay = rule.tier_1_delay_minutes if rule else 5
    t2_delay = rule.tier_2_delay_minutes if rule else 15
    t3_delay = rule.tier_3_delay_minutes if rule else 30
    channels = rule.notification_channels if rule else ["in_app", "email"]

    wf = EscalationWorkflow(
        rule_id=rule.id if rule else None,
        sla_id=body.sla_id,
        incident_id=body.incident_id,
        trigger_type=body.trigger_type,
        trigger_source=body.trigger_source,
        breach_probability=body.breach_probability,
        severity=body.severity,
        status=EscalationStatus.TIER_1_NOTIFIED,
        current_tier=EscalationTier.TIER_1,
        tier_1_notified_at=now,
        tier_1_deadline=now + timedelta(minutes=t1_delay),
        tier_2_deadline=now + timedelta(minutes=t2_delay),
        tier_3_deadline=now + timedelta(minutes=t3_delay),
        notifications_sent=[],
        metadata_json=body.metadata_json,
    )
    db.add(wf)
    await db.flush()

    # Dispatch tier-1 notification immediately
    entry = await _dispatch_notification(EscalationTier.TIER_1, wf, channels)
    wf.notifications_sent = [entry]

    await db.commit()
    await db.refresh(wf)
    return WorkflowResponse.model_validate(wf)


@router.post("/workflows/{workflow_id}/escalate", response_model=WorkflowResponse)
async def escalate_to_next_tier(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Manually escalate a workflow to the next tier."""
    result = await db.execute(
        select(EscalationWorkflow).where(EscalationWorkflow.id == workflow_id)
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    if wf.status == EscalationStatus.RESOLVED:
        raise HTTPException(400, "Workflow already resolved")

    now = datetime.now(timezone.utc)
    rule = None
    if wf.rule_id:
        r = await db.execute(select(EscalationRule).where(EscalationRule.id == wf.rule_id))
        rule = r.scalar_one_or_none()
    channels = rule.notification_channels if rule else ["in_app", "email"]
    notifications = list(wf.notifications_sent) if wf.notifications_sent else []

    if wf.current_tier == EscalationTier.TIER_1:
        wf.current_tier = EscalationTier.TIER_2
        wf.status = EscalationStatus.TIER_2_NOTIFIED
        wf.tier_2_notified_at = now
        entry = await _dispatch_notification(EscalationTier.TIER_2, wf, channels)
    elif wf.current_tier == EscalationTier.TIER_2:
        wf.current_tier = EscalationTier.TIER_3
        wf.status = EscalationStatus.TIER_3_NOTIFIED
        wf.tier_3_notified_at = now
        entry = await _dispatch_notification(EscalationTier.TIER_3, wf, channels)
    else:
        raise HTTPException(400, "Already at highest tier (tier 3)")

    notifications.append(entry)
    wf.notifications_sent = notifications

    await db.commit()
    await db.refresh(wf)
    return WorkflowResponse.model_validate(wf)


@router.post("/workflows/{workflow_id}/resolve", response_model=WorkflowResponse)
async def resolve_workflow(
    workflow_id: uuid.UUID,
    body: WorkflowResolve,
    db: AsyncSession = Depends(get_db),
):
    """Resolve an escalation workflow."""
    result = await db.execute(
        select(EscalationWorkflow).where(EscalationWorkflow.id == workflow_id)
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow not found")

    wf.status = EscalationStatus.RESOLVED
    wf.resolved_at = datetime.now(timezone.utc)
    wf.resolved_by = "dashboard"
    wf.resolution_notes = body.resolution_notes
    await db.commit()
    await db.refresh(wf)
    return WorkflowResponse.model_validate(wf)


@router.get("/workflows", response_model=list[WorkflowResponse])
async def list_workflows(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List escalation workflows with optional status/severity filter."""
    q = select(EscalationWorkflow)
    if status:
        q = q.where(EscalationWorkflow.status == status)
    if severity:
        q = q.where(EscalationWorkflow.severity == severity)
    q = q.order_by(desc(EscalationWorkflow.created_at)).limit(limit)
    result = await db.execute(q)
    return [WorkflowResponse.model_validate(w) for w in result.scalars().all()]


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EscalationWorkflow).where(EscalationWorkflow.id == workflow_id)
    )
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    return WorkflowResponse.model_validate(wf)


@router.post("/workflows/check-deadlines", response_model=dict)
async def check_escalation_deadlines(
    db: AsyncSession = Depends(get_db),
):
    """
    Periodic check: auto-escalate workflows past their tier deadline.
    Call this from a scheduler (cron, Temporal, or background task) every minute.
    """
    now = datetime.now(timezone.utc)
    escalated = 0

    # Find tier-1 workflows past their tier-2 deadline
    result = await db.execute(
        select(EscalationWorkflow).where(
            EscalationWorkflow.status == EscalationStatus.TIER_1_NOTIFIED,
            EscalationWorkflow.tier_2_deadline <= now,
        )
    )
    for wf in result.scalars().all():
        wf.current_tier = EscalationTier.TIER_2
        wf.status = EscalationStatus.TIER_2_NOTIFIED
        wf.tier_2_notified_at = now
        entry = await _dispatch_notification(EscalationTier.TIER_2, wf, ["in_app", "email"])
        notifications = list(wf.notifications_sent) if wf.notifications_sent else []
        notifications.append(entry)
        wf.notifications_sent = notifications
        escalated += 1

    # Find tier-2 workflows past their tier-3 deadline
    result = await db.execute(
        select(EscalationWorkflow).where(
            EscalationWorkflow.status == EscalationStatus.TIER_2_NOTIFIED,
            EscalationWorkflow.tier_3_deadline <= now,
        )
    )
    for wf in result.scalars().all():
        wf.current_tier = EscalationTier.TIER_3
        wf.status = EscalationStatus.TIER_3_NOTIFIED
        wf.tier_3_notified_at = now
        entry = await _dispatch_notification(EscalationTier.TIER_3, wf, ["in_app", "email", "sms"])
        notifications = list(wf.notifications_sent) if wf.notifications_sent else []
        notifications.append(entry)
        wf.notifications_sent = notifications
        escalated += 1

    await db.commit()
    return {"checked_at": now.isoformat(), "auto_escalated": escalated}


# ---------------------------------------------------------------------------
# F-062 — Penalty Calculation Engine Endpoints
# ---------------------------------------------------------------------------

def _calculate_penalty(breach_start: datetime, breach_end: Optional[datetime], rate_per_hour: float) -> tuple[float, float]:
    """Calculate breach duration in minutes and penalty amount."""
    end = breach_end or datetime.now(timezone.utc)
    delta = end - breach_start
    duration_minutes = max(0, delta.total_seconds() / 60)
    duration_hours = duration_minutes / 60
    amount = round(duration_hours * rate_per_hour, 2)
    return duration_minutes, amount


@router.post("/penalties", response_model=PenaltyResponse, status_code=201)
async def create_penalty(
    body: PenaltyCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record an SLA breach penalty (F-062)."""
    duration_minutes, amount = _calculate_penalty(
        body.breach_started_at, body.breach_ended_at, body.penalty_rate_per_hour
    )
    penalty = SLAPenalty(
        sla_id=body.sla_id,
        sla_name=body.sla_name,
        client_name=body.client_name,
        breach_started_at=body.breach_started_at,
        breach_ended_at=body.breach_ended_at,
        breach_duration_minutes=duration_minutes,
        penalty_rate_per_hour=body.penalty_rate_per_hour,
        penalty_amount=amount,
        currency=body.currency,
        status=PenaltyStatus.CALCULATED,
        metadata_json=body.metadata_json,
    )
    db.add(penalty)
    await db.commit()
    await db.refresh(penalty)
    return PenaltyResponse.model_validate(penalty)


@router.get("/penalties", response_model=list[PenaltyResponse])
async def list_penalties(
    client_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all penalty records, optionally filtered by client or status."""
    q = select(SLAPenalty)
    if client_name:
        q = q.where(SLAPenalty.client_name == client_name)
    if status:
        q = q.where(SLAPenalty.status == status)
    q = q.order_by(desc(SLAPenalty.created_at)).limit(limit)
    result = await db.execute(q)
    return [PenaltyResponse.model_validate(p) for p in result.scalars().all()]


@router.get("/penalties/forecast", response_model=PenaltyCalculation)
async def penalty_forecast(
    db: AsyncSession = Depends(get_db),
):
    """Aggregate penalty forecast: total penalties, by client, by status (F-062)."""
    result = await db.execute(select(SLAPenalty))
    penalties = result.scalars().all()

    if not penalties:
        return PenaltyCalculation(
            total_penalties=0, total_breaches=0,
            avg_breach_duration_minutes=0,
            penalties_by_client=[], penalties_by_status={},
        )

    total = sum(p.penalty_amount for p in penalties)
    avg_dur = sum(p.breach_duration_minutes for p in penalties) / len(penalties)

    by_client: dict[str, float] = {}
    by_status: dict[str, int] = {}
    for p in penalties:
        client = p.client_name or "Unknown"
        by_client[client] = by_client.get(client, 0) + p.penalty_amount
        by_status[p.status] = by_status.get(p.status, 0) + 1

    return PenaltyCalculation(
        total_penalties=round(total, 2),
        total_breaches=len(penalties),
        avg_breach_duration_minutes=round(avg_dur, 1),
        penalties_by_client=[
            {"client": k, "total_penalty": round(v, 2)} for k, v in by_client.items()
        ],
        penalties_by_status=by_status,
    )


@router.get("/penalties/{penalty_id}", response_model=PenaltyResponse)
async def get_penalty(
    penalty_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SLAPenalty).where(SLAPenalty.id == penalty_id))
    penalty = result.scalar_one_or_none()
    if not penalty:
        raise HTTPException(404, "Penalty record not found")
    return PenaltyResponse.model_validate(penalty)


@router.patch("/penalties/{penalty_id}/close", response_model=PenaltyResponse)
async def close_penalty(
    penalty_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Close an open breach — recalculate final penalty amount."""
    result = await db.execute(select(SLAPenalty).where(SLAPenalty.id == penalty_id))
    penalty = result.scalar_one_or_none()
    if not penalty:
        raise HTTPException(404, "Penalty record not found")

    now = datetime.now(timezone.utc)
    penalty.breach_ended_at = now
    duration_minutes, amount = _calculate_penalty(
        penalty.breach_started_at, now, penalty.penalty_rate_per_hour
    )
    penalty.breach_duration_minutes = duration_minutes
    penalty.penalty_amount = amount
    penalty.status = PenaltyStatus.CALCULATED
    await db.commit()
    await db.refresh(penalty)
    return PenaltyResponse.model_validate(penalty)


@router.post("/penalties/{penalty_id}/waive", response_model=PenaltyResponse)
async def waive_penalty(
    penalty_id: uuid.UUID,
    body: PenaltyWaiver,
    db: AsyncSession = Depends(get_db),
):
    """Waive a penalty with justification."""
    result = await db.execute(select(SLAPenalty).where(SLAPenalty.id == penalty_id))
    penalty = result.scalar_one_or_none()
    if not penalty:
        raise HTTPException(404, "Penalty record not found")

    penalty.status = PenaltyStatus.WAIVED
    penalty.waiver_reason = body.waiver_reason
    await db.commit()
    await db.refresh(penalty)
    return PenaltyResponse.model_validate(penalty)


@router.post("/penalties/{penalty_id}/invoice", response_model=PenaltyResponse)
async def mark_invoiced(
    penalty_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Mark penalty as invoiced."""
    result = await db.execute(select(SLAPenalty).where(SLAPenalty.id == penalty_id))
    penalty = result.scalar_one_or_none()
    if not penalty:
        raise HTTPException(404, "Penalty record not found")

    penalty.status = PenaltyStatus.INVOICED
    penalty.invoiced_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(penalty)
    return PenaltyResponse.model_validate(penalty)
