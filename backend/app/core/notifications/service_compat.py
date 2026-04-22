"""
Intelli Platform - Notifications Service Compatibility Layer

Preserves the legacy NotificationService interface used by Depot vision
modules while routing delivery through the current in-memory notification
engine. This avoids importing stale ORM-only notification models.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.notifications.engine import get_notification_engine
from app.core.notifications.models import (
    DeliveryStatus,
    NotificationChannel,
    NotificationPriority,
    NotificationRecipient,
    NotificationRequest,
)
from app.core.observability.audit import log_action

logger = logging.getLogger(__name__)


@dataclass
class NotificationPreference:
    user_id: UUID
    email_enabled: bool = True
    webhook_enabled: bool = False
    in_app_enabled: bool = True
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    webhook_url: str | None = None


@dataclass
class NotificationAlert:
    id: str
    user_id: UUID | None
    event_type: str
    title: str
    message: str
    priority: str
    status: str
    channel: str
    payload: dict[str, Any]
    scheduled_at: datetime | None = None
    metadata_json: dict[str, Any] | None = None
    sent_at: datetime | None = None
    snoozed_until: datetime | None = None
    acknowledged_at: datetime | None = None
    escalation_level: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationService:
    """Compatibility API for legacy callers."""

    _preferences: dict[UUID, NotificationPreference] = {}

    @staticmethod
    def _to_priority(priority: str) -> NotificationPriority:
        normalized = (priority or "NORMAL").strip().upper()
        mapping = {
            "LOW": NotificationPriority.LOW,
            "NORMAL": NotificationPriority.NORMAL,
            "MEDIUM": NotificationPriority.NORMAL,
            "HIGH": NotificationPriority.HIGH,
            "CRITICAL": NotificationPriority.URGENT,
            "URGENT": NotificationPriority.URGENT,
        }
        return mapping.get(normalized, NotificationPriority.NORMAL)

    @staticmethod
    def _to_channel(channel: str) -> NotificationChannel:
        normalized = (channel or "in_app").strip().lower()
        mapping = {
            "email": NotificationChannel.EMAIL,
            "webhook": NotificationChannel.WEBHOOK,
            "in_app": NotificationChannel.IN_APP,
        }
        return mapping.get(normalized, NotificationChannel.IN_APP)

    @staticmethod
    async def send_alert(
        db: AsyncSession,
        user_id: UUID | None,
        event_type: str,
        title: str,
        message: str,
        priority: str = "NORMAL",
        payload: dict[str, Any] | None = None,
        channel: str = "in_app",
        scheduled_at: datetime | None = None,
        request_ip: str | None = None,
    ) -> NotificationAlert:
        payload = payload or {}

        if user_id:
            prefs = await NotificationService.get_or_create_preferences(db, user_id)
            if priority.upper() != "CRITICAL" and NotificationService._is_quiet_hours(prefs):
                return NotificationAlert(
                    id="snoozed",
                    user_id=user_id,
                    event_type=event_type,
                    title=title,
                    message=message,
                    priority=priority,
                    status="snoozed",
                    channel=channel,
                    payload=payload,
                    scheduled_at=scheduled_at,
                    metadata_json={"event_type": event_type},
                    snoozed_until=datetime.now(timezone.utc) + timedelta(hours=1),
                )
            if channel == "email" and not prefs.email_enabled:
                return NotificationAlert(
                    id="skipped",
                    user_id=user_id,
                    event_type=event_type,
                    title=title,
                    message=message,
                    priority=priority,
                    status="skipped",
                    channel=channel,
                    payload=payload,
                    scheduled_at=scheduled_at,
                    metadata_json={"event_type": event_type},
                )
            if channel == "webhook" and not prefs.webhook_enabled:
                return NotificationAlert(
                    id="skipped",
                    user_id=user_id,
                    event_type=event_type,
                    title=title,
                    message=message,
                    priority=priority,
                    status="skipped",
                    channel=channel,
                    payload=payload,
                    scheduled_at=scheduled_at,
                    metadata_json={"event_type": event_type},
                )
            if channel == "in_app" and not prefs.in_app_enabled:
                return NotificationAlert(
                    id="skipped",
                    user_id=user_id,
                    event_type=event_type,
                    title=title,
                    message=message,
                    priority=priority,
                    status="skipped",
                    channel=channel,
                    payload=payload,
                    scheduled_at=scheduled_at,
                    metadata_json={"event_type": event_type},
                )

        engine = get_notification_engine()
        request = NotificationRequest(
            channel=NotificationService._to_channel(channel),
            recipients=[
                NotificationRecipient(
                    user_id=str(user_id) if user_id else None,
                    name=str(user_id) if user_id else "system",
                )
            ],
            subject=title,
            body=message,
            priority=NotificationService._to_priority(priority),
            scheduled_at=scheduled_at,
            metadata={"event_type": event_type, **payload},
        )
        records = await engine.send(request)
        record = records[0]
        status = "sent" if record.status == DeliveryStatus.DELIVERED else record.status.value

        try:
            await log_action(
                db,
                action_type="alert_sent",
                resource_type="notification",
                resource_id=record.id,
                details={
                    "event_type": event_type,
                    "channel": channel,
                    "priority": priority,
                    "status": status,
                },
                ip_address=request_ip,
            )
        except Exception as exc:
            logger.warning("Audit log failed for notification %s: %s", record.id, exc)

        return NotificationAlert(
            id=record.id,
            user_id=user_id,
            event_type=event_type,
            title=title,
            message=message,
            priority=priority,
            status=status,
            channel=channel,
            payload=payload,
            scheduled_at=scheduled_at,
            metadata_json={"event_type": event_type},
            sent_at=record.delivered_at,
        )

    @staticmethod
    async def acknowledge_alert(
        db: AsyncSession,
        alert_id: UUID,
        user_id: UUID,
        request_ip: str | None = None,
    ) -> NotificationAlert | None:
        try:
            await log_action(
                db,
                action_type="alert_acknowledged",
                resource_type="notification",
                resource_id=str(alert_id),
                ip_address=request_ip,
            )
        except Exception as exc:
            logger.warning("Audit log failed for acknowledgement %s: %s", alert_id, exc)
        return NotificationAlert(
            id=str(alert_id),
            user_id=user_id,
            event_type="acknowledged",
            title="Acknowledged",
            message="Alert acknowledged",
            priority="NORMAL",
            status="acknowledged",
            channel="in_app",
            payload={},
            acknowledged_at=datetime.now(timezone.utc),
        )

    @staticmethod
    async def snooze_alert(
        db: AsyncSession,
        alert_id: UUID,
        user_id: UUID,
        minutes: int,
        request_ip: str | None = None,
    ) -> NotificationAlert | None:
        if minutes < 1 or minutes > 1440:
            return None
        try:
            await log_action(
                db,
                action_type="alert_snoozed",
                resource_type="notification",
                resource_id=str(alert_id),
                details={"minutes": minutes},
                ip_address=request_ip,
            )
        except Exception as exc:
            logger.warning("Audit log failed for snooze %s: %s", alert_id, exc)
        return NotificationAlert(
            id=str(alert_id),
            user_id=user_id,
            event_type="snoozed",
            title="Snoozed",
            message="Alert snoozed",
            priority="NORMAL",
            status="snoozed",
            channel="in_app",
            payload={},
            snoozed_until=datetime.now(timezone.utc) + timedelta(minutes=minutes),
        )

    @staticmethod
    async def get_user_alerts(
        db: AsyncSession,
        user_id: UUID,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[NotificationAlert], int]:
        del db, user_id, status, priority, limit, offset
        return [], 0

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: UUID) -> int:
        del db, user_id
        return 0

    @staticmethod
    async def get_or_create_preferences(
        db: AsyncSession,
        user_id: UUID,
    ) -> NotificationPreference:
        del db
        prefs = NotificationService._preferences.get(user_id)
        if prefs is None:
            prefs = NotificationPreference(user_id=user_id)
            NotificationService._preferences[user_id] = prefs
        return prefs

    @staticmethod
    async def update_preferences(
        db: AsyncSession,
        user_id: UUID,
        updates: dict[str, Any],
    ) -> NotificationPreference:
        del db
        prefs = await NotificationService.get_or_create_preferences(db, user_id)
        for key, value in updates.items():
            if hasattr(prefs, key):
                setattr(prefs, key, value)
        return prefs

    @staticmethod
    async def check_escalations(
        db: AsyncSession,
    ) -> None:
        del db
        logger.info("Escalation compatibility mode active; no persistent escalation queue configured.")

    @staticmethod
    async def seed_default_templates(db: AsyncSession) -> None:
        del db
        logger.info("Notification templates are managed by the notification engine.")

    @staticmethod
    def _is_quiet_hours(prefs: NotificationPreference) -> bool:
        if not prefs.quiet_hours_start or not prefs.quiet_hours_end:
            return False
        try:
            start_hour, start_minute = map(int, prefs.quiet_hours_start.split(":"))
            end_hour, end_minute = map(int, prefs.quiet_hours_end.split(":"))
            start_time = time(start_hour, start_minute)
            end_time = time(end_hour, end_minute)
            current_time = datetime.now(timezone.utc).time()
            if start_time <= end_time:
                return start_time <= current_time <= end_time
            return current_time >= start_time or current_time <= end_time
        except Exception as exc:
            logger.warning("Quiet hours check failed: %s", exc)
            return False
