"""
Intelli Platform — Notifications Service
Feature: NOTIF-2

Core service for managing notification lifecycle: sending, delivery, escalation, preferences.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
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
    created_at: datetime = datetime.now(timezone.utc)


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
        """
        Send an alert notification through specified channel.

        Args:
            db: Database session
            user_id: Target user ID (None for system broadcast)
            event_type: Type of event (e.g., "agent_failed")
            title: Alert title
            message: Alert message
            priority: CRITICAL, HIGH, NORMAL, LOW
            payload: Additional context data
            channel: email, webhook, in_app
            scheduled_at: Schedule for future delivery
            request_ip: IP address for audit logging

        Returns:
            Created NotificationAlert instance
        """
        payload = payload or {}

        # Create alert record
        alert = NotificationAlert(
            user_id=user_id,
            event_type=event_type,
            title=title,
            message=message,
            priority=priority,
            status="pending",
            channel=channel,
            payload=payload,
            scheduled_at=scheduled_at,
            metadata_json={"event_type": event_type},
        )
        db.add(alert)
        await db.flush()

        # If scheduled for future, return early
        if scheduled_at and scheduled_at > datetime.utcnow():
            await db.commit()
            logger.info(f"Alert scheduled for {scheduled_at}: {title}")
            return alert

        # Check user preferences and quiet hours
        if user_id:
            prefs = await NotificationService.get_or_create_preferences(db, user_id)

            # Skip non-critical alerts during quiet hours
            if priority != "CRITICAL" and NotificationService._is_quiet_hours(prefs):
                alert.status = "snoozed"
                alert.snoozed_until = datetime.utcnow() + timedelta(hours=1)
                await db.commit()
                logger.info(f"Alert snoozed due to quiet hours: {title}")
                return alert

            # Check channel opt-out
            if channel == "email" and not prefs.email_enabled:
                alert.status = "skipped"
                await db.commit()
                logger.info(f"Alert skipped (email disabled): {title}")
                return alert
            if channel == "webhook" and not prefs.webhook_enabled:
                alert.status = "skipped"
                await db.commit()
                logger.info(f"Alert skipped (webhook disabled): {title}")
                return alert
            if channel == "in_app" and not prefs.in_app_enabled:
                alert.status = "skipped"
                await db.commit()
                logger.info(f"Alert skipped (in_app disabled): {title}")
                return alert

        # Render template if exists
        template_subject = None
        template_body = None
        try:
            template = await db.scalar(
                select(NotificationTemplate).where(
                    NotificationTemplate.event_type == event_type
                )
            )
            if template:
                template_subject = NotificationService._render_template(
                    template.subject_template or "", payload
                )
                template_body = NotificationService._render_template(
                    template.body_template, payload
                )
        except Exception as e:
            logger.warning(f"Failed to load template for {event_type}: {str(e)}")

        # Dispatch to channel
        success = False
        recipient = ""
        response_code = None
        error_message = None

        if channel == "email" and user_id:
            # Get user email
            user = await db.scalar(select(User).where(User.id == user_id))
            if user and user.email:
                recipient = user.email
                success = await EmailChannel.send(
                    to_email=user.email,
                    subject=template_subject or title,
                    body=template_body or message,
                )
                response_code = 200 if success else 500

        elif channel == "webhook" and user_id:
            prefs = await db.scalar(
                select(NotificationPreference).where(
                    NotificationPreference.user_id == user_id
                )
            )
            if prefs and prefs.webhook_url:
                recipient = prefs.webhook_url
                webhook_payload = {
                    "alert_id": str(alert.id),
                    "title": title,
                    "message": template_body or message,
                    "priority": priority,
                    "event_type": event_type,
                    "payload": payload,
                }
                success = await WebhookChannel.send(prefs.webhook_url, webhook_payload)
                response_code = 200 if success else 500

        elif channel == "in_app":
            recipient = str(user_id) if user_id else "broadcast"
            success = await InAppChannel.send(
                user_id=str(user_id) if user_id else None,
                alert_id=str(alert.id),
                title=title,
                message=template_body or message,
                priority=priority,
                payload=payload,
            )
            response_code = 200 if success else 500

        # Log delivery
        delivery_log = NotificationDeliveryLog(
            alert_id=alert.id,
            channel=channel,
            recipient=recipient,
            status="sent" if success else "failed",
            response_code=response_code,
            error_message=error_message,
            attempt_number=1,
            delivered_at=datetime.utcnow() if success else None,
        )
        db.add(delivery_log)

        # Update alert status
        alert.status = "sent" if success else "failed"
        alert.sent_at = datetime.utcnow() if success else None

        await db.commit()

        # Audit log
        await log_action(
            db,
            action_type="alert_sent",
            resource_type="notification",
            resource_id=str(alert.id),
            details={
                "event_type": event_type,
                "channel": channel,
                "priority": priority,
                "status": alert.status,
            },
            ip_address=request_ip,
        )

        logger.info(
            f"Alert sent ({channel}): {title} — status={alert.status}"
        )
        return alert

    @staticmethod
    async def acknowledge_alert(
        db: AsyncSession,
        alert_id: UUID,
        user_id: UUID,
        request_ip: str | None = None,
    ) -> NotificationAlert | None:
        """Mark an alert as acknowledged."""
        alert = await db.scalar(
            select(NotificationAlert).where(
                and_(
                    NotificationAlert.id == alert_id,
                    NotificationAlert.user_id == user_id,
                )
            )
        )
        if not alert:
            return None

        alert.status = "acknowledged"
        alert.acknowledged_at = datetime.utcnow()
        await db.commit()

        await log_action(
            db,
            action_type="alert_acknowledged",
            resource_type="notification",
            resource_id=str(alert_id),
            ip_address=request_ip,
        )

        return alert

    @staticmethod
    async def snooze_alert(
        db: AsyncSession,
        alert_id: UUID,
        user_id: UUID,
        minutes: int,
        request_ip: str | None = None,
    ) -> NotificationAlert | None:
        """Snooze an alert for N minutes."""
        if minutes < 1 or minutes > 1440:
            return None

        alert = await db.scalar(
            select(NotificationAlert).where(
                and_(
                    NotificationAlert.id == alert_id,
                    NotificationAlert.user_id == user_id,
                )
            )
        )
        if not alert:
            return None

        alert.status = "snoozed"
        alert.snoozed_until = datetime.utcnow() + timedelta(minutes=minutes)
        await db.commit()

        await log_action(
            db,
            action_type="alert_snoozed",
            resource_type="notification",
            resource_id=str(alert_id),
            details={"minutes": minutes},
            ip_address=request_ip,
        )

        return alert

    @staticmethod
    async def get_user_alerts(
        db: AsyncSession,
        user_id: UUID,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[NotificationAlert], int]:
        """Fetch user alerts with optional filtering."""
        query = select(NotificationAlert).where(NotificationAlert.user_id == user_id)

        if status:
            query = query.where(NotificationAlert.status == status)
        if priority:
            query = query.where(NotificationAlert.priority == priority)

        # Get total count
        count_query = select(NotificationAlert).where(NotificationAlert.user_id == user_id)
        if status:
            count_query = count_query.where(NotificationAlert.status == status)
        if priority:
            count_query = count_query.where(NotificationAlert.priority == priority)

        total = await db.scalar(
            select(NotificationAlert).where(NotificationAlert.user_id == user_id).count()
        )

        # Fetch paginated results
        alerts = await db.scalars(
            query.order_by(NotificationAlert.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return list(alerts), total

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: UUID) -> int:
        """Get count of unread alerts (status in sent, delivered, pending)."""
        count = await db.scalar(
            select(NotificationAlert).where(
                and_(
                    NotificationAlert.user_id == user_id,
                    NotificationAlert.status.in_(["sent", "delivered", "pending"]),
                )
            ).count()
        )
        return count or 0

    @staticmethod
    async def get_or_create_preferences(
        db: AsyncSession,
        user_id: UUID,
    ) -> NotificationPreference:
        """Fetch or create default preferences for user."""
        prefs = await db.scalar(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
        )

        if not prefs:
            prefs = NotificationPreference(
                user_id=user_id,
                email_enabled=True,
                webhook_enabled=False,
                in_app_enabled=True,
                quiet_hours_start=None,
                quiet_hours_end=None,
            )
            db.add(prefs)
            await db.commit()

        return prefs

    @staticmethod
    async def update_preferences(
        db: AsyncSession,
        user_id: UUID,
        updates: dict[str, Any],
    ) -> NotificationPreference:
        """Update notification preferences."""
        prefs = await NotificationService.get_or_create_preferences(db, user_id)

        for key, value in updates.items():
            if hasattr(prefs, key) and key not in ["id", "user_id", "created_at", "updated_at"]:
                setattr(prefs, key, value)

        await db.commit()
        return prefs

    @staticmethod
    async def check_escalations(
        db: AsyncSession,
    ) -> None:
        """
        Find unacknowledged alerts past escalation TTL and create escalated copies.

        This is typically called by a background task.
        """
        ttl_cutoff = datetime.utcnow() - timedelta(
            minutes=settings.NOTIFICATION_ESCALATION_TTL_MINUTES
        )

        # Find alerts needing escalation
        escalation_candidates = await db.scalars(
            select(NotificationAlert).where(
                and_(
                    NotificationAlert.status.in_(["sent", "pending"]),
                    NotificationAlert.created_at <= ttl_cutoff,
                    NotificationAlert.escalation_level < 2,  # Max 2 escalations
                )
            )
        )

        for alert in escalation_candidates:
            # Create escalated copy
            escalated = NotificationAlert(
                user_id=alert.user_id,
                event_type=alert.event_type,
                title=f"[ESCALATED] {alert.title}",
                message=alert.message,
                priority="CRITICAL" if alert.priority != "CRITICAL" else "CRITICAL",
                status="pending",
                channel=alert.channel,
                payload=alert.payload,
                escalation_level=alert.escalation_level + 1,
                parent_alert_id=alert.id,
                metadata_json=alert.metadata_json,
            )
            db.add(escalated)

        await db.commit()
        logger.info(f"Escalation check completed: {len(list(escalation_candidates))} escalated")

    @staticmethod
    async def seed_default_templates(db: AsyncSession) -> None:
        """Seed default notification templates at startup (idempotent)."""
        defaults = [
            {
                "name": "agent_failed",
                "event_type": "agent_failed",
                "channel": "all",
                "subject_template": "Agent Execution Failed: {{ agent_name }}",
                "body_template": "Agent {{ agent_name }} failed with error: {{ error_message }}",
            },
            {
                "name": "threshold_exceeded",
                "event_type": "threshold_exceeded",
                "channel": "all",
                "subject_template": "Threshold Exceeded: {{ metric_name }}",
                "body_template": "{{ metric_name }} exceeded threshold at {{ value }}",
            },
            {
                "name": "system_alert",
                "event_type": "system_alert",
                "channel": "all",
                "subject_template": "System Alert",
                "body_template": "{{ message }}",
            },
            {
                "name": "user_invite",
                "event_type": "user_invite",
                "channel": "email",
                "subject_template": "You're invited to Intelli Platform",
                "body_template": "Click here to accept invite: {{ invite_link }}",
            },
            {
                "name": "password_reset",
                "event_type": "password_reset",
                "channel": "email",
                "subject_template": "Reset Your Intelli Password",
                "body_template": "Reset your password here: {{ reset_link }}",
            },
        ]

        for template_data in defaults:
            # Check if already exists
            existing = await db.scalar(
                select(NotificationTemplate).where(
                    NotificationTemplate.name == template_data["name"]
                )
            )
            if not existing:
                template = NotificationTemplate(
                    name=template_data["name"],
                    event_type=template_data["event_type"],
                    channel=template_data["channel"],
                    subject_template=template_data.get("subject_template"),
                    body_template=template_data["body_template"],
                    is_active=True,
                )
                db.add(template)

        await db.commit()
        logger.info("Default notification templates seeded")

    @staticmethod
    def _render_template(template_str: str, context: dict[str, Any]) -> str:
        """Render Jinja2 template with context."""
        try:
            return Template(template_str).render(**context)
        except Exception as e:
            logger.warning(f"Template render failed: {str(e)}")
            return ""

    @staticmethod
    def _is_quiet_hours(prefs: NotificationPreference) -> bool:
        """Check if current time is within quiet hours window."""
        if not prefs.quiet_hours_start or not prefs.quiet_hours_end:
            return False

        try:
            # Parse HH:MM format
            start_hour, start_minute = map(int, prefs.quiet_hours_start.split(":"))
            end_hour, end_minute = map(int, prefs.quiet_hours_end.split(":"))

            start_time = time(start_hour, start_minute)
            end_time = time(end_hour, end_minute)
            current_time = datetime.utcnow().time()

            if start_time <= end_time:
                return start_time <= current_time <= end_time
            else:  # Spans midnight
                return current_time >= start_time or current_time <= end_time
        except Exception as e:
            logger.warning(f"Quiet hours check failed: {str(e)}")
            return False
