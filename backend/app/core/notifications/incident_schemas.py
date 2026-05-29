"""
Intelli Platform — Incident Acknowledgment Notification Schemas

This module defines Pydantic models for incident acknowledgment notifications,
including data models for WhatsApp, Email, and WebSocket popup notifications.

Requirements: 1.3, 2.3, 3.2, 5.3, 5.4, 5.5, 8.1
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, EmailStr, ConfigDict


# Type aliases for incident-specific enums
IncidentPriority = Literal["P1", "P2", "P3", "P4"]
NotificationChannel = Literal["whatsapp", "email", "popup"]


class IncidentNotificationData(BaseModel):
    """
    Structured data for incident notifications sent via WhatsApp and Email.
    
    This model contains all incident details needed to format notification messages
    across different channels. It validates that required fields are present and
    properly formatted.
    
    Validates: Requirements 1.3, 2.3, 8.1
    """
    incident_id: UUID = Field(..., description="Unique identifier for the incident")
    title: str = Field(..., min_length=1, max_length=200, description="Incident title")
    description: Optional[str] = Field(None, description="Detailed incident description")
    priority: IncidentPriority = Field(..., description="Incident priority level (P1-P4)")
    status: str = Field(..., description="Current incident status")
    acknowledged_by: str = Field(..., min_length=1, description="User who acknowledged the incident")
    acknowledged_at: datetime = Field(..., description="Timestamp when incident was acknowledged")
    assigned_to: str = Field(..., min_length=1, description="User assigned to handle the incident")
    zone: Optional[str] = Field(None, description="Physical zone or location of the incident")
    incident_type: Optional[str] = Field(None, description="Type/category of the incident")

    @field_validator("acknowledged_at")
    @classmethod
    def validate_acknowledged_at_has_timezone(cls, v: datetime) -> datetime:
        """Ensure acknowledged_at has timezone information."""
        if v.tzinfo is None:
            raise ValueError("acknowledged_at must include timezone information")
        return v

    @field_validator("status")
    @classmethod
    def validate_status_is_acknowledged(cls, v: str) -> str:
        """Ensure status is 'acknowledged' for acknowledgment notifications."""
        if v.lower() != "acknowledged":
            raise ValueError("status must be 'acknowledged' for acknowledgment notifications")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "incident_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Perimeter breach detected in Zone A",
                "description": "Unauthorized access detected at north gate",
                "priority": "P1",
                "status": "acknowledged",
                "acknowledged_by": "john.doe",
                "acknowledged_at": "2024-01-15T10:30:00+00:00",
                "assigned_to": "security.team",
                "zone": "Zone A",
                "incident_type": "security"
            }
        }
    )


class AssignmentPopupData(BaseModel):
    """
    Data for real-time assignment popup display via WebSocket.
    
    This model contains the essential information needed to display an assignment
    popup notification in the UI. It includes auto-dismiss configuration and
    validates that all required fields are present.
    
    Validates: Requirements 3.2, 5.5
    """
    incident_id: UUID = Field(..., description="Unique identifier for the incident")
    title: str = Field(..., min_length=1, max_length=200, description="Incident title")
    priority: IncidentPriority = Field(..., description="Incident priority level (P1-P4)")
    assigned_to: str = Field(..., min_length=1, description="User assigned to handle the incident")
    acknowledged_by: str = Field(..., min_length=1, description="User who acknowledged the incident")
    acknowledged_at: datetime = Field(..., description="Timestamp when incident was acknowledged")
    zone: Optional[str] = Field(None, description="Physical zone or location of the incident")
    popup_type: Literal["assignment"] = Field(
        default="assignment",
        description="Type of popup notification"
    )
    auto_dismiss_seconds: int = Field(
        default=10,
        ge=5,
        le=60,
        description="Auto-dismiss duration in seconds (5-60 range)"
    )

    @field_validator("acknowledged_at")
    @classmethod
    def validate_acknowledged_at_has_timezone(cls, v: datetime) -> datetime:
        """Ensure acknowledged_at has timezone information."""
        if v.tzinfo is None:
            raise ValueError("acknowledged_at must include timezone information")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "incident_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Perimeter breach detected in Zone A",
                "priority": "P1",
                "assigned_to": "security.team",
                "acknowledged_by": "john.doe",
                "acknowledged_at": "2024-01-15T10:30:00+00:00",
                "zone": "Zone A",
                "popup_type": "assignment",
                "auto_dismiss_seconds": 10
            }
        }
    )


class ContactInfo(BaseModel):
    """
    User contact information for notification delivery.
    
    This model stores phone numbers and email addresses for notification recipients.
    It validates that phone numbers are in E.164 format and email addresses are valid.
    At least one contact method must be provided.
    
    Validates: Requirements 5.3, 5.4
    """
    user_id: str = Field(..., min_length=1, description="User identifier")
    phone: Optional[str] = Field(None, description="Phone number in E.164 format (+[country][number])")
    email: Optional[EmailStr] = Field(None, description="Email address")
    preferred_channel: Literal["email", "whatsapp", "sms"] = Field(
        default="email",
        description="Preferred notification channel"
    )

    @field_validator("phone")
    @classmethod
    def validate_phone_e164_format(cls, v: Optional[str]) -> Optional[str]:
        """Validate phone number is in E.164 format."""
        if v is None:
            return v
        
        # E.164 format: +[country code][number]
        # Must start with +, followed by 1-15 digits
        if not v.startswith("+"):
            raise ValueError("Phone number must start with '+' (E.164 format)")
        
        # Remove the + and check if remaining characters are digits
        digits = v[1:]
        if not digits.isdigit():
            raise ValueError("Phone number must contain only digits after '+' (E.164 format)")
        
        # E.164 allows 1-15 digits after country code
        if len(digits) < 1 or len(digits) > 15:
            raise ValueError("Phone number must have 1-15 digits after '+' (E.164 format)")
        
        return v

    @field_validator("email")
    @classmethod
    def validate_at_least_one_contact_method(cls, v: Optional[str], info) -> Optional[str]:
        """Ensure at least one contact method (phone or email) is provided."""
        # This validator runs after phone validator, so we can check both fields
        phone = info.data.get("phone")
        if not phone and not v:
            raise ValueError("At least one contact method (phone or email) must be provided")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "john.doe",
                "phone": "+14155552671",
                "email": "john.doe@example.com",
                "preferred_channel": "email"
            }
        }
    )


class SendResult(BaseModel):
    """
    Result of individual notification send operation.
    
    This model captures the outcome of sending a notification through a single channel
    (WhatsApp or Email). It includes success status, message ID for tracking, and
    error information if the send failed.
    
    Validates: Requirements 1.3, 2.3
    """
    success: bool = Field(..., description="Whether the notification was sent successfully")
    message_id: Optional[str] = Field(None, description="Message ID from the notification service")
    error: Optional[str] = Field(None, description="Error message if send failed")
    timestamp: datetime = Field(..., description="Timestamp of the send attempt")

    @field_validator("message_id")
    @classmethod
    def validate_message_id_if_success(cls, v: Optional[str], info) -> Optional[str]:
        """Ensure message_id is provided when success is True."""
        success = info.data.get("success")
        if success and not v:
            raise ValueError("message_id must be provided when success is True")
        return v

    @field_validator("error")
    @classmethod
    def validate_error_if_failure(cls, v: Optional[str], info) -> Optional[str]:
        """Ensure error is provided when success is False."""
        success = info.data.get("success")
        if not success and not v:
            raise ValueError("error must be provided when success is False")
        return v

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_has_timezone(cls, v: datetime) -> datetime:
        """Ensure timestamp has timezone information."""
        if v.tzinfo is None:
            raise ValueError("timestamp must include timezone information")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message_id": "SM1234567890abcdef",
                "error": None,
                "timestamp": "2024-01-15T10:30:05+00:00"
            }
        }
    )


class BroadcastResult(BaseModel):
    """
    Result of WebSocket broadcast operation.
    
    This model captures the outcome of broadcasting a popup notification to all
    connected WebSocket clients. It includes the count of clients successfully
    notified and clients that were disconnected during the broadcast.
    
    Validates: Requirement 3.2
    """
    clients_notified: int = Field(..., ge=0, description="Number of clients successfully notified")
    clients_disconnected: int = Field(
        default=0,
        ge=0,
        description="Number of clients disconnected during broadcast"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "clients_notified": 15,
                "clients_disconnected": 2
            }
        }
    )


class NotificationResult(BaseModel):
    """
    Aggregated result of notification orchestration across all channels.
    
    This model provides a comprehensive view of notification delivery status across
    WhatsApp, Email, and WebSocket popup channels. It includes success flags,
    message IDs for tracking, and any errors encountered during the process.
    
    Validates: Requirements 1.3, 2.3, 3.2, 4.3, 4.4
    """
    incident_id: UUID = Field(..., description="Unique identifier for the incident")
    whatsapp_sent: bool = Field(default=False, description="Whether WhatsApp notification was sent")
    whatsapp_message_id: Optional[str] = Field(None, description="WhatsApp message ID if sent")
    email_sent: bool = Field(default=False, description="Whether email notification was sent")
    email_message_id: Optional[str] = Field(None, description="Email message ID if sent")
    popup_broadcast: bool = Field(default=False, description="Whether popup was broadcast")
    popup_clients_notified: int = Field(
        default=0,
        ge=0,
        description="Number of clients notified via popup"
    )
    errors: list[str] = Field(
        default_factory=list,
        description="List of error messages from failed notification attempts"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "incident_id": "550e8400-e29b-41d4-a716-446655440000",
                "whatsapp_sent": True,
                "whatsapp_message_id": "SM1234567890abcdef",
                "email_sent": True,
                "email_message_id": "msg_abc123xyz",
                "popup_broadcast": True,
                "popup_clients_notified": 15,
                "errors": []
            }
        }
    )
