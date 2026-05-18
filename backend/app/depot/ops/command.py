"""
IntelliDepot Command Center actions.

Turns dashboard quick actions into auditable backend operations instead of
browser-only placeholders.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, desc, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_user
from app.database import BaseModel as DBBaseModel, get_db
from app.depot.gate.lpr import Gate, GateStatus, _get_active_gate
from app.depot.ops.incidents import IncidentPriority, IncidentStatus, OpsIncident
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.command")

router = APIRouter(prefix="/depot/command", tags=["Depot - Command Center"])


class CommandActionType(str, Enum):
    OPEN_GATE = "open_gate"
    CLOSE_GATE = "close_gate"
    LOCK_ZONE = "lock_zone"
    TRIGGER_ALERT = "trigger_alert"
    CONTACT_OPERATOR = "contact_operator"


class CommandActionStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"


class CommandActionLog(DBBaseModel):
    __tablename__ = "depot_command_actions"

    action_type = Column(String, nullable=False, index=True)
    status = Column(String, default=CommandActionStatus.COMPLETED.value, index=True)
    actor_id = Column(String, nullable=True)
    actor_name = Column(String, nullable=True)
    target_type = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    target_name = Column(String, nullable=True)
    zone = Column(String, nullable=True, index=True)
    message = Column(Text, nullable=False)
    priority = Column(String, nullable=True)
    affected_count = Column(Integer, default=0)
    related_incident_id = Column(UUID(as_uuid=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    executed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class GateCommandRequest(BaseModel):
    gate_id: Optional[uuid.UUID] = None
    reason: str = Field("Command Center quick action", max_length=240)


class ZoneLockRequest(BaseModel):
    zone: str = Field("Depot perimeter", max_length=120)
    reason: str = Field("Manual lockdown from Command Center", max_length=500)


class TriggerAlertRequest(BaseModel):
    title: str = Field("Manual Command Center alert", max_length=160)
    message: str = Field("All operators notified from Command Center", max_length=700)
    zone: Optional[str] = Field(None, max_length=120)
    priority: IncidentPriority = IncidentPriority.P2


class ContactOperatorRequest(BaseModel):
    operator: str = Field("Shift Supervisor", max_length=120)
    channel: str = Field("intercom", pattern="^(intercom|radio|phone|in_app)$")
    message: str = Field("Please contact Command Center", max_length=500)
    zone: Optional[str] = Field(None, max_length=120)


class CommandActionResponse(BaseModel):
    id: uuid.UUID
    action_type: str
    status: str
    target_type: Optional[str]
    target_id: Optional[str]
    target_name: Optional[str]
    zone: Optional[str]
    message: str
    priority: Optional[str]
    affected_count: int
    related_incident_id: Optional[uuid.UUID]
    executed_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


def _actor_name(user: User) -> str:
    return getattr(user, "email", None) or getattr(user, "username", None) or str(user.id)


async def _record_action(
    db: AsyncSession,
    *,
    action_type: CommandActionType,
    user: User,
    message: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    target_name: Optional[str] = None,
    zone: Optional[str] = None,
    priority: Optional[str] = None,
    affected_count: int = 0,
    related_incident_id: Optional[uuid.UUID] = None,
    metadata_json: Optional[dict] = None,
) -> CommandActionLog:
    log = CommandActionLog(
        action_type=action_type.value,
        status=CommandActionStatus.COMPLETED.value,
        actor_id=str(user.id),
        actor_name=_actor_name(user),
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        zone=zone,
        message=message,
        priority=priority,
        affected_count=affected_count,
        related_incident_id=related_incident_id,
        metadata_json=metadata_json,
    )
    db.add(log)
    await db.flush()
    return log


async def _select_gate_for_action(db: AsyncSession, gate_id: Optional[uuid.UUID], action: str) -> Gate:
    if gate_id:
        gate = await _get_active_gate(db, gate_id)
        if not gate:
            raise HTTPException(status_code=404, detail="Gate not found")
        return gate

    desired_status = GateStatus.CLOSED.value if action == "open" else GateStatus.OPEN.value
    result = await db.execute(
        select(Gate)
        .where(Gate.is_active == True, Gate.status == desired_status)
        .order_by(Gate.gate_code)
        .limit(1)
    )
    gate = result.scalar_one_or_none()
    if gate:
        return gate

    fallback = await db.execute(
        select(Gate).where(Gate.is_active == True).order_by(Gate.gate_code).limit(1)
    )
    gate = fallback.scalar_one_or_none()
    if not gate:
        raise HTTPException(status_code=404, detail="No active gates available")
    return gate


async def _publish_command_event(action: CommandActionLog) -> None:
    try:
        from app.core.gateway.realtime import realtime_hub

        await realtime_hub.publish(
            topic="depot.command",
            event_type=f"depot.command.{action.action_type}",
            payload={
                "id": str(action.id),
                "action_type": action.action_type,
                "message": action.message,
                "target_name": action.target_name,
                "zone": action.zone,
                "priority": action.priority,
                "executed_at": action.executed_at.isoformat() if action.executed_at else None,
            },
            sender="depot-command",
        )
    except Exception:
        logger.debug("Realtime command publish skipped", exc_info=True)


def _new_incident(
    *,
    title: str,
    description: str,
    priority: IncidentPriority,
    zone: Optional[str],
    assigned_to: str,
    incident_type: str,
    metadata_json: dict,
) -> OpsIncident:
    now = datetime.now(timezone.utc)
    windows = {IncidentPriority.P1: 5, IncidentPriority.P2: 15, IncidentPriority.P3: 60, IncidentPriority.P4: 240}
    scores = {IncidentPriority.P1: 1.0, IncidentPriority.P2: 0.75, IncidentPriority.P3: 0.5, IncidentPriority.P4: 0.25}
    return OpsIncident(
        title=title,
        description=description,
        incident_type=incident_type,
        source="manual",
        priority=priority.value,
        severity_score=scores[priority],
        status=IncidentStatus.OPEN.value,
        zone=zone,
        assigned_to=assigned_to,
        escalation_level=0,
        escalation_chain=[{"tier": assigned_to, "assigned_at": now.isoformat()}],
        escalation_deadline=now + timedelta(minutes=windows[priority]),
        metadata_json=metadata_json,
    )


@router.post("/actions/open-gate", response_model=CommandActionResponse, status_code=201)
async def open_gate_action(
    payload: GateCommandRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gate = await _select_gate_for_action(db, payload.gate_id, "open")
    gate.status = GateStatus.OPEN.value
    gate.last_opened = datetime.now(timezone.utc)

    action = await _record_action(
        db,
        action_type=CommandActionType.OPEN_GATE,
        user=current_user,
        target_type="gate",
        target_id=str(gate.id),
        target_name=gate.name,
        message=f"{gate.name} opened from Command Center",
        affected_count=1,
        metadata_json={"reason": payload.reason, "gate_code": gate.gate_code},
    )
    await db.commit()
    await db.refresh(action)
    await _publish_command_event(action)
    return action


@router.post("/actions/close-gate", response_model=CommandActionResponse, status_code=201)
async def close_gate_action(
    payload: GateCommandRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gate = await _select_gate_for_action(db, payload.gate_id, "close")
    gate.status = GateStatus.CLOSED.value
    gate.last_closed = datetime.now(timezone.utc)

    action = await _record_action(
        db,
        action_type=CommandActionType.CLOSE_GATE,
        user=current_user,
        target_type="gate",
        target_id=str(gate.id),
        target_name=gate.name,
        message=f"{gate.name} closed from Command Center",
        affected_count=1,
        metadata_json={"reason": payload.reason, "gate_code": gate.gate_code},
    )
    await db.commit()
    await db.refresh(action)
    await _publish_command_event(action)
    return action


@router.post("/actions/lock-zone", response_model=CommandActionResponse, status_code=201)
async def lock_zone_action(
    payload: ZoneLockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Gate).where(Gate.is_active == True))
    gates = result.scalars().all()
    now = datetime.now(timezone.utc)
    closed_count = 0
    for gate in gates:
        if gate.status != GateStatus.CLOSED.value:
            gate.status = GateStatus.CLOSED.value
            gate.last_closed = now
            closed_count += 1

    incident = _new_incident(
        title=f"Zone lockdown initiated: {payload.zone}",
        description=payload.reason,
        priority=IncidentPriority.P1,
        zone=payload.zone,
        assigned_to="Shift Supervisor",
        incident_type="security",
        metadata_json={"command_action": CommandActionType.LOCK_ZONE.value, "closed_gates": closed_count},
    )
    db.add(incident)
    await db.flush()

    action = await _record_action(
        db,
        action_type=CommandActionType.LOCK_ZONE,
        user=current_user,
        target_type="zone",
        target_name=payload.zone,
        zone=payload.zone,
        message=f"Lockdown started for {payload.zone}; {closed_count} gate(s) secured",
        priority=IncidentPriority.P1.value,
        affected_count=closed_count,
        related_incident_id=incident.id,
        metadata_json={"reason": payload.reason},
    )
    await db.commit()
    await db.refresh(action)
    await _publish_command_event(action)
    return action


@router.post("/actions/trigger-alert", response_model=CommandActionResponse, status_code=201)
async def trigger_alert_action(
    payload: TriggerAlertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    incident = _new_incident(
        title=payload.title,
        description=payload.message,
        priority=payload.priority,
        zone=payload.zone,
        assigned_to="Shift Supervisor",
        incident_type="command_alert",
        metadata_json={"command_action": CommandActionType.TRIGGER_ALERT.value},
    )
    db.add(incident)
    await db.flush()

    action = await _record_action(
        db,
        action_type=CommandActionType.TRIGGER_ALERT,
        user=current_user,
        target_type="broadcast",
        zone=payload.zone,
        message=f"Alert broadcast: {payload.title}",
        priority=payload.priority.value,
        affected_count=1,
        related_incident_id=incident.id,
        metadata_json={"message": payload.message},
    )
    await db.commit()
    await db.refresh(action)
    await _publish_command_event(action)
    return action


@router.post("/actions/contact-operator", response_model=CommandActionResponse, status_code=201)
async def contact_operator_action(
    payload: ContactOperatorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action = await _record_action(
        db,
        action_type=CommandActionType.CONTACT_OPERATOR,
        user=current_user,
        target_type="operator",
        target_name=payload.operator,
        zone=payload.zone,
        message=f"{payload.operator} paged via {payload.channel}",
        affected_count=1,
        metadata_json={"channel": payload.channel, "message": payload.message},
    )
    await db.commit()
    await db.refresh(action)
    await _publish_command_event(action)
    return action


@router.get("/actions/recent", response_model=list[CommandActionResponse])
async def recent_command_actions(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CommandActionLog).order_by(desc(CommandActionLog.executed_at)).limit(min(limit, 100))
    )
    return result.scalars().all()
