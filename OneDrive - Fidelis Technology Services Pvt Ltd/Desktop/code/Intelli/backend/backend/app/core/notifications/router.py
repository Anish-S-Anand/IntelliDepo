"""
Intelli Platform — Notification Engine API Router
Feature: NOTIF-6.7

Endpoints for sending notifications, managing templates,
checking delivery status, and viewing history.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.core.notifications.engine import (
    NotificationEngine,
    get_notification_engine,
)
from app.core.notifications.models import (
    DeliveryStatus,
    NotificationChannel,
    NotificationPriority,
    NotificationRecipient,
    NotificationRequest,
    NotificationTemplate,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["Notification Engine"])


def get_engine() -> NotificationEngine:
    return get_notification_engine()


# ── Request Schemas ────────────────────────────────────────


class CreateTemplateRequest(BaseModel):
    name: str
    channel: NotificationChannel
    subject: str = ""
    body: str
    description: str = ""


class SendNotificationRequest(BaseModel):
    template_id: str | None = None
    channel: NotificationChannel
    recipients: list[NotificationRecipient]
    subject: str = ""
    body: str = ""
    variables: dict[str, str] = Field(default_factory=dict)
    priority: NotificationPriority = NotificationPriority.NORMAL


# ── Template Endpoints ─────────────────────────────────────


@router.post("/templates")
async def create_template(
    req: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Create a new notification template."""
    template = NotificationTemplate(
        name=req.name,
        channel=req.channel,
        subject=req.subject,
        body=req.body,
        description=req.description,
    )
    result = engine.register_template(template)
    return result.model_dump()


@router.get("/templates")
async def list_templates(
    channel: NotificationChannel | None = None,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """List all notification templates."""
    templates = engine.list_templates(channel=channel)
    return {"templates": [t.model_dump() for t in templates]}


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Get a specific template by ID."""
    template = engine.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template.model_dump()


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Deactivate a notification template."""
    if engine.delete_template(template_id):
        return {"status": "deleted", "template_id": template_id}
    raise HTTPException(status_code=404, detail="Template not found")


# ── Sending Endpoints ──────────────────────────────────────


@router.post("/send")
async def send_notification(
    req: SendNotificationRequest,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Send a notification to one or more recipients."""
    notification_req = NotificationRequest(
        template_id=req.template_id,
        channel=req.channel,
        recipients=req.recipients,
        subject=req.subject,
        body=req.body,
        variables=req.variables,
        priority=req.priority,
    )

    try:
        records = await engine.send(notification_req)
        return {
            "sent": len(records),
            "notifications": [
                {
                    "id": r.id,
                    "status": r.status.value,
                    "recipient": r.recipient.name or r.recipient.user_id,
                }
                for r in records
            ],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/queue/process")
async def process_queue(
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Process all queued notifications ready for delivery."""
    processed = await engine.process_queue()
    return {
        "processed": len(processed),
        "results": [
            {"id": r.id, "status": r.status.value}
            for r in processed
        ],
    }


@router.post("/cancel/{notification_id}")
async def cancel_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Cancel a queued notification."""
    if engine.cancel_queued(notification_id):
        return {"status": "cancelled", "id": notification_id}
    raise HTTPException(status_code=404, detail="Notification not found in queue")


# ── Tracking Endpoints ─────────────────────────────────────


@router.get("/status/{notification_id}")
async def get_status(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Get delivery status of a notification."""
    status = engine.get_delivery_status(notification_id)
    if not status:
        raise HTTPException(status_code=404, detail="Notification not found")
    return status


@router.get("/history")
async def get_history(
    channel: NotificationChannel | None = None,
    status: DeliveryStatus | None = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Query notification delivery history."""
    records = engine.get_history(channel=channel, status=status, limit=limit)
    return {"notifications": [r.model_dump() for r in records]}


@router.get("/stats")
async def notification_stats(
    current_user: User = Depends(get_current_user),
    engine: NotificationEngine = Depends(get_engine),
):
    """Get notification engine statistics."""
    return engine.get_stats()
