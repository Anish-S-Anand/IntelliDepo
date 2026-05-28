"""
Intelli Platform — Notification Orchestrator

Coordinates multi-channel notifications for incident acknowledgments.
Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.5, 9.6
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.notifications.incident_schemas import (
    IncidentNotificationData,
    AssignmentPopupData,
    NotificationResult
)
from app.core.notifications.contact_resolver import UserContactResolver, UserNotFoundException
from app.core.notifications.whatsapp_service import WhatsAppService
from app.core.notifications.email_service import EmailService
from app.core.notifications.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)


class NotificationOrchestrator:
    """
    Orchestrates multi-channel notifications for incident acknowledgments.
    
    This service coordinates notification dispatch across WhatsApp, Email, and
    WebSocket channels, handling failures gracefully without blocking the
    incident acknowledgment flow.
    """
    
    def __init__(
        self,
        contact_resolver: UserContactResolver,
        whatsapp_service: WhatsAppService,
        email_service: EmailService,
        websocket_manager: WebSocketManager
    ):
        """
        Initialize notification orchestrator.
        
        Args:
            contact_resolver: Service for resolving user contact information
            whatsapp_service: Service for sending WhatsApp messages
            email_service: Service for sending emails
            websocket_manager: Manager for WebSocket connections
        """
        self.contact_resolver = contact_resolver
        self.whatsapp_service = whatsapp_service
        self.email_service = email_service
        self.websocket_manager = websocket_manager
    
    async def trigger_acknowledgment_notifications(
        self,
        incident: "OpsIncident",  # Type hint as string to avoid circular import
        db: AsyncSession
    ) -> NotificationResult:
        """
        Orchestrate multi-channel notifications for incident acknowledgment.
        
        Args:
            incident: The acknowledged incident object
            db: Database session for logging notifications
            
        Returns:
            NotificationResult with success/failure status per channel
        """
        result = NotificationResult(incident_id=incident.id)
        errors = []
        
        # Step 1: Resolve contact information for assigned person
        try:
            contact_info = await self.contact_resolver.get_contact_info(
                incident.assigned_to,
                db
            )
        except UserNotFoundException as e:
            errors.append(f"Failed to resolve contact info: {str(e)}")
            logger.error(f"Contact resolution failed for {incident.assigned_to}: {e}")
            result.errors = errors
            return result
        except Exception as e:
            errors.append(f"Failed to resolve contact info: {str(e)}")
            logger.error(f"Unexpected error resolving contact info: {e}")
            result.errors = errors
            return result
        
        # Step 2: Prepare notification data
        notification_data = IncidentNotificationData(
            incident_id=incident.id,
            title=incident.title,
            description=incident.description,
            priority=incident.priority,
            status="acknowledged",
            acknowledged_by=incident.acknowledged_by or "unknown",
            acknowledged_at=incident.acknowledged_at,
            assigned_to=incident.assigned_to,
            zone=getattr(incident, 'zone', None),
            incident_type=getattr(incident, 'incident_type', None)
        )
        
        # Step 3: Send WhatsApp notification (non-blocking)
        if contact_info.phone:
            try:
                whatsapp_result = await self.whatsapp_service.send_incident_acknowledgment(
                    contact_info.phone,
                    notification_data
                )
                result.whatsapp_sent = whatsapp_result.success
                result.whatsapp_message_id = whatsapp_result.message_id
                
                if not whatsapp_result.success:
                    errors.append(f"WhatsApp: {whatsapp_result.error}")
                    logger.warning(f"WhatsApp notification failed: {whatsapp_result.error}")
            except Exception as e:
                errors.append(f"WhatsApp exception: {str(e)}")
                logger.error(f"WhatsApp notification exception: {e}")
                result.whatsapp_sent = False
        
        # Step 4: Send Email notification (non-blocking)
        if contact_info.email:
            try:
                email_result = await self.email_service.send_incident_acknowledgment(
                    contact_info.email,
                    notification_data
                )
                result.email_sent = email_result.success
                result.email_message_id = email_result.message_id
                
                if not email_result.success:
                    errors.append(f"Email: {email_result.error}")
                    logger.warning(f"Email notification failed: {email_result.error}")
            except Exception as e:
                errors.append(f"Email exception: {str(e)}")
                logger.error(f"Email notification exception: {e}")
                result.email_sent = False
        
        # Step 5: Broadcast popup to connected clients (non-blocking)
        try:
            popup_data = AssignmentPopupData(
                incident_id=incident.id,
                title=incident.title,
                priority=incident.priority,
                assigned_to=incident.assigned_to,
                acknowledged_by=incident.acknowledged_by or "unknown",
                acknowledged_at=incident.acknowledged_at,
                zone=getattr(incident, 'zone', None)
            )
            
            broadcast_result = await self.websocket_manager.broadcast_assignment_popup(
                popup_data
            )
            result.popup_broadcast = True
            result.popup_clients_notified = broadcast_result.clients_notified
        except Exception as e:
            errors.append(f"Popup broadcast exception: {str(e)}")
            logger.error(f"Popup broadcast exception: {e}")
            result.popup_broadcast = False
            result.popup_clients_notified = 0
        
        result.errors = errors
        
        # Log summary
        logger.info(
            f"Notification orchestration complete for incident {incident.id}: "
            f"WhatsApp={result.whatsapp_sent}, Email={result.email_sent}, "
            f"Popup={result.popup_broadcast} ({result.popup_clients_notified} clients)"
        )
        
        return result
