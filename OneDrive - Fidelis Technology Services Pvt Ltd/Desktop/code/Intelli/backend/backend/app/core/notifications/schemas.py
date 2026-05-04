"""
Intelli Platform — Notifications Schemas
"""
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


# Type aliases for enums
Priority = Literal["CRITICAL", "HIGH", "NORMAL", "LOW"]
Channel = Literal["email", "webhook", "in_app"]
AlertStatus = Literal["pending", "sent", "failed", "delivered", "acknowledged", "snoozed", "skipped"]


class SendAlertRequest(BaseModel):
    """Request to send an alert."""

    user_id: UUID | None = Field(None, description="Target user (None for broadcast)")
    event_type: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    priority: Priority = Field("NORMAL", description="Alert priority level")
    payload: dict[str, Any] = Field(default_factory=dict)
    channel: Channel = Field("in_app", description="Delivery channel")
    scheduled_at: datetime | None = Field(None, description="Schedule for future delivery")


class AlertResponse(BaseModel):
    """Single alert response."""

    id: UUID
    user_id: UUID | None
    event_type: str
    title: str
    message: str
    priority: Priority
    status: AlertStatus
    channel: Channel
    payload: dict[str, Any]
    escalation_level: int
    acknowledged_at: datetime | None
    snoozed_until: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """List of alerts with pagination info."""

    items: list[AlertResponse]
    total: int
    unread_count: int


class SnoozeRequest(BaseModel):
    """Request to snooze an alert."""

    minutes: int = Field(..., ge=1, le=1440, description="Snooze duration in minutes")


class NotificationPreferenceUpdate(BaseModel):
    """Update notification preferences."""

    email_enabled: bool | None = None
    webhook_enabled: bool | None = None
    in_app_enabled: bool | None = None
    webhook_url: str | None = None
    quiet_hours_start: str | None = Field(None, description="Start time in HH:MM format (UTC)")
    quiet_hours_end: str | None = Field(None, description="End time in HH:MM format (UTC)")


class NotificationPreferenceResponse(BaseModel):
    """User notification preferences."""

    id: UUID
    user_id: UUID
    email_enabled: bool
    webhook_enabled: bool
    in_app_enabled: bool
    webhook_url: str | None
    email_overrides: dict[str, Any]
    quiet_hours_start: str | None
    quiet_hours_end: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationTemplateCreate(BaseModel):
    """Create a notification template."""

    name: str = Field(..., min_length=1, max_length=255)
    event_type: str = Field(..., min_length=1, max_length=100)
    channel: Channel | Literal["all"]
    subject_template: str | None = None
    body_template: str = Field(..., min_length=1)
    is_active: bool = Field(True)


class NotificationTemplateResponse(BaseModel):
    """Notification template response."""

    id: UUID
    name: str
    event_type: str
    channel: str
    subject_template: str | None
    body_template: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    """Unread notification count."""

    count: int
