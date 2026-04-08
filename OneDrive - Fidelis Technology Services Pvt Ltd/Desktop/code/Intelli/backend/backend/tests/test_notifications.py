"""
Tests for NOTIF-6.7: Notification Engine Core

Tests cover:
- Template management (CRUD, variable extraction, rendering)
- Notification sending (with and without templates)
- Delivery queue and priority ordering
- Retry logic on handler failure
- Delivery tracking and status
- Statistics
"""
import pytest

from app.core.notifications.engine import NotificationEngine
from app.core.notifications.models import (
    DeliveryStatus,
    NotificationChannel,
    NotificationPriority,
    NotificationRecipient,
    NotificationRequest,
    NotificationTemplate,
    TemplateVariable,
)


@pytest.fixture
def engine():
    return NotificationEngine()


@pytest.fixture
def sample_template():
    return NotificationTemplate(
        name="Welcome Email",
        channel=NotificationChannel.EMAIL,
        subject="Welcome to {{company}}, {{user_name}}!",
        body="Hi {{user_name}}, your account at {{company}} is ready. Your role is {{role}}.",
    )


@pytest.fixture
def sample_recipient():
    return NotificationRecipient(
        user_id="user-1",
        email="test@example.com",
        name="Test User",
    )


# ── Template Management ───────────────────────────────────


class TestTemplateManagement:
    def test_register_template(self, engine, sample_template):
        result = engine.register_template(sample_template)
        assert result.name == "Welcome Email"
        assert engine.get_template(result.id) is not None

    def test_auto_extract_variables(self, engine, sample_template):
        result = engine.register_template(sample_template)
        var_names = [v.name for v in result.variables]
        assert "company" in var_names
        assert "user_name" in var_names
        assert "role" in var_names

    def test_preserves_explicit_variables(self, engine):
        template = NotificationTemplate(
            name="Test",
            channel=NotificationChannel.EMAIL,
            body="Hello {{name}}",
            variables=[TemplateVariable(name="name", required=True)],
        )
        result = engine.register_template(template)
        assert len(result.variables) == 1

    def test_list_templates(self, engine, sample_template):
        engine.register_template(sample_template)
        sms_template = NotificationTemplate(
            name="SMS Alert",
            channel=NotificationChannel.SMS,
            body="Alert: {{message}}",
        )
        engine.register_template(sms_template)

        all_templates = engine.list_templates()
        assert len(all_templates) == 2

        email_only = engine.list_templates(channel=NotificationChannel.EMAIL)
        assert len(email_only) == 1
        assert email_only[0].name == "Welcome Email"

    def test_delete_template(self, engine, sample_template):
        result = engine.register_template(sample_template)
        assert engine.delete_template(result.id) is True

        # Should be inactive now
        active = engine.list_templates(active_only=True)
        assert len(active) == 0

        # But still retrievable
        assert engine.get_template(result.id) is not None

    def test_delete_nonexistent_returns_false(self, engine):
        assert engine.delete_template("nonexistent") is False


# ── Template Rendering ────────────────────────────────────


class TestTemplateRendering:
    def test_render_with_all_variables(self, engine, sample_template):
        engine.register_template(sample_template)
        subject, body = engine.render_template(
            sample_template,
            {"user_name": "Alice", "company": "Fidelis", "role": "Admin"},
        )
        assert "Alice" in subject
        assert "Fidelis" in subject
        assert "Admin" in body

    def test_render_missing_required_raises(self, engine, sample_template):
        engine.register_template(sample_template)
        with pytest.raises(ValueError, match="Missing required"):
            engine.render_template(sample_template, {"user_name": "Alice"})

    def test_render_with_defaults(self, engine):
        template = NotificationTemplate(
            name="Test",
            channel=NotificationChannel.EMAIL,
            body="Hello {{name}}, status: {{status}}",
            variables=[
                TemplateVariable(name="name", required=True),
                TemplateVariable(name="status", required=False, default_value="active"),
            ],
        )
        _, body = engine.render_template(template, {"name": "Bob"})
        assert "Bob" in body
        assert "active" in body


# ── Sending Without Template ──────────────────────────────


class TestSendDirect:
    @pytest.mark.asyncio
    async def test_send_direct_body(self, engine, sample_recipient):
        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                subject="Test Subject",
                body="Test body content",
            )
        )
        assert len(records) == 1
        assert records[0].status == DeliveryStatus.DELIVERED
        assert records[0].body == "Test body content"

    @pytest.mark.asyncio
    async def test_send_empty_body_raises(self, engine, sample_recipient):
        with pytest.raises(ValueError, match="body is empty"):
            await engine.send(
                NotificationRequest(
                    channel=NotificationChannel.EMAIL,
                    recipients=[sample_recipient],
                    body="",
                )
            )

    @pytest.mark.asyncio
    async def test_send_multiple_recipients(self, engine):
        recipients = [
            NotificationRecipient(user_id=f"user-{i}", name=f"User {i}")
            for i in range(3)
        ]
        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.IN_APP,
                recipients=recipients,
                body="Broadcast message",
            )
        )
        assert len(records) == 3
        assert all(r.status == DeliveryStatus.DELIVERED for r in records)


# ── Sending With Template ─────────────────────────────────


class TestSendWithTemplate:
    @pytest.mark.asyncio
    async def test_send_with_template(self, engine, sample_template, sample_recipient):
        t = engine.register_template(sample_template)
        records = await engine.send(
            NotificationRequest(
                template_id=t.id,
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                variables={"user_name": "Alice", "company": "Fidelis", "role": "Admin"},
            )
        )
        assert len(records) == 1
        assert "Alice" in records[0].body
        assert "Fidelis" in records[0].subject

    @pytest.mark.asyncio
    async def test_send_with_nonexistent_template_raises(self, engine, sample_recipient):
        with pytest.raises(ValueError, match="not found"):
            await engine.send(
                NotificationRequest(
                    template_id="nonexistent",
                    channel=NotificationChannel.EMAIL,
                    recipients=[sample_recipient],
                )
            )

    @pytest.mark.asyncio
    async def test_send_with_inactive_template_raises(self, engine, sample_template, sample_recipient):
        t = engine.register_template(sample_template)
        engine.delete_template(t.id)
        with pytest.raises(ValueError, match="inactive"):
            await engine.send(
                NotificationRequest(
                    template_id=t.id,
                    channel=NotificationChannel.EMAIL,
                    recipients=[sample_recipient],
                    variables={"user_name": "A", "company": "B", "role": "C"},
                )
            )


# ── Channel Handlers & Retry Logic ────────────────────────


class TestRetryLogic:
    @pytest.mark.asyncio
    async def test_successful_handler(self, engine, sample_recipient):
        async def success_handler(record):
            return True

        engine.register_channel_handler(NotificationChannel.EMAIL, success_handler)

        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                body="Test",
            )
        )
        assert records[0].status == DeliveryStatus.DELIVERED
        assert records[0].attempt_count == 1

    @pytest.mark.asyncio
    async def test_handler_retries_on_failure(self, engine, sample_recipient):
        call_count = 0

        async def flaky_handler(record):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("Temporary failure")
            return True

        engine.register_channel_handler(NotificationChannel.EMAIL, flaky_handler)

        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                body="Test",
            )
        )
        assert records[0].status == DeliveryStatus.DELIVERED
        assert records[0].attempt_count == 3

    @pytest.mark.asyncio
    async def test_handler_permanent_failure(self, engine, sample_recipient):
        async def fail_handler(record):
            raise RuntimeError("Permanent failure")

        engine.register_channel_handler(NotificationChannel.EMAIL, fail_handler)

        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                body="Test",
            )
        )
        assert records[0].status == DeliveryStatus.FAILED
        assert records[0].attempt_count == 3
        assert records[0].error == "Permanent failure"


# ── Queue Processing ──────────────────────────────────────


class TestQueueProcessing:
    @pytest.mark.asyncio
    async def test_cancel_queued(self, engine, sample_recipient):
        # Manually add to queue
        from app.core.notifications.models import NotificationRecord
        record = NotificationRecord(
            channel=NotificationChannel.EMAIL,
            recipient=sample_recipient,
            body="Queued message",
            status=DeliveryStatus.QUEUED,
        )
        engine._queue.append(record)

        assert engine.cancel_queued(record.id) is True
        assert record.status == DeliveryStatus.CANCELLED

    def test_cancel_nonexistent_returns_false(self, engine):
        assert engine.cancel_queued("nonexistent") is False

    @pytest.mark.asyncio
    async def test_process_queue_priority_order(self, engine):
        from app.core.notifications.models import NotificationRecord
        low = NotificationRecord(
            channel=NotificationChannel.EMAIL,
            recipient=NotificationRecipient(user_id="u1", name="Low"),
            body="Low priority",
            priority=NotificationPriority.LOW,
            status=DeliveryStatus.QUEUED,
        )
        urgent = NotificationRecord(
            channel=NotificationChannel.EMAIL,
            recipient=NotificationRecipient(user_id="u2", name="Urgent"),
            body="Urgent priority",
            priority=NotificationPriority.URGENT,
            status=DeliveryStatus.QUEUED,
        )
        engine._queue.extend([low, urgent])

        processed = await engine.process_queue()
        assert len(processed) == 2
        # Urgent should be processed first
        assert processed[0].priority == NotificationPriority.URGENT


# ── Tracking & History ────────────────────────────────────


class TestTracking:
    @pytest.mark.asyncio
    async def test_get_notification(self, engine, sample_recipient):
        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                body="Trackable",
            )
        )
        found = engine.get_notification(records[0].id)
        assert found is not None
        assert found.body == "Trackable"

    @pytest.mark.asyncio
    async def test_get_delivery_status(self, engine, sample_recipient):
        records = await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                body="Status check",
            )
        )
        status = engine.get_delivery_status(records[0].id)
        assert status is not None
        assert status["status"] == "delivered"
        assert status["delivered_at"] is not None

    def test_get_nonexistent_returns_none(self, engine):
        assert engine.get_notification("nope") is None
        assert engine.get_delivery_status("nope") is None

    @pytest.mark.asyncio
    async def test_history_filters(self, engine):
        r1 = NotificationRecipient(user_id="u1", name="U1")
        r2 = NotificationRecipient(user_id="u2", name="U2")

        await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[r1],
                body="Email",
            )
        )
        await engine.send(
            NotificationRequest(
                channel=NotificationChannel.SMS,
                recipients=[r2],
                body="SMS",
            )
        )

        all_records = engine.get_history()
        assert len(all_records) == 2

        email_only = engine.get_history(channel=NotificationChannel.EMAIL)
        assert len(email_only) == 1

        delivered = engine.get_history(status=DeliveryStatus.DELIVERED)
        assert len(delivered) == 2


# ── Statistics ────────────────────────────────────────────


class TestStats:
    def test_empty_stats(self, engine):
        stats = engine.get_stats()
        assert stats["total_sent"] == 0
        assert stats["templates"] == 0

    @pytest.mark.asyncio
    async def test_stats_after_sending(self, engine, sample_recipient, sample_template):
        engine.register_template(sample_template)

        await engine.send(
            NotificationRequest(
                channel=NotificationChannel.EMAIL,
                recipients=[sample_recipient],
                body="Test 1",
            )
        )
        await engine.send(
            NotificationRequest(
                channel=NotificationChannel.SMS,
                recipients=[sample_recipient],
                body="Test 2",
            )
        )

        stats = engine.get_stats()
        assert stats["total_sent"] == 2
        assert stats["templates"] == 1
        assert stats["by_channel"]["email"] == 1
        assert stats["by_channel"]["sms"] == 1
        assert stats["delivery_rate"] == 1.0


# ── Model Validation ──────────────────────────────────────


class TestModels:
    def test_notification_record_properties(self):
        from app.core.notifications.models import NotificationRecord, DeliveryAttempt
        record = NotificationRecord(
            channel=NotificationChannel.EMAIL,
            recipient=NotificationRecipient(user_id="u1"),
            body="test",
        )
        assert record.attempt_count == 0
        assert record.is_terminal is False

        record.status = DeliveryStatus.DELIVERED
        assert record.is_terminal is True

    def test_recipient_defaults(self):
        r = NotificationRecipient()
        assert r.user_id is None
        assert r.name == ""
