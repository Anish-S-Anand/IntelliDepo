# Incident Notification Schemas

This document describes the Pydantic data models and validation schemas for incident acknowledgment notifications.

## Overview

The incident notification schemas provide type-safe data models for multi-channel notifications (WhatsApp, Email, WebSocket) when incidents are acknowledged. All models include comprehensive validation rules to ensure data integrity.

## Models

### 1. IncidentNotificationData

Structured data for incident notifications sent via WhatsApp and Email.

**Fields:**
- `incident_id` (UUID): Unique identifier for the incident
- `title` (str): Incident title (1-200 characters)
- `description` (Optional[str]): Detailed incident description
- `priority` (Literal["P1", "P2", "P3", "P4"]): Incident priority level
- `status` (str): Current incident status (must be "acknowledged")
- `acknowledged_by` (str): User who acknowledged the incident
- `acknowledged_at` (datetime): Timestamp when incident was acknowledged (must have timezone)
- `assigned_to` (str): User assigned to handle the incident
- `zone` (Optional[str]): Physical zone or location of the incident
- `incident_type` (Optional[str]): Type/category of the incident

**Validation Rules:**
- Title must be 1-200 characters
- Priority must be one of: P1, P2, P3, P4
- Status must be "acknowledged"
- acknowledged_at must include timezone information

**Example:**
```python
from datetime import datetime, timezone
from uuid import uuid4
from app.core.notifications import IncidentNotificationData

data = IncidentNotificationData(
    incident_id=uuid4(),
    title="Perimeter breach detected in Zone A",
    description="Unauthorized access detected at north gate",
    priority="P1",
    status="acknowledged",
    acknowledged_by="john.doe",
    acknowledged_at=datetime.now(timezone.utc),
    assigned_to="security.team",
    zone="Zone A",
    incident_type="security"
)
```

### 2. AssignmentPopupData

Data for real-time assignment popup display via WebSocket.

**Fields:**
- `incident_id` (UUID): Unique identifier for the incident
- `title` (str): Incident title (1-200 characters)
- `priority` (Literal["P1", "P2", "P3", "P4"]): Incident priority level
- `assigned_to` (str): User assigned to handle the incident
- `acknowledged_by` (str): User who acknowledged the incident
- `acknowledged_at` (datetime): Timestamp when incident was acknowledged (must have timezone)
- `zone` (Optional[str]): Physical zone or location of the incident
- `popup_type` (Literal["assignment"]): Type of popup notification (always "assignment")
- `auto_dismiss_seconds` (int): Auto-dismiss duration in seconds (5-60 range, default: 10)

**Validation Rules:**
- auto_dismiss_seconds must be between 5 and 60
- popup_type is always "assignment"
- acknowledged_at must include timezone information

**Example:**
```python
from datetime import datetime, timezone
from uuid import uuid4
from app.core.notifications import AssignmentPopupData

data = AssignmentPopupData(
    incident_id=uuid4(),
    title="Perimeter breach detected in Zone A",
    priority="P1",
    assigned_to="security.team",
    acknowledged_by="john.doe",
    acknowledged_at=datetime.now(timezone.utc),
    zone="Zone A",
    auto_dismiss_seconds=15
)
```

### 3. ContactInfo

User contact information for notification delivery.

**Fields:**
- `user_id` (str): User identifier
- `phone` (Optional[str]): Phone number in E.164 format (+[country][number])
- `email` (Optional[EmailStr]): Email address
- `preferred_channel` (Literal["email", "whatsapp", "sms"]): Preferred notification channel (default: "email")

**Validation Rules:**
- Phone must be in E.164 format if provided (starts with +, followed by 1-15 digits)
- Email must be valid email format if provided
- At least one contact method (phone or email) must be provided

**Example:**
```python
from app.core.notifications import ContactInfo

# With both phone and email
data = ContactInfo(
    user_id="john.doe",
    phone="+14155552671",
    email="john.doe@example.com",
    preferred_channel="email"
)

# Phone only
data = ContactInfo(
    user_id="john.doe",
    phone="+14155552671"
)

# Email only
data = ContactInfo(
    user_id="john.doe",
    email="john.doe@example.com"
)
```

### 4. SendResult

Result of individual notification send operation.

**Fields:**
- `success` (bool): Whether the notification was sent successfully
- `message_id` (Optional[str]): Message ID from the notification service
- `error` (Optional[str]): Error message if send failed
- `timestamp` (datetime): Timestamp of the send attempt (must have timezone)

**Validation Rules:**
- If success is True, message_id must be provided
- If success is False, error must be provided
- timestamp must include timezone information

**Example:**
```python
from datetime import datetime, timezone
from app.core.notifications import SendResult

# Success case
result = SendResult(
    success=True,
    message_id="SM1234567890abcdef",
    error=None,
    timestamp=datetime.now(timezone.utc)
)

# Failure case
result = SendResult(
    success=False,
    message_id=None,
    error="API timeout after 10 seconds",
    timestamp=datetime.now(timezone.utc)
)
```

### 5. BroadcastResult

Result of WebSocket broadcast operation.

**Fields:**
- `clients_notified` (int): Number of clients successfully notified (must be non-negative)
- `clients_disconnected` (int): Number of clients disconnected during broadcast (default: 0, must be non-negative)

**Validation Rules:**
- clients_notified must be non-negative
- clients_disconnected must be non-negative

**Example:**
```python
from app.core.notifications import BroadcastResult

result = BroadcastResult(
    clients_notified=15,
    clients_disconnected=2
)
```

### 6. NotificationResult

Aggregated result of notification orchestration across all channels.

**Fields:**
- `incident_id` (UUID): Unique identifier for the incident
- `whatsapp_sent` (bool): Whether WhatsApp notification was sent (default: False)
- `whatsapp_message_id` (Optional[str]): WhatsApp message ID if sent
- `email_sent` (bool): Whether email notification was sent (default: False)
- `email_message_id` (Optional[str]): Email message ID if sent
- `popup_broadcast` (bool): Whether popup was broadcast (default: False)
- `popup_clients_notified` (int): Number of clients notified via popup (default: 0, must be non-negative)
- `errors` (list[str]): List of error messages from failed notification attempts (default: [])

**Validation Rules:**
- popup_clients_notified must be non-negative

**Example:**
```python
from uuid import uuid4
from app.core.notifications import NotificationResult

# All channels successful
result = NotificationResult(
    incident_id=uuid4(),
    whatsapp_sent=True,
    whatsapp_message_id="SM1234567890abcdef",
    email_sent=True,
    email_message_id="msg_abc123xyz",
    popup_broadcast=True,
    popup_clients_notified=15,
    errors=[]
)

# Partial failure
result = NotificationResult(
    incident_id=uuid4(),
    whatsapp_sent=False,
    whatsapp_message_id=None,
    email_sent=True,
    email_message_id="msg_abc123xyz",
    popup_broadcast=True,
    popup_clients_notified=15,
    errors=["WhatsApp: API timeout after 10 seconds"]
)
```

## Type Aliases

### IncidentPriority
```python
IncidentPriority = Literal["P1", "P2", "P3", "P4"]
```

### NotificationChannel
```python
NotificationChannel = Literal["whatsapp", "email", "popup"]
```

## Usage in Services

These models are designed to be used by notification services:

```python
from app.core.notifications import (
    IncidentNotificationData,
    AssignmentPopupData,
    ContactInfo,
    SendResult,
    NotificationResult
)

# In WhatsApp Service
async def send_incident_acknowledgment(
    recipient_phone: str,
    incident_data: IncidentNotificationData
) -> SendResult:
    # Send WhatsApp message
    pass

# In Email Service
async def send_incident_acknowledgment(
    recipient_email: str,
    incident_data: IncidentNotificationData
) -> SendResult:
    # Send email
    pass

# In WebSocket Manager
async def broadcast_assignment_popup(
    incident_data: AssignmentPopupData
) -> BroadcastResult:
    # Broadcast to connected clients
    pass

# In Notification Orchestrator
async def trigger_acknowledgment_notifications(
    incident: OpsIncident,
    db: AsyncSession
) -> NotificationResult:
    # Coordinate all notification channels
    pass
```

## Testing

Comprehensive unit tests are provided in `test_incident_schemas.py`:

```bash
# Run all tests
pytest app/core/notifications/test_incident_schemas.py -v

# Run specific test class
pytest app/core/notifications/test_incident_schemas.py::TestContactInfo -v

# Run specific test
pytest app/core/notifications/test_incident_schemas.py::TestContactInfo::test_phone_e164_format_validation_missing_plus -v
```

## Requirements Mapping

These models satisfy the following requirements from the specification:

- **Requirement 1.3**: WhatsApp notification delivery with incident details
- **Requirement 2.3**: Email notification delivery with incident details
- **Requirement 3.2**: Real-time popup notifications with assignment information
- **Requirement 5.3**: Contact information resolution with at least one contact method
- **Requirement 5.4**: Phone number validation in E.164 format
- **Requirement 5.5**: Email address validation
- **Requirement 8.1**: Message content formatting with incident details

## Migration Notes

If you're migrating from older notification schemas:

1. Import from the new location:
   ```python
   # Old
   from app.core.notifications.schemas import ...
   
   # New
   from app.core.notifications.incident_schemas import ...
   # or
   from app.core.notifications import ...
   ```

2. Update priority values to use P1-P4 format:
   ```python
   # Old
   priority = "CRITICAL"
   
   # New
   priority = "P1"
   ```

3. Ensure all datetime fields include timezone information:
   ```python
   from datetime import datetime, timezone
   
   # Old
   acknowledged_at = datetime.now()
   
   # New
   acknowledged_at = datetime.now(timezone.utc)
   ```

4. Update phone numbers to E.164 format:
   ```python
   # Old
   phone = "415-555-2671"
   
   # New
   phone = "+14155552671"
   ```
