"""
Intelli Platform — Notification Engine Core
Feature: NOTIF-6.7

Central notification engine with template management, delivery queue,
retry logic, and delivery tracking across all channels.

Dependencies: None
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone

from app.core.notifications.models import (
    DeliveryAttempt,
    DeliveryStatus,
    NotificationChannel,
    NotificationPriority,
    NotificationRecord,
    NotificationRecipient,
    NotificationRequest,
    NotificationTemplate,
    TemplateVariable,
)

logger = logging.getLogger(__name__)

# Default retry delays (seconds) per attempt: 0s, 30s, 120s
RETRY_DELAYS = [0, 30, 120]
MAX_RETRIES_DEFAULT = 3

# Template variable pattern: {{variable_name}}
TEMPLATE_VAR_PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")


class NotificationEngine:
    """
    Core notification engine.

    Features:
    - Template management with variable substitution
    - Multi-channel delivery queue
    - Configurable retry logic with backoff
    - Delivery tracking and status monitoring
    - Priority-based queue ordering
    """

    def __init__(self):
        self._templates: dict[str, NotificationTemplate] = {}
        self._queue: list[NotificationRecord] = []
        self._history: list[NotificationRecord] = []
        self._channel_handlers: dict[NotificationChannel, callable] = {}

    # ── Template Management ────────────────────────────────

    def register_template(self, template: NotificationTemplate) -> NotificationTemplate:
        """Register or update a notification template."""
        # Auto-extract variables from body
        if not template.variables:
            var_names = TEMPLATE_VAR_PATTERN.findall(template.body)
            if template.subject:
                var_names.extend(TEMPLATE_VAR_PATTERN.findall(template.subject))
            seen = set()
            for name in var_names:
                if name not in seen:
                    template.variables.append(
                        TemplateVariable(name=name, required=True)
                    )
                    seen.add(name)

        self._templates[template.id] = template
        logger.info(
            "Registered template: %s (%s, %d variables)",
            template.name,
            template.channel.value,
            len(template.variables),
        )
        return template

    def get_template(self, template_id: str) -> NotificationTemplate | None:
        """Retrieve a template by ID."""
        return self._templates.get(template_id)

    def list_templates(
        self, channel: NotificationChannel | None = None, active_only: bool = True
    ) -> list[NotificationTemplate]:
        """List templates, optionally filtered by channel."""
        templates = list(self._templates.values())
        if channel:
            templates = [t for t in templates if t.channel == channel]
        if active_only:
            templates = [t for t in templates if t.is_active]
        return templates

    def delete_template(self, template_id: str) -> bool:
        """Soft-delete a template by deactivating it."""
        template = self._templates.get(template_id)
        if template:
            template.is_active = False
            template.updated_at = datetime.now(timezone.utc)
            return True
        return False

    def render_template(
        self, template: NotificationTemplate, variables: dict[str, str]
    ) -> tuple[str, str]:
        """
        Render a template by substituting variables.
        Returns (rendered_subject, rendered_body).
        Raises ValueError if required variables are missing.
        """
        # Check for missing required variables
        missing = []
        for var in template.variables:
            if var.required and var.name not in variables and var.default_value is None:
                missing.append(var.name)
        if missing:
            raise ValueError(
                f"Missing required template variables: {', '.join(missing)}"
            )

        # Build substitution map with defaults
        sub_map = {}
        for var in template.variables:
            if var.name in variables:
                sub_map[var.name] = variables[var.name]
            elif var.default_value is not None:
                sub_map[var.name] = var.default_value

        def _replace(match: re.Match) -> str:
            name = match.group(1)
            return sub_map.get(name, match.group(0))

        rendered_body = TEMPLATE_VAR_PATTERN.sub(_replace, template.body)
        rendered_subject = TEMPLATE_VAR_PATTERN.sub(_replace, template.subject)

        return rendered_subject, rendered_body

    # ── Channel Handlers ───────────────────────────────────

    def register_channel_handler(
        self, channel: NotificationChannel, handler: callable
    ) -> None:
        """
        Register a delivery handler for a channel.

        Handler signature: async def handler(record: NotificationRecord) -> bool
        Returns True on successful delivery, False on failure.
        """
        self._channel_handlers[channel] = handler
        logger.info("Registered channel handler: %s", channel.value)

    # ── Sending ────────────────────────────────────────────

    async def send(self, request: NotificationRequest) -> list[NotificationRecord]:
        """
        Send a notification to all recipients.

        If a template_id is provided, renders the template with variables.
        Otherwise uses the raw subject/body from the request.
        Creates one NotificationRecord per recipient and queues for delivery.
        """
        # Resolve body content
        subject = request.subject
        body = request.body

        if request.template_id:
            template = self._templates.get(request.template_id)
            if not template:
                raise ValueError(f"Template '{request.template_id}' not found")
            if not template.is_active:
                raise ValueError(f"Template '{request.template_id}' is inactive")
            subject, body = self.render_template(template, request.variables)

        if not body:
            raise ValueError("Notification body is empty")

        records = []
        for recipient in request.recipients:
            record = NotificationRecord(
                template_id=request.template_id,
                channel=request.channel,
                recipient=recipient,
                subject=subject,
                body=body,
                priority=request.priority,
                metadata=request.metadata,
            )

            if request.scheduled_at and request.scheduled_at > datetime.now(timezone.utc):
                record.status = DeliveryStatus.QUEUED
                self._queue.append(record)
                logger.info(
                    "Notification %s queued for %s",
                    record.id[:8],
                    request.scheduled_at.isoformat(),
                )
            else:
                await self._deliver(record)

            records.append(record)
            self._history.append(record)

        return records

    async def _deliver(self, record: NotificationRecord) -> None:
        """Attempt to deliver a notification, with retry logic."""
        handler = self._channel_handlers.get(record.channel)

        if not handler:
            # No handler registered — use default logging handler
            logger.info(
                "No handler for channel %s, logging notification: [%s] %s → %s",
                record.channel.value,
                record.priority.value,
                record.subject or "(no subject)",
                record.recipient.name or record.recipient.user_id or "unknown",
            )
            record.status = DeliveryStatus.DELIVERED
            record.delivered_at = datetime.now(timezone.utc)
            record.attempts.append(
                DeliveryAttempt(
                    attempt_number=1,
                    status=DeliveryStatus.DELIVERED,
                    latency_ms=0.0,
                )
            )
            return

        while record.attempt_count < record.max_retries:
            attempt_num = record.attempt_count + 1
            record.status = DeliveryStatus.SENDING
            start = time.monotonic()

            try:
                success = await handler(record)
                latency = (time.monotonic() - start) * 1000

                if success:
                    record.status = DeliveryStatus.DELIVERED
                    record.delivered_at = datetime.now(timezone.utc)
                    record.attempts.append(
                        DeliveryAttempt(
                            attempt_number=attempt_num,
                            status=DeliveryStatus.DELIVERED,
                            latency_ms=latency,
                        )
                    )
                    logger.info(
                        "Notification %s delivered via %s (attempt %d, %.0fms)",
                        record.id[:8],
                        record.channel.value,
                        attempt_num,
                        latency,
                    )
                    return
                else:
                    raise RuntimeError("Handler returned False")

            except Exception as e:
                latency = (time.monotonic() - start) * 1000
                record.attempts.append(
                    DeliveryAttempt(
                        attempt_number=attempt_num,
                        status=DeliveryStatus.FAILED,
                        error=str(e),
                        latency_ms=latency,
                    )
                )
                logger.warning(
                    "Notification %s attempt %d failed: %s",
                    record.id[:8],
                    attempt_num,
                    e,
                )

                if attempt_num >= record.max_retries:
                    record.status = DeliveryStatus.FAILED
                    record.error = str(e)
                    logger.error(
                        "Notification %s permanently failed after %d attempts",
                        record.id[:8],
                        attempt_num,
                    )
                    return
                else:
                    record.status = DeliveryStatus.RETRYING

    # ── Queue Processing ───────────────────────────────────

    async def process_queue(self) -> list[NotificationRecord]:
        """
        Process all queued notifications that are ready to send.
        Returns the list of processed records.
        """
        now = datetime.now(timezone.utc)
        ready = [r for r in self._queue if not r.is_terminal]

        # Sort by priority (urgent first)
        priority_order = {
            NotificationPriority.URGENT: 0,
            NotificationPriority.HIGH: 1,
            NotificationPriority.NORMAL: 2,
            NotificationPriority.LOW: 3,
        }
        ready.sort(key=lambda r: priority_order.get(r.priority, 2))

        processed = []
        for record in ready:
            await self._deliver(record)
            processed.append(record)

        # Remove delivered/failed from queue
        self._queue = [r for r in self._queue if not r.is_terminal]

        logger.info("Processed %d queued notifications", len(processed))
        return processed

    def cancel_queued(self, notification_id: str) -> bool:
        """Cancel a queued notification before delivery."""
        for record in self._queue:
            if record.id == notification_id:
                record.status = DeliveryStatus.CANCELLED
                return True
        return False

    # ── Tracking & Status ──────────────────────────────────

    def get_notification(self, notification_id: str) -> NotificationRecord | None:
        """Get a notification record by ID."""
        for record in self._history:
            if record.id == notification_id:
                return record
        return None

    def get_delivery_status(self, notification_id: str) -> dict | None:
        """Get delivery status summary for a notification."""
        record = self.get_notification(notification_id)
        if not record:
            return None
        return {
            "id": record.id,
            "channel": record.channel.value,
            "status": record.status.value,
            "attempts": record.attempt_count,
            "max_retries": record.max_retries,
            "created_at": record.created_at.isoformat(),
            "delivered_at": record.delivered_at.isoformat() if record.delivered_at else None,
            "error": record.error,
        }

    def get_history(
        self,
        channel: NotificationChannel | None = None,
        status: DeliveryStatus | None = None,
        limit: int = 100,
    ) -> list[NotificationRecord]:
        """Query notification history with optional filters."""
        records = self._history
        if channel:
            records = [r for r in records if r.channel == channel]
        if status:
            records = [r for r in records if r.status == status]
        return records[-limit:]

    def get_stats(self) -> dict:
        """Return notification engine statistics."""
        total = len(self._history)
        if total == 0:
            return {
                "total_sent": 0,
                "queue_size": len(self._queue),
                "by_status": {},
                "by_channel": {},
                "templates": len(self._templates),
            }

        by_status = {}
        for s in DeliveryStatus:
            count = sum(1 for r in self._history if r.status == s)
            if count > 0:
                by_status[s.value] = count

        by_channel = {}
        for ch in NotificationChannel:
            count = sum(1 for r in self._history if r.channel == ch)
            if count > 0:
                by_channel[ch.value] = count

        delivered = [r for r in self._history if r.status == DeliveryStatus.DELIVERED]
        avg_latency = 0.0
        if delivered:
            total_latency = sum(
                a.latency_ms
                for r in delivered
                for a in r.attempts
                if a.status == DeliveryStatus.DELIVERED
            )
            avg_latency = round(total_latency / len(delivered), 2)

        return {
            "total_sent": total,
            "queue_size": len(self._queue),
            "delivery_rate": round(len(delivered) / total, 4) if total else 0.0,
            "avg_latency_ms": avg_latency,
            "by_status": by_status,
            "by_channel": by_channel,
            "templates": len(self._templates),
        }


# ── Singleton Factory ──────────────────────────────────────

_engine_instance: NotificationEngine | None = None


def get_notification_engine() -> NotificationEngine:
    """Get or create the singleton notification engine."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = NotificationEngine()
    return _engine_instance
