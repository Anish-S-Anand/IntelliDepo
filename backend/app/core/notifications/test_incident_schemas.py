"""
Unit tests for incident notification schemas.

Tests validation rules for all notification data models including:
- IncidentNotificationData
- AssignmentPopupData
- ContactInfo
- SendResult
- BroadcastResult
- NotificationResult
"""
import pytest
from datetime import datetime, timezone
from uuid import UUID, uuid4
from pydantic import ValidationError

from app.core.notifications.incident_schemas import (
    IncidentNotificationData,
    AssignmentPopupData,
    ContactInfo,
    SendResult,
    BroadcastResult,
    NotificationResult,
)


class TestIncidentNotificationData:
    """Test IncidentNotificationData model validation."""

    def test_valid_incident_notification_data(self):
        """Test creating valid IncidentNotificationData."""
        data = IncidentNotificationData(
            incident_id=uuid4(),
            title="Test Incident",
            description="Test description",
            priority="P1",
            status="acknowledged",
            acknowledged_by="john.doe",
            acknowledged_at=datetime.now(timezone.utc),
            assigned_to="security.team",
            zone="Zone A",
            incident_type="security"
        )
        assert data.priority == "P1"
        assert data.status == "acknowledged"
        assert data.acknowledged_at.tzinfo is not None

    def test_valid_priority_values(self):
        """Test all valid priority values (P1, P2, P3, P4)."""
        for priority in ["P1", "P2", "P3", "P4"]:
            data = IncidentNotificationData(
                incident_id=uuid4(),
                title="Test",
                priority=priority,
                status="acknowledged",
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                assigned_to="team"
            )
            assert data.priority == priority

    def test_invalid_priority_value(self):
        """Test that invalid priority values are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IncidentNotificationData(
                incident_id=uuid4(),
                title="Test",
                priority="P5",  # Invalid
                status="acknowledged",
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                assigned_to="team"
            )
        assert "priority" in str(exc_info.value).lower()

    def test_title_max_length_validation(self):
        """Test that title exceeding 200 characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IncidentNotificationData(
                incident_id=uuid4(),
                title="x" * 201,  # Exceeds max length
                priority="P1",
                status="acknowledged",
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                assigned_to="team"
            )
        assert "title" in str(exc_info.value).lower()

    def test_title_min_length_validation(self):
        """Test that empty title is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            IncidentNotificationData(
                incident_id=uuid4(),
                title="",  # Empty
                priority="P1",
                status="acknowledged",
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                assigned_to="team"
            )
        assert "title" in str(exc_info.value).lower()

    def test_status_must_be_acknowledged(self):
        """Test that status must be 'acknowledged'."""
        with pytest.raises(ValidationError) as exc_info:
            IncidentNotificationData(
                incident_id=uuid4(),
                title="Test",
                priority="P1",
                status="open",  # Invalid for acknowledgment notification
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                assigned_to="team"
            )
        assert "acknowledged" in str(exc_info.value).lower()

    def test_acknowledged_at_requires_timezone(self):
        """Test that acknowledged_at must have timezone information."""
        with pytest.raises(ValidationError) as exc_info:
            IncidentNotificationData(
                incident_id=uuid4(),
                title="Test",
                priority="P1",
                status="acknowledged",
                acknowledged_by="user",
                acknowledged_at=datetime.now(),  # No timezone
                assigned_to="team"
            )
        assert "timezone" in str(exc_info.value).lower()

    def test_optional_fields_can_be_none(self):
        """Test that optional fields (description, zone, incident_type) can be None."""
        data = IncidentNotificationData(
            incident_id=uuid4(),
            title="Test",
            priority="P1",
            status="acknowledged",
            acknowledged_by="user",
            acknowledged_at=datetime.now(timezone.utc),
            assigned_to="team",
            description=None,
            zone=None,
            incident_type=None
        )
        assert data.description is None
        assert data.zone is None
        assert data.incident_type is None


class TestAssignmentPopupData:
    """Test AssignmentPopupData model validation."""

    def test_valid_assignment_popup_data(self):
        """Test creating valid AssignmentPopupData."""
        data = AssignmentPopupData(
            incident_id=uuid4(),
            title="Test Incident",
            priority="P1",
            assigned_to="security.team",
            acknowledged_by="john.doe",
            acknowledged_at=datetime.now(timezone.utc),
            zone="Zone A",
            auto_dismiss_seconds=15
        )
        assert data.popup_type == "assignment"
        assert data.auto_dismiss_seconds == 15

    def test_default_auto_dismiss_seconds(self):
        """Test that auto_dismiss_seconds defaults to 10."""
        data = AssignmentPopupData(
            incident_id=uuid4(),
            title="Test",
            priority="P1",
            assigned_to="team",
            acknowledged_by="user",
            acknowledged_at=datetime.now(timezone.utc)
        )
        assert data.auto_dismiss_seconds == 10

    def test_auto_dismiss_seconds_min_validation(self):
        """Test that auto_dismiss_seconds must be at least 5."""
        with pytest.raises(ValidationError) as exc_info:
            AssignmentPopupData(
                incident_id=uuid4(),
                title="Test",
                priority="P1",
                assigned_to="team",
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                auto_dismiss_seconds=4  # Below minimum
            )
        assert "auto_dismiss_seconds" in str(exc_info.value).lower()

    def test_auto_dismiss_seconds_max_validation(self):
        """Test that auto_dismiss_seconds must be at most 60."""
        with pytest.raises(ValidationError) as exc_info:
            AssignmentPopupData(
                incident_id=uuid4(),
                title="Test",
                priority="P1",
                assigned_to="team",
                acknowledged_by="user",
                acknowledged_at=datetime.now(timezone.utc),
                auto_dismiss_seconds=61  # Above maximum
            )
        assert "auto_dismiss_seconds" in str(exc_info.value).lower()

    def test_auto_dismiss_seconds_boundary_values(self):
        """Test boundary values for auto_dismiss_seconds (5 and 60)."""
        # Test minimum boundary
        data_min = AssignmentPopupData(
            incident_id=uuid4(),
            title="Test",
            priority="P1",
            assigned_to="team",
            acknowledged_by="user",
            acknowledged_at=datetime.now(timezone.utc),
            auto_dismiss_seconds=5
        )
        assert data_min.auto_dismiss_seconds == 5

        # Test maximum boundary
        data_max = AssignmentPopupData(
            incident_id=uuid4(),
            title="Test",
            priority="P1",
            assigned_to="team",
            acknowledged_by="user",
            acknowledged_at=datetime.now(timezone.utc),
            auto_dismiss_seconds=60
        )
        assert data_max.auto_dismiss_seconds == 60

    def test_popup_type_is_always_assignment(self):
        """Test that popup_type is always 'assignment'."""
        data = AssignmentPopupData(
            incident_id=uuid4(),
            title="Test",
            priority="P1",
            assigned_to="team",
            acknowledged_by="user",
            acknowledged_at=datetime.now(timezone.utc)
        )
        assert data.popup_type == "assignment"

    def test_acknowledged_at_requires_timezone(self):
        """Test that acknowledged_at must have timezone information."""
        with pytest.raises(ValidationError) as exc_info:
            AssignmentPopupData(
                incident_id=uuid4(),
                title="Test",
                priority="P1",
                assigned_to="team",
                acknowledged_by="user",
                acknowledged_at=datetime.now()  # No timezone
            )
        assert "timezone" in str(exc_info.value).lower()


class TestContactInfo:
    """Test ContactInfo model validation."""

    def test_valid_contact_info_with_both_methods(self):
        """Test creating ContactInfo with both phone and email."""
        data = ContactInfo(
            user_id="john.doe",
            phone="+14155552671",
            email="john.doe@example.com",
            preferred_channel="email"
        )
        assert data.phone == "+14155552671"
        assert data.email == "john.doe@example.com"

    def test_valid_contact_info_phone_only(self):
        """Test creating ContactInfo with phone only."""
        data = ContactInfo(
            user_id="john.doe",
            phone="+14155552671",
            email=None
        )
        assert data.phone == "+14155552671"
        assert data.email is None

    def test_valid_contact_info_email_only(self):
        """Test creating ContactInfo with email only."""
        data = ContactInfo(
            user_id="john.doe",
            phone=None,
            email="john.doe@example.com"
        )
        assert data.phone is None
        assert data.email == "john.doe@example.com"

    def test_phone_e164_format_validation_missing_plus(self):
        """Test that phone number without '+' is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone="14155552671",  # Missing +
                email="john.doe@example.com"
            )
        assert "e.164" in str(exc_info.value).lower()

    def test_phone_e164_format_validation_non_digits(self):
        """Test that phone number with non-digits is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone="+1-415-555-2671",  # Contains dashes
                email="john.doe@example.com"
            )
        assert "e.164" in str(exc_info.value).lower()

    def test_phone_e164_format_validation_too_short(self):
        """Test that phone number with no digits is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone="+",  # No digits
                email="john.doe@example.com"
            )
        assert "e.164" in str(exc_info.value).lower()

    def test_phone_e164_format_validation_too_long(self):
        """Test that phone number exceeding 15 digits is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone="+1234567890123456",  # 16 digits
                email="john.doe@example.com"
            )
        assert "e.164" in str(exc_info.value).lower()

    def test_valid_e164_formats(self):
        """Test various valid E.164 phone number formats."""
        valid_phones = [
            "+1",  # Minimum (1 digit)
            "+14155552671",  # US number
            "+442071838750",  # UK number
            "+81312345678",  # Japan number
            "+123456789012345",  # Maximum (15 digits)
        ]
        for phone in valid_phones:
            data = ContactInfo(
                user_id="user",
                phone=phone,
                email=None
            )
            assert data.phone == phone

    def test_email_format_validation(self):
        """Test that invalid email format is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone="+14155552671",
                email="invalid-email"  # Invalid format
            )
        assert "email" in str(exc_info.value).lower()

    def test_at_least_one_contact_method_required(self):
        """Test that at least one contact method must be provided."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone=None,
                email=None  # Both None
            )
        assert "at least one" in str(exc_info.value).lower()

    def test_preferred_channel_validation(self):
        """Test that preferred_channel must be valid value."""
        with pytest.raises(ValidationError) as exc_info:
            ContactInfo(
                user_id="john.doe",
                phone="+14155552671",
                email="john.doe@example.com",
                preferred_channel="invalid"  # Invalid channel
            )
        assert "preferred_channel" in str(exc_info.value).lower()

    def test_default_preferred_channel(self):
        """Test that preferred_channel defaults to 'email'."""
        data = ContactInfo(
            user_id="john.doe",
            phone="+14155552671",
            email="john.doe@example.com"
        )
        assert data.preferred_channel == "email"


class TestSendResult:
    """Test SendResult model validation."""

    def test_valid_send_result_success(self):
        """Test creating valid SendResult for successful send."""
        data = SendResult(
            success=True,
            message_id="SM1234567890abcdef",
            error=None,
            timestamp=datetime.now(timezone.utc)
        )
        assert data.success is True
        assert data.message_id == "SM1234567890abcdef"
        assert data.error is None

    def test_valid_send_result_failure(self):
        """Test creating valid SendResult for failed send."""
        data = SendResult(
            success=False,
            message_id=None,
            error="API timeout",
            timestamp=datetime.now(timezone.utc)
        )
        assert data.success is False
        assert data.message_id is None
        assert data.error == "API timeout"

    def test_message_id_required_when_success(self):
        """Test that message_id is required when success is True."""
        with pytest.raises(ValidationError) as exc_info:
            SendResult(
                success=True,
                message_id=None,  # Missing
                error=None,
                timestamp=datetime.now(timezone.utc)
            )
        assert "message_id" in str(exc_info.value).lower()

    def test_error_required_when_failure(self):
        """Test that error is required when success is False."""
        with pytest.raises(ValidationError) as exc_info:
            SendResult(
                success=False,
                message_id=None,
                error=None,  # Missing
                timestamp=datetime.now(timezone.utc)
            )
        assert "error" in str(exc_info.value).lower()

    def test_timestamp_requires_timezone(self):
        """Test that timestamp must have timezone information."""
        with pytest.raises(ValidationError) as exc_info:
            SendResult(
                success=True,
                message_id="SM123",
                error=None,
                timestamp=datetime.now()  # No timezone
            )
        assert "timezone" in str(exc_info.value).lower()


class TestBroadcastResult:
    """Test BroadcastResult model validation."""

    def test_valid_broadcast_result(self):
        """Test creating valid BroadcastResult."""
        data = BroadcastResult(
            clients_notified=15,
            clients_disconnected=2
        )
        assert data.clients_notified == 15
        assert data.clients_disconnected == 2

    def test_default_clients_disconnected(self):
        """Test that clients_disconnected defaults to 0."""
        data = BroadcastResult(clients_notified=10)
        assert data.clients_disconnected == 0

    def test_clients_notified_non_negative(self):
        """Test that clients_notified must be non-negative."""
        with pytest.raises(ValidationError) as exc_info:
            BroadcastResult(clients_notified=-1)
        assert "clients_notified" in str(exc_info.value).lower()

    def test_clients_disconnected_non_negative(self):
        """Test that clients_disconnected must be non-negative."""
        with pytest.raises(ValidationError) as exc_info:
            BroadcastResult(
                clients_notified=10,
                clients_disconnected=-1
            )
        assert "clients_disconnected" in str(exc_info.value).lower()

    def test_zero_clients_notified(self):
        """Test that zero clients_notified is valid."""
        data = BroadcastResult(clients_notified=0)
        assert data.clients_notified == 0


class TestNotificationResult:
    """Test NotificationResult model validation."""

    def test_valid_notification_result_all_success(self):
        """Test creating NotificationResult with all channels successful."""
        data = NotificationResult(
            incident_id=uuid4(),
            whatsapp_sent=True,
            whatsapp_message_id="SM123",
            email_sent=True,
            email_message_id="msg_abc",
            popup_broadcast=True,
            popup_clients_notified=15,
            errors=[]
        )
        assert data.whatsapp_sent is True
        assert data.email_sent is True
        assert data.popup_broadcast is True
        assert len(data.errors) == 0

    def test_valid_notification_result_partial_failure(self):
        """Test creating NotificationResult with some channels failed."""
        data = NotificationResult(
            incident_id=uuid4(),
            whatsapp_sent=False,
            whatsapp_message_id=None,
            email_sent=True,
            email_message_id="msg_abc",
            popup_broadcast=True,
            popup_clients_notified=15,
            errors=["WhatsApp: API timeout"]
        )
        assert data.whatsapp_sent is False
        assert data.email_sent is True
        assert len(data.errors) == 1

    def test_default_values(self):
        """Test that fields have correct default values."""
        data = NotificationResult(incident_id=uuid4())
        assert data.whatsapp_sent is False
        assert data.whatsapp_message_id is None
        assert data.email_sent is False
        assert data.email_message_id is None
        assert data.popup_broadcast is False
        assert data.popup_clients_notified == 0
        assert data.errors == []

    def test_popup_clients_notified_non_negative(self):
        """Test that popup_clients_notified must be non-negative."""
        with pytest.raises(ValidationError) as exc_info:
            NotificationResult(
                incident_id=uuid4(),
                popup_clients_notified=-1
            )
        assert "popup_clients_notified" in str(exc_info.value).lower()

    def test_errors_list_can_contain_multiple_errors(self):
        """Test that errors list can contain multiple error messages."""
        data = NotificationResult(
            incident_id=uuid4(),
            errors=[
                "WhatsApp: API timeout",
                "Email: SMTP connection failed",
                "Popup: No connected clients"
            ]
        )
        assert len(data.errors) == 3
