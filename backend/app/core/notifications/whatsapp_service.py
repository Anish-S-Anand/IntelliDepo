"""
Intelli Platform — WhatsApp Notification Service

Sends WhatsApp messages via WhatsApp Business API or Twilio.
Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 8.1, 8.2, 9.1, 12.1
"""
import httpx
from datetime import datetime, timezone
from typing import Optional

from app.core.notifications.incident_schemas import (
    IncidentNotificationData,
    SendResult
)


class WhatsAppService:
    """
    Service for sending WhatsApp notifications about incident acknowledgments.
    
    This service formats incident details into WhatsApp-friendly messages and
    sends them via WhatsApp Business API or Twilio.
    """
    
    def __init__(
        self,
        api_base_url: str,
        api_token: str,
        sender_number: str,
        enabled: bool = True
    ):
        """
        Initialize WhatsApp service.
        
        Args:
            api_base_url: WhatsApp API base URL
            api_token: Authentication token
            sender_number: Sender phone number in E.164 format
            enabled: Whether WhatsApp notifications are enabled
        """
        self.api_base_url = api_base_url
        self.api_token = api_token
        self.sender_number = sender_number
        self.enabled = enabled
    
    def format_whatsapp_message(self, incident: IncidentNotificationData) -> str:
        """
        Format incident details into WhatsApp message text.
        
        Args:
            incident: Incident notification data
            
        Returns:
            Formatted message text (under 4096 characters)
        """
        # Format message with emoji for better mobile readability
        message_parts = [
            f"🚨 *Incident Acknowledged*",
            f"",
            f"*Title:* {incident.title}",
            f"*Priority:* {incident.priority}",
            f"*Assigned to:* {incident.assigned_to}",
            f"*Acknowledged by:* {incident.acknowledged_by}",
            f"*Time:* {incident.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S %Z')}",
        ]
        
        # Add optional fields if available
        if incident.zone:
            message_parts.append(f"*Zone:* {incident.zone}")
        
        if incident.incident_type:
            message_parts.append(f"*Type:* {incident.incident_type}")
        
        if incident.description:
            # Truncate description if needed to stay under 4096 char limit
            desc = incident.description[:500] + "..." if len(incident.description) > 500 else incident.description
            message_parts.append(f"")
            message_parts.append(f"*Description:*")
            message_parts.append(desc)
        
        message = "\n".join(message_parts)
        
        # Ensure message is under WhatsApp's 4096 character limit
        if len(message) > 4096:
            message = message[:4093] + "..."
        
        return message
    
    async def send_incident_acknowledgment(
        self,
        recipient_phone: str,
        incident_data: IncidentNotificationData
    ) -> SendResult:
        """
        Send WhatsApp message about incident acknowledgment.
        
        Args:
            recipient_phone: Phone number in E.164 format
            incident_data: Structured incident information
            
        Returns:
            SendResult with message_id and delivery status
        """
        timestamp = datetime.now(timezone.utc)
        
        # If WhatsApp is disabled, return success without sending
        if not self.enabled:
            return SendResult(
                success=True,
                message_id="whatsapp_disabled",
                error=None,
                timestamp=timestamp
            )
        
        # Format message text
        message_text = self.format_whatsapp_message(incident_data)
        
        try:
            # Prepare API request (Twilio format as example)
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "to": recipient_phone,
                "from": self.sender_number,
                "body": message_text
            }
            
            # Send API request with 10-second timeout
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.api_base_url}/Messages",
                    json=payload,
                    headers=headers
                )
            
            # Handle response
            if response.status_code in (200, 201):
                response_data = response.json()
                message_id = response_data.get("sid") or response_data.get("message_id") or "unknown"
                return SendResult(
                    success=True,
                    message_id=message_id,
                    error=None,
                    timestamp=timestamp
                )
            else:
                return SendResult(
                    success=False,
                    message_id=None,
                    error=f"API error: {response.status_code} - {response.text}",
                    timestamp=timestamp
                )
        
        except httpx.TimeoutException:
            return SendResult(
                success=False,
                message_id=None,
                error="Request timeout after 10 seconds",
                timestamp=timestamp
            )
        except Exception as e:
            return SendResult(
                success=False,
                message_id=None,
                error=f"Unexpected error: {str(e)}",
                timestamp=timestamp
            )
