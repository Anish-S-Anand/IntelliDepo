"""
Intelli Platform — Notification Configuration

Configuration and initialization for notification services.
Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
"""
import os
import logging
from typing import Optional

from app.core.notifications.contact_resolver import UserContactResolver
from app.core.notifications.whatsapp_service import WhatsAppService
from app.core.notifications.email_service import EmailService
from app.core.notifications.websocket_manager import websocket_manager
from app.core.notifications.orchestrator import NotificationOrchestrator

logger = logging.getLogger(__name__)


def get_notification_orchestrator() -> NotificationOrchestrator:
    """
    Get configured notification orchestrator instance.
    
    Returns:
        NotificationOrchestrator with all services configured
    """
    # Contact resolver
    contact_resolver = UserContactResolver()
    
    # WhatsApp service configuration
    whatsapp_enabled = os.getenv("NOTIFICATIONS_WHATSAPP_ENABLED", "true").lower() == "true"
    whatsapp_api_base = os.getenv("WHATSAPP_API_BASE_URL", "")
    whatsapp_api_token = os.getenv("WHATSAPP_API_TOKEN", "")
    whatsapp_sender = os.getenv("WHATSAPP_SENDER_NUMBER", "")
    
    # Disable WhatsApp if configuration is missing
    if not whatsapp_api_base or not whatsapp_api_token or not whatsapp_sender:
        logger.warning("WhatsApp configuration incomplete - WhatsApp notifications disabled")
        whatsapp_enabled = False
    
    whatsapp_service = WhatsAppService(
        api_base_url=whatsapp_api_base,
        api_token=whatsapp_api_token,
        sender_number=whatsapp_sender,
        enabled=whatsapp_enabled
    )
    
    # Email service configuration
    email_enabled = os.getenv("NOTIFICATIONS_EMAIL_ENABLED", "true").lower() == "true"
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port_str = os.getenv("SMTP_PORT", "1025")
    smtp_username = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "noreply@intelli.ai")
    email_domain = os.getenv("EMAIL_DOMAIN", "intelli.ai")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
    
    # Validate SMTP port
    try:
        smtp_port = int(smtp_port_str)
        if smtp_port < 0 or smtp_port > 65535:
            logger.error(f"Invalid SMTP_PORT: {smtp_port}. Must be 0-65535. Email notifications disabled.")
            email_enabled = False
            smtp_port = 1025  # Default fallback
    except ValueError:
        logger.error(f"Invalid SMTP_PORT: {smtp_port_str}. Must be an integer. Email notifications disabled.")
        email_enabled = False
        smtp_port = 1025
    
    email_service = EmailService(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_username=smtp_username,
        smtp_password=smtp_password,
        sender_address=smtp_from,
        email_domain=email_domain,
        use_tls=smtp_use_tls,
        enabled=email_enabled
    )
    
    # Create orchestrator
    orchestrator = NotificationOrchestrator(
        contact_resolver=contact_resolver,
        whatsapp_service=whatsapp_service,
        email_service=email_service,
        websocket_manager=websocket_manager
    )
    
    logger.info(
        f"Notification orchestrator initialized: "
        f"WhatsApp={'enabled' if whatsapp_enabled else 'disabled'}, "
        f"Email={'enabled' if email_enabled else 'disabled'}"
    )
    
    return orchestrator


# Global orchestrator instance
_orchestrator: Optional[NotificationOrchestrator] = None


def get_orchestrator() -> NotificationOrchestrator:
    """Get or create the global notification orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = get_notification_orchestrator()
    return _orchestrator
