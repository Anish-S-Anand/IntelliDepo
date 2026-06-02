"""
Intelli Platform — Notifications Module

This module provides notification functionality including:
- Multi-channel notification delivery (WhatsApp, Email, WebSocket)
- Incident acknowledgment notifications
- Alert management and preferences
"""

from app.core.notifications.incident_schemas import (
    IncidentNotificationData,
    AssignmentPopupData,
    ContactInfo,
    SendResult,
    BroadcastResult,
    NotificationResult,
    IncidentPriority,
    NotificationChannel,
)

__all__ = [
    "IncidentNotificationData",
    "AssignmentPopupData",
    "ContactInfo",
    "SendResult",
    "BroadcastResult",
    "NotificationResult",
    "IncidentPriority",
    "NotificationChannel",
]
