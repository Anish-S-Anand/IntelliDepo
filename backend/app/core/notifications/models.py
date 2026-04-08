"""
Intelli Platform — Notification Engine Data Models
Feature: NOTIF-6.7

Pydantic models for notification templates, delivery queue,
channels, and tracking.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    SLACK = "slack"
    TEAMS = "teams"
    IN_APP = "in_app"
    WEBHOOK = "webhook"


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class TemplateVariable(BaseModel):
    """A variable placeholder in a notification template."""
    name: str
    description: str = ""
    required: bool = True
    default_value: str | None = None


class NotificationTemplate(BaseModel):
    """Reusable notification template with variable substitution."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    channel: NotificationChannel
    subject: str = ""  # For email/in-app
    body: str  # Template body with {{variable}} placeholders
    variables: list[TemplateVariable] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = Field(default_factory=dict)


class NotificationRecipient(BaseModel):
    """A target recipient for a notification."""
    user_id: str | None = None
    email: str | None = None
    phone: str | None = None
    channel_address: str | None = None  # Slack channel, Teams webhook, etc.
    name: str = ""


class NotificationRequest(BaseModel):
    """Request to send a notification."""
    template_id: str | None = None  # Use a template, OR provide body directly
    channel: NotificationChannel
    recipients: list[NotificationRecipient]
    subject: str = ""
    body: str = ""  # Used if no template_id
    variables: dict[str, str] = Field(default_factory=dict)  # Template variable values
    priority: NotificationPriority = NotificationPriority.NORMAL
    scheduled_at: datetime | None = None  # None = send immediately
    metadata: dict = Field(default_factory=dict)


class DeliveryAttempt(BaseModel):
    """Record of a single delivery attempt."""
    attempt_number: int
    status: DeliveryStatus
    error: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    latency_ms: float = 0.0


class NotificationRecord(BaseModel):
    """Complete record of a notification and its delivery status."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_id: str | None = None
    channel: NotificationChannel
    recipient: NotificationRecipient
    subject: str = ""
    body: str  # Rendered body (variables substituted)
    priority: NotificationPriority = NotificationPriority.NORMAL
    status: DeliveryStatus = DeliveryStatus.PENDING
    attempts: list[DeliveryAttempt] = Field(default_factory=list)
    max_retries: int = 3
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered_at: datetime | None = None
    error: str | None = None
    metadata: dict = Field(default_factory=dict)

    @property
    def attempt_count(self) -> int:
        return len(self.attempts)

    @property
    def is_terminal(self) -> bool:
        return self.status in (
            DeliveryStatus.DELIVERED,
            DeliveryStatus.FAILED,
            DeliveryStatus.CANCELLED,
        )
