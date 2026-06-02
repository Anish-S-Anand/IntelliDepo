"""
Unified Depot incident API.

Normalizes the current perimeter and IntelliOps incident stores into the
business-facing incident contract defined for the Command & Control workflow.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_user
from app.core.notifications.channels.whatsapp import WhatsAppChannel
from app.database import get_db
from app.depot.access_scope import ensure_scope_access, resolve_access_scope, warehouse_for_zone
from app.depot.gate.lpr import Gate, GateAccessLog
from app.depot.ops.incidents import (
    IncidentAuditEntry,
    IncidentNotification,
    IncidentStatus as OpsIncidentStatus,
    OpsIncident,
)
from app.depot.vision.perimeter import (
    IncidentStatus as PerimeterIncidentStatus,
    PerimeterBreach,
    PerimeterIncident,
    PerimeterZone,
)
from app.shared.models.user import User

router = APIRouter(prefix="/depot/incidents", tags=["Depot - Unified Incidents"])


class UnifiedSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class UnifiedStatus(str, Enum):
    NEW = "new"
    ASSIGNED = "assigned"
    RESPONSE_STARTED = "response_started"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentBusinessAction(str, Enum):
    ASSIGN_RESPONDER = "assign_responder"
    DISPATCH_SECURITY = "dispatch_security"
    NOTIFY_SUPERVISOR = "notify_supervisor"
    MARK_FALSE_ALARM = "mark_false_alarm"
    ESCALATE_TO_REGIONAL_MANAGER = "escalate_to_regional_manager"
    START_RESPONSE = "start_response"
    RESOLVE_WITH_OUTCOME = "resolve_with_outcome"
    ATTACH_EVIDENCE = "attach_evidence"


class NotificationSummary(BaseModel):
    id: str
    channel: str
    recipient: Optional[str] = None
    status: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None


class IncidentTimelineItem(BaseModel):
    id: str
    action: str
    actor: Optional[str] = None
    actor_role: Optional[str] = None
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    details: Optional[str] = None
    occurred_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class UnifiedIncident(BaseModel):
    id: str
    source: str
    source_id: uuid.UUID
    incident_type: str
    title: str
    description: Optional[str] = None
    severity: UnifiedSeverity
    priority: str
    status: UnifiedStatus
    timestamp: datetime
    organization_id: Optional[str] = None
    region_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    cluster_id: Optional[str] = None
    gate_id: Optional[str] = None
    camera_id: Optional[str] = None
    location_label: str
    assigned_to: Optional[str] = None
    detected_entity: str = "unknown"
    vehicle_plate: Optional[str] = None
    reason: Optional[str] = None
    evidence_snapshot_url: Optional[str] = None
    evidence_video_url: Optional[str] = None
    notification_summary: list[NotificationSummary] = Field(default_factory=list)
    timeline: list[IncidentTimelineItem] = Field(default_factory=list)


class IncidentActionRequest(BaseModel):
    action: IncidentBusinessAction
    notes: str = Field(..., min_length=3, max_length=1000)
    assigned_to: Optional[str] = Field(None, max_length=160)
    channel: Optional[str] = Field(None, max_length=32)
    recipient: Optional[str] = Field(None, max_length=160)
    evidence_snapshot_url: Optional[str] = Field(None, max_length=500)
    evidence_video_url: Optional[str] = Field(None, max_length=500)


class IncidentActionResponse(BaseModel):
    incident: UnifiedIncident
    timeline_item: IncidentTimelineItem

    model_config = ConfigDict(from_attributes=True)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _actor_name(user: User) -> str:
    return getattr(user, "email", None) or getattr(user, "username", None) or str(user.id)


def _role_names(user: User) -> set[str]:
    email = (getattr(user, "email", "") or "").lower()
    demo_roles = {
        "wm.blr@fidelis-demo.com": "warehouse_manager",
        "wm.hyd@fidelis-demo.com": "warehouse_manager",
        "wm.mum@fidelis-demo.com": "warehouse_manager",
        "regional@fidelis-demo.com": "regional_manager",
        "central@fidelis-demo.com": "central_manager",
        "admin@fidelis-demo.com": "admin",
    }
    names = {demo_roles[email]} if email in demo_roles else set()
    names.update(getattr(role, "name", "") for role in getattr(user, "roles", []) if getattr(role, "name", None))
    if getattr(user, "is_superuser", False):
        names.add("admin")
    return names


def _has_any_role(user: User, *roles: str) -> bool:
    names = _role_names(user)
    return bool(names.intersection(roles)) or "admin" in names


def _require_incident_action(user: User, action: IncidentBusinessAction) -> None:
    if action == IncidentBusinessAction.ESCALATE_TO_REGIONAL_MANAGER:
        allowed = _has_any_role(user, "regional_manager", "central_manager", "admin")
    else:
        allowed = _has_any_role(user, "warehouse_manager", "regional_manager", "central_manager", "admin")
    if not allowed:
        raise HTTPException(status_code=403, detail="This persona cannot perform this incident action")


def _severity_from_priority(priority: str | None) -> UnifiedSeverity:
    priority = (priority or "").upper()
    if priority in {"P1", "P2"}:
        return UnifiedSeverity.CRITICAL
    if priority == "P3":
        return UnifiedSeverity.WARNING
    return UnifiedSeverity.INFO


def _priority_from_severity(severity: str | None) -> str:
    severity = (severity or "").lower()
    if severity == "critical":
        return "P1"
    if severity == "high":
        return "P2"
    if severity == "medium":
        return "P3"
    return "P4"


def _severity_from_perimeter(severity: str | None) -> UnifiedSeverity:
    severity = (severity or "").lower()
    if severity in {"critical", "high"}:
        return UnifiedSeverity.CRITICAL
    if severity == "medium":
        return UnifiedSeverity.WARNING
    return UnifiedSeverity.INFO


def _status_from_ops(status: str | None) -> UnifiedStatus:
    normalized = (status or "").lower()
    if normalized == OpsIncidentStatus.OPEN.value:
        return UnifiedStatus.NEW
    if normalized == OpsIncidentStatus.ACKNOWLEDGED.value:
        return UnifiedStatus.ASSIGNED
    if normalized == OpsIncidentStatus.IN_PROGRESS.value:
        return UnifiedStatus.RESPONSE_STARTED
    if normalized == OpsIncidentStatus.ESCALATED.value:
        return UnifiedStatus.ESCALATED
    if normalized == OpsIncidentStatus.RESOLVED.value:
        return UnifiedStatus.RESOLVED
    if normalized == OpsIncidentStatus.CLOSED.value:
        return UnifiedStatus.CLOSED
    return UnifiedStatus.NEW


def _status_from_perimeter(status: str | None) -> UnifiedStatus:
    normalized = (status or "").lower()
    if normalized == PerimeterIncidentStatus.ACKNOWLEDGED.value:
        return UnifiedStatus.ASSIGNED
    if normalized == PerimeterIncidentStatus.ESCALATED.value:
        return UnifiedStatus.ESCALATED
    if normalized == PerimeterIncidentStatus.RESOLVED.value:
        return UnifiedStatus.RESOLVED
    return UnifiedStatus.NEW


def _video_url(filename: str | None) -> str | None:
    if not filename:
        return None
    return f"/depot/vision/cameras/video-library/{quote(filename)}/stream"


def _snapshot_url(camera_id: uuid.UUID | None) -> str | None:
    if not camera_id:
        return None
    return f"/depot/vision/cameras/{camera_id}/snapshot"


def _lpr_snapshot_url(log: GateAccessLog) -> str | None:
    if log.snapshot_ref:
        if log.snapshot_ref.startswith("/"):
            return log.snapshot_ref
        return f"/tmp/{log.snapshot_ref}"
    if log.plate_number:
        return f"/tmp/{quote(log.plate_number)}.png"
    return None


def _detected_entity(incident_type: str, description: str | None = None) -> str:
    text = f"{incident_type} {description or ''}".lower()
    if "vehicle" in text or "plate" in text or "lpr" in text:
        return "vehicle"
    if "person" in text or "worker" in text or "entry" in text or "intrusion" in text:
        return "person"
    return "unknown"


def _notification_from_row(row: IncidentNotification) -> NotificationSummary:
    metadata = row.metadata_json or {}
    return NotificationSummary(
        id=str(row.id),
        channel=row.channel,
        recipient=row.recipient,
        status=row.status,
        sent_at=row.sent_at,
        delivered_at=row.delivered_at,
        read_at=row.read_at,
        provider_message_id=metadata.get("provider_message_id"),
        error_message=metadata.get("error_message"),
    )


def _legacy_warehouse_id(value: str | None, fallback_index: int = 0) -> str:
    metadata_value = (value or "").strip()
    aliases = {
        "hyderabad-warehouse": "WH_HYD",
        "bengaluru-warehouse": "WH_BLR",
        "bangalore-warehouse": "WH_BLR",
        "mumbai-warehouse": "WH_MUM",
        "WH_HYD": "WH_HYD",
        "WH_BLR": "WH_BLR",
        "WH_MUM": "WH_MUM",
    }
    return aliases.get(metadata_value, warehouse_for_zone(metadata_value, fallback_index))


def _region_id_for_warehouse(warehouse_id: str) -> str:
    if warehouse_id in {"WH_HYD", "WH_BLR"}:
        return "REG_SOUTH"
    return "REG_WEST"


def _audit_to_timeline(row: IncidentAuditEntry) -> IncidentTimelineItem:
    return IncidentTimelineItem(
        id=str(row.id),
        action=row.action,
        actor=row.actor,
        actor_role=row.actor_role,
        previous_state=row.previous_state,
        new_state=row.new_state,
        details=row.details,
        occurred_at=row.created_at,
        metadata=row.metadata_json or {},
    )


async def _ops_notifications(db: AsyncSession, incident_id: uuid.UUID) -> list[NotificationSummary]:
    rows = (await db.execute(
        select(IncidentNotification)
        .where(IncidentNotification.incident_id == incident_id)
        .order_by(desc(IncidentNotification.sent_at))
    )).scalars().all()
    return [_notification_from_row(row) for row in rows]


async def _ops_timeline(db: AsyncSession, incident: OpsIncident) -> list[IncidentTimelineItem]:
    rows = (await db.execute(
        select(IncidentAuditEntry)
        .where(IncidentAuditEntry.incident_id == incident.id)
        .order_by(IncidentAuditEntry.created_at)
    )).scalars().all()
    timeline = [_audit_to_timeline(row) for row in rows]
    if not timeline:
        timeline.append(IncidentTimelineItem(
            id=f"ops-created-{incident.id}",
            action="created",
            actor="system",
            new_state=incident.status,
            details=incident.description,
            occurred_at=incident.created_at,
        ))
    return timeline


async def _perimeter_timeline(db: AsyncSession, incident: PerimeterIncident) -> list[IncidentTimelineItem]:
    rows = (await db.execute(
        select(IncidentAuditEntry)
        .where(IncidentAuditEntry.incident_id == incident.id)
        .order_by(IncidentAuditEntry.created_at)
    )).scalars().all()
    timeline = [_audit_to_timeline(row) for row in rows]
    timeline.insert(0, IncidentTimelineItem(
        id=f"perimeter-created-{incident.id}",
        action="created",
        actor="perimeter",
        new_state=incident.status,
        details=incident.description,
        occurred_at=incident.created_at,
    ))
    if incident.acknowledged_at:
        timeline.append(IncidentTimelineItem(
            id=f"perimeter-ack-{incident.id}",
            action="assigned",
            actor=incident.acknowledged_by,
            new_state=UnifiedStatus.ASSIGNED.value,
            details="Incident response accepted",
            occurred_at=incident.acknowledged_at,
        ))
    if incident.resolved_at:
        timeline.append(IncidentTimelineItem(
            id=f"perimeter-resolved-{incident.id}",
            action="resolved",
            actor=incident.resolved_by,
            new_state=UnifiedStatus.RESOLVED.value,
            details=incident.resolution_notes,
            occurred_at=incident.resolved_at,
        ))
    return sorted(timeline, key=lambda item: item.occurred_at)


async def _map_ops_incident(db: AsyncSession, incident: OpsIncident, include_detail: bool = False) -> UnifiedIncident:
    metadata = incident.metadata_json or {}
    notifications = await _ops_notifications(db, incident.id) if include_detail else []
    timeline = await _ops_timeline(db, incident) if include_detail else []
    incident_type = incident.incident_type or incident.source or "manual"
    warehouse_id = _legacy_warehouse_id(metadata.get("warehouse_id") or incident.zone)
    region_id = metadata.get("region_id") or _region_id_for_warehouse(warehouse_id)

    return UnifiedIncident(
        id=str(incident.id),
        source="ops",
        source_id=incident.id,
        incident_type=incident_type,
        title=incident.title,
        description=incident.description,
        severity=_severity_from_priority(incident.priority),
        priority=incident.priority or "P3",
        status=_status_from_ops(incident.status),
        timestamp=incident.created_at,
        organization_id=metadata.get("organization_id"),
        region_id=region_id,
        warehouse_id=warehouse_id,
        cluster_id=metadata.get("cluster_id"),
        gate_id=metadata.get("gate_id"),
        camera_id=metadata.get("camera_id"),
        location_label=incident.zone or metadata.get("location_label") or "Warehouse",
        assigned_to=incident.assigned_to,
        detected_entity=metadata.get("detected_entity") or _detected_entity(incident_type, incident.description),
        vehicle_plate=metadata.get("vehicle_plate"),
        reason=metadata.get("reason"),
        evidence_snapshot_url=metadata.get("evidence_snapshot_url"),
        evidence_video_url=metadata.get("evidence_video_url"),
        notification_summary=notifications,
        timeline=timeline,
    )


async def _map_perimeter_incident(
    db: AsyncSession,
    incident: PerimeterIncident,
    include_detail: bool = False,
) -> UnifiedIncident:
    breach = await db.get(PerimeterBreach, incident.breach_id)
    zone = await db.get(PerimeterZone, incident.zone_id)
    notifications = await _ops_notifications(db, incident.id) if include_detail else []
    timeline = await _perimeter_timeline(db, incident) if include_detail else []
    incident_type = breach.breach_type if breach else "perimeter"
    camera_id = breach.camera_id if breach else None
    warehouse_id = warehouse_for_zone(zone.name if zone else str(incident.zone_id))

    return UnifiedIncident(
        id=str(incident.id),
        source="perimeter",
        source_id=incident.id,
        incident_type=incident_type,
        title=incident.title,
        description=incident.description,
        severity=_severity_from_perimeter(incident.severity),
        priority=_priority_from_severity(incident.severity),
        status=_status_from_perimeter(incident.status),
        timestamp=incident.created_at,
        region_id=_region_id_for_warehouse(warehouse_id),
        warehouse_id=warehouse_id,
        gate_id=None,
        camera_id=str(camera_id) if camera_id else None,
        location_label=zone.name if zone else str(incident.zone_id),
        assigned_to=incident.escalated_to,
        detected_entity=_detected_entity(incident_type, incident.description),
        reason=breach.notes or incident.description or f"Perimeter breach: {incident_type.replace('_', ' ')}",
        evidence_snapshot_url=_snapshot_url(camera_id),
        evidence_video_url=_video_url(incident.video_archive_ref),
        notification_summary=notifications,
        timeline=timeline,
    )


async def _map_gate_access_incident(
    db: AsyncSession,
    log: GateAccessLog,
    include_detail: bool = False,
) -> UnifiedIncident:
    gate = await db.get(Gate, log.gate_id)
    reason = log.denied_reason or f"LPR access decision: {log.decision}"
    title = f"Unauthorized vehicle entry attempt - {log.plate_number}"
    timestamp = log.processed_at or _now()
    timeline = [
        IncidentTimelineItem(
            id=f"gate-log-{log.id}",
            action="unauthorized_entry_detected",
            actor="lpr",
            new_state=UnifiedStatus.NEW.value,
            details=reason,
            occurred_at=timestamp,
            metadata={
                "decision": log.decision,
                "gate_code": log.gate_code,
                "plate_confidence": log.plate_confidence,
                "reason": reason,
            },
        )
    ] if include_detail else []

    return UnifiedIncident(
        id=str(log.id),
        source="gate_access",
        source_id=log.id,
        incident_type="unauthorized_entry",
        title=title,
        description=f"{log.direction.title()} denied for vehicle {log.plate_number}. Reason: {reason}",
        severity=UnifiedSeverity.CRITICAL if log.decision in {"blacklisted", "denied"} else UnifiedSeverity.WARNING,
        priority="P1" if log.decision == "blacklisted" else "P2",
        status=UnifiedStatus.NEW,
        timestamp=timestamp,
        organization_id="fidelis",
        region_id="REG_SOUTH",
        warehouse_id="WH_BLR",
        cluster_id="BLR-Z1",
        gate_id=str(log.gate_id),
        camera_id=str(gate.camera_id) if gate and gate.camera_id else None,
        location_label=f"{log.gate_code or gate.name if gate else 'Gate'} / Zone 1",
        assigned_to="Security Team",
        detected_entity="vehicle",
        vehicle_plate=log.plate_number,
        reason=reason,
        evidence_snapshot_url=_lpr_snapshot_url(log),
        evidence_video_url=None,
        notification_summary=[],
        timeline=timeline,
    )


async def _get_unified_incident(db: AsyncSession, incident_id: uuid.UUID, include_detail: bool = True) -> UnifiedIncident:
    ops_incident = await db.get(OpsIncident, incident_id)
    if ops_incident:
        return await _map_ops_incident(db, ops_incident, include_detail=include_detail)

    perimeter_incident = await db.get(PerimeterIncident, incident_id)
    if perimeter_incident:
        return await _map_perimeter_incident(db, perimeter_incident, include_detail=include_detail)

    gate_log = await db.get(GateAccessLog, incident_id)
    if gate_log and gate_log.decision != "granted":
        return await _map_gate_access_incident(db, gate_log, include_detail=include_detail)

    raise HTTPException(status_code=404, detail="Incident not found")


async def _get_scoped_unified_incident(
    db: AsyncSession,
    incident_id: uuid.UUID,
    user: User,
    include_detail: bool = True,
) -> UnifiedIncident:
    incident = await _get_unified_incident(db, incident_id, include_detail=include_detail)
    ensure_scope_access(resolve_access_scope(user), warehouse_id=incident.warehouse_id, region_id=incident.region_id)
    return incident


async def _log_action(
    db: AsyncSession,
    incident_id: uuid.UUID,
    action: IncidentBusinessAction,
    user: User,
    previous_state: str | None,
    new_state: str | None,
    details: str,
    metadata: dict[str, Any] | None = None,
) -> IncidentAuditEntry:
    entry = IncidentAuditEntry(
        incident_id=incident_id,
        action=action.value,
        actor=_actor_name(user),
        actor_role="operator",
        previous_state=previous_state,
        new_state=new_state,
        details=details,
        metadata_json=metadata or {},
    )
    db.add(entry)
    await db.flush()
    return entry


async def _record_notification(
    db: AsyncSession,
    incident_id: uuid.UUID,
    channel: str,
    recipient: str,
    status: str,
    title: str,
    priority: str,
    provider_message_id: str | None = None,
    error_message: str | None = None,
) -> IncidentNotification:
    row = IncidentNotification(
        incident_id=incident_id,
        channel=channel,
        recipient=recipient,
        status=status,
        sent_at=_now(),
        metadata_json={
            "title": title,
            "priority": priority,
            "provider_message_id": provider_message_id,
            "error_message": error_message,
        },
    )
    db.add(row)
    await db.flush()
    return row


async def _send_business_notification(
    db: AsyncSession,
    incident_id: uuid.UUID,
    *,
    channel: str,
    recipient: str,
    title: str,
    body: str,
    priority: str,
) -> IncidentNotification:
    normalized_channel = (channel or "in_app").lower()
    provider_message_id = None
    error_message = None
    status = "sent"

    if normalized_channel == "whatsapp":
        result = await WhatsAppChannel.send(to_phone=recipient, body=body)
        provider_message_id = result.provider_message_id
        error_message = result.error_message
        status = result.status if result.success else "failed"

    return await _record_notification(
        db,
        incident_id,
        normalized_channel,
        recipient,
        status,
        title,
        priority,
        provider_message_id=provider_message_id,
        error_message=error_message,
    )


@router.get("/unified", response_model=list[UnifiedIncident])
async def list_unified_incidents(
    warehouse_id: Optional[str] = None,
    region_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List business-facing incidents across ops and perimeter sources."""
    access_scope = resolve_access_scope(current_user)
    if warehouse_id or region_id:
        ensure_scope_access(access_scope, warehouse_id=warehouse_id, region_id=region_id)
    ops_rows = (await db.execute(
        select(OpsIncident).order_by(desc(OpsIncident.created_at)).limit(limit)
    )).scalars().all()
    perimeter_rows = (await db.execute(
        select(PerimeterIncident).order_by(desc(PerimeterIncident.created_at)).limit(limit)
    )).scalars().all()
    gate_denial_rows = (await db.execute(
        select(GateAccessLog)
        .where(GateAccessLog.decision != "granted")
        .order_by(desc(GateAccessLog.processed_at))
        .limit(limit)
    )).scalars().all()

    incidents: list[UnifiedIncident] = []
    for row in ops_rows:
        incidents.append(await _map_ops_incident(db, row))
    for row in perimeter_rows:
        incidents.append(await _map_perimeter_incident(db, row))
    for row in gate_denial_rows:
        incidents.append(await _map_gate_access_incident(db, row))

    if status:
        incidents = [item for item in incidents if item.status.value == status]
    if severity:
        incidents = [item for item in incidents if item.severity.value == severity]
    incidents = [
        item for item in incidents
        if item.warehouse_id in access_scope.warehouse_ids and item.region_id in access_scope.region_ids
    ]

    return sorted(incidents, key=lambda item: item.timestamp, reverse=True)[:limit]


@router.get("/{incident_id}/detail", response_model=UnifiedIncident)
async def get_unified_incident_detail(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one incident with evidence, notification status, and timeline."""
    return await _get_scoped_unified_incident(db, incident_id, current_user, include_detail=True)


@router.get("/{incident_id}/notifications", response_model=list[NotificationSummary])
async def get_unified_incident_notifications(
    incident_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return per-channel delivery status for an incident."""
    await _get_scoped_unified_incident(db, incident_id, current_user, include_detail=False)
    return await _ops_notifications(db, incident_id)


@router.post("/{incident_id}/actions", response_model=IncidentActionResponse)
async def run_incident_business_action(
    incident_id: uuid.UUID,
    payload: IncidentActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a business-context incident action and append it to the timeline."""
    access_scope = resolve_access_scope(current_user)
    ops_incident = await db.get(OpsIncident, incident_id)
    perimeter_incident = None if ops_incident else await db.get(PerimeterIncident, incident_id)
    if not ops_incident and not perimeter_incident:
        gate_log = await db.get(GateAccessLog, incident_id)
        if gate_log and gate_log.decision != "granted":
            ensure_scope_access(access_scope, warehouse_id="WH_BLR", region_id="REG_SOUTH")
            if payload.action not in {IncidentBusinessAction.NOTIFY_SUPERVISOR, IncidentBusinessAction.ESCALATE_TO_REGIONAL_MANAGER}:
                raise HTTPException(status_code=400, detail="Gate access incidents must be converted before this action")
            _require_incident_action(current_user, payload.action)
            notification = await _record_notification(
                db,
                incident_id,
                payload.channel or "in_app",
                payload.recipient or "Security Supervisor",
                "sent",
                f"Unauthorized entry: {gate_log.plate_number}",
                "P2",
            )
            audit = IncidentTimelineItem(
                id=f"gate-action-{notification.id}",
                action=payload.action.value,
                actor=_actor_name(current_user),
                actor_role="operator",
                previous_state=UnifiedStatus.NEW.value,
                new_state=UnifiedStatus.ESCALATED.value if payload.action == IncidentBusinessAction.ESCALATE_TO_REGIONAL_MANAGER else UnifiedStatus.NEW.value,
                details=payload.notes,
                occurred_at=_now(),
                metadata={"notification_id": str(notification.id), "reason": gate_log.denied_reason},
            )
            await db.commit()
            return IncidentActionResponse(
                incident=await _map_gate_access_incident(db, gate_log, include_detail=True),
                timeline_item=audit,
            )
        raise HTTPException(status_code=404, detail="Incident not found")

    scoped_incident = await _get_unified_incident(db, incident_id, include_detail=False)
    ensure_scope_access(access_scope, warehouse_id=scoped_incident.warehouse_id, region_id=scoped_incident.region_id)
    _require_incident_action(current_user, payload.action)

    previous_state = ops_incident.status if ops_incident else perimeter_incident.status
    new_state = previous_state
    metadata: dict[str, Any] = {}

    if ops_incident:
        if payload.action == IncidentBusinessAction.ASSIGN_RESPONDER:
            ops_incident.assigned_to = payload.assigned_to or ops_incident.assigned_to or "Shift Supervisor"
            ops_incident.status = OpsIncidentStatus.ACKNOWLEDGED.value
            ops_incident.acknowledged_at = _now()
            ops_incident.acknowledged_by = _actor_name(current_user)
            
            # Trigger multi-channel notifications (WhatsApp, Email, WebSocket popup)
            try:
                from app.core.notifications.config import get_orchestrator
                orchestrator = get_orchestrator()
                notification_result = await orchestrator.trigger_acknowledgment_notifications(
                    incident=ops_incident,
                    db=db
                )
                if notification_result.errors:
                    import logging
                    logger = logging.getLogger("intelli.depot.incidents")
                    logger.warning(
                        f"Incident {incident_id} acknowledged with notification errors: "
                        f"{', '.join(notification_result.errors)}"
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger("intelli.depot.incidents")
                logger.error(f"Notification orchestration failed for incident {incident_id}: {e}")
        elif payload.action in {IncidentBusinessAction.DISPATCH_SECURITY, IncidentBusinessAction.START_RESPONSE}:
            ops_incident.assigned_to = payload.assigned_to or ops_incident.assigned_to or "Security Team"
            ops_incident.status = OpsIncidentStatus.IN_PROGRESS.value
        elif payload.action == IncidentBusinessAction.ESCALATE_TO_REGIONAL_MANAGER:
            ops_incident.assigned_to = payload.assigned_to or "Regional Manager"
            ops_incident.escalation_level = int(ops_incident.escalation_level or 0) + 1
            ops_incident.status = OpsIncidentStatus.ESCALATED.value
        elif payload.action in {IncidentBusinessAction.MARK_FALSE_ALARM, IncidentBusinessAction.RESOLVE_WITH_OUTCOME}:
            ops_incident.status = OpsIncidentStatus.RESOLVED.value
            ops_incident.resolved_at = _now()
            ops_incident.resolved_by = _actor_name(current_user)
            ops_incident.resolution_notes = payload.notes
        elif payload.action == IncidentBusinessAction.ATTACH_EVIDENCE:
            metadata = dict(ops_incident.metadata_json or {})
            if payload.evidence_snapshot_url:
                metadata["evidence_snapshot_url"] = payload.evidence_snapshot_url
            if payload.evidence_video_url:
                metadata["evidence_video_url"] = payload.evidence_video_url
            ops_incident.metadata_json = metadata
        elif payload.action == IncidentBusinessAction.NOTIFY_SUPERVISOR:
            notification = await _send_business_notification(
                db,
                incident_id,
                channel=payload.channel or "in_app",
                recipient=payload.recipient or ops_incident.assigned_to or "Shift Supervisor",
                title=ops_incident.title,
                body=payload.notes,
                priority=ops_incident.priority or "P3",
            )
            metadata["notification_id"] = str(notification.id)
        new_state = ops_incident.status
    else:
        if payload.action in {
            IncidentBusinessAction.ASSIGN_RESPONDER,
            IncidentBusinessAction.DISPATCH_SECURITY,
            IncidentBusinessAction.START_RESPONSE,
        }:
            perimeter_incident.status = PerimeterIncidentStatus.ACKNOWLEDGED.value
            perimeter_incident.acknowledged_at = perimeter_incident.acknowledged_at or _now()
            perimeter_incident.acknowledged_by = _actor_name(current_user)
            perimeter_incident.escalated_to = payload.assigned_to or perimeter_incident.escalated_to or "Security Team"
            
            # Trigger multi-channel notifications (WhatsApp, Email, WebSocket popup)
            try:
                from app.core.notifications.config import get_orchestrator
                orchestrator = get_orchestrator()
                notification_result = await orchestrator.trigger_acknowledgment_notifications(
                    incident=perimeter_incident,
                    db=db
                )
                if notification_result.errors:
                    import logging
                    logger = logging.getLogger("intelli.depot.incidents")
                    logger.warning(
                        f"Incident {incident_id} acknowledged with notification errors: "
                        f"{', '.join(notification_result.errors)}"
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger("intelli.depot.incidents")
                logger.error(f"Notification orchestration failed for incident {incident_id}: {e}")
        elif payload.action == IncidentBusinessAction.ESCALATE_TO_REGIONAL_MANAGER:
            perimeter_incident.status = PerimeterIncidentStatus.ESCALATED.value
            perimeter_incident.escalation_level = int(perimeter_incident.escalation_level or 0) + 1
            perimeter_incident.escalated_to = payload.assigned_to or "Regional Manager"
        elif payload.action in {IncidentBusinessAction.MARK_FALSE_ALARM, IncidentBusinessAction.RESOLVE_WITH_OUTCOME}:
            perimeter_incident.status = PerimeterIncidentStatus.RESOLVED.value
            perimeter_incident.resolved_at = _now()
            perimeter_incident.resolved_by = _actor_name(current_user)
            perimeter_incident.resolution_notes = payload.notes
        elif payload.action == IncidentBusinessAction.ATTACH_EVIDENCE and payload.evidence_video_url:
            perimeter_incident.video_archive_ref = payload.evidence_video_url
        elif payload.action == IncidentBusinessAction.NOTIFY_SUPERVISOR:
            notification = await _send_business_notification(
                db,
                incident_id,
                channel=payload.channel or "in_app",
                recipient=payload.recipient or perimeter_incident.escalated_to or "Security Supervisor",
                title=perimeter_incident.title,
                body=payload.notes,
                priority=_priority_from_severity(perimeter_incident.severity),
            )
            metadata["notification_id"] = str(notification.id)
        new_state = perimeter_incident.status

    audit = await _log_action(
        db,
        incident_id,
        payload.action,
        current_user,
        previous_state,
        new_state,
        payload.notes,
        metadata,
    )
    await db.commit()
    await db.refresh(audit)

    incident = await _get_unified_incident(db, incident_id, include_detail=True)
    return IncidentActionResponse(incident=incident, timeline_item=_audit_to_timeline(audit))
