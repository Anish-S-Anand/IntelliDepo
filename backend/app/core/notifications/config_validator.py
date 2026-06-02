"""
Configuration validation for notification services.

This module validates notification service configurations at application startup
and disables affected channels independently if configuration is invalid.
"""
import logging
from typing import Dict, List

from app.config import Settings

logger = logging.getLogger(__name__)


class NotificationChannelStatus:
    """Tracks the status of notification channels."""

    def __init__(self):
        self.whatsapp_enabled = False
        self.email_enabled = False
        self.websocket_enabled = False
        self.errors: List[str] = []

    def add_error(self, error: str) -> None:
        """Add a configuration error."""
        self.errors.append(error)
        logger.error(f"Notification configuration error: {error}")

    def get_summary(self) -> Dict[str, bool]:
        """Get summary of enabled channels."""
        return {
            "whatsapp": self.whatsapp_enabled,
            "email": self.email_enabled,
            "websocket": self.websocket_enabled,
        }


def validate_whatsapp_config(settings: Settings, status: NotificationChannelStatus) -> None:
    """
    Validate WhatsApp notification configuration.
    
    Args:
        settings: Application settings
        status: Channel status tracker
    """
    # Check if WhatsApp is enabled in settings
    if not settings.NOTIFICATIONS_WHATSAPP_ENABLED:
        logger.info("WhatsApp notifications disabled in configuration")
        return

    # If provider is stub, WhatsApp is effectively disabled
    if settings.WHATSAPP_PROVIDER == "stub":
        logger.info("WhatsApp provider set to 'stub', WhatsApp notifications disabled")
        return

    # Validate provider-specific configuration
    if settings.WHATSAPP_PROVIDER == "twilio":
        if not settings.TWILIO_ACCOUNT_SID:
            status.add_error("TWILIO_ACCOUNT_SID is required when WHATSAPP_PROVIDER=twilio")
            return
        if not settings.TWILIO_AUTH_TOKEN:
            status.add_error("TWILIO_AUTH_TOKEN is required when WHATSAPP_PROVIDER=twilio")
            return
        if not settings.TWILIO_WHATSAPP_FROM:
            status.add_error("TWILIO_WHATSAPP_FROM is required when WHATSAPP_PROVIDER=twilio")
            return
    elif settings.WHATSAPP_PROVIDER == "meta":
        if not settings.META_WHATSAPP_TOKEN:
            status.add_error("META_WHATSAPP_TOKEN is required when WHATSAPP_PROVIDER=meta")
            return
        if not settings.META_WHATSAPP_PHONE_NUMBER_ID:
            status.add_error("META_WHATSAPP_PHONE_NUMBER_ID is required when WHATSAPP_PROVIDER=meta")
            return

    # Validate common WhatsApp configuration
    if not settings.WHATSAPP_API_BASE_URL:
        status.add_error("WHATSAPP_API_BASE_URL is required for WhatsApp notifications")
        return

    if not settings.WHATSAPP_API_TOKEN and settings.WHATSAPP_PROVIDER != "stub":
        # For Twilio, use TWILIO_AUTH_TOKEN; for Meta, use META_WHATSAPP_TOKEN
        # WHATSAPP_API_TOKEN is optional if provider-specific tokens are set
        pass

    if not settings.WHATSAPP_SENDER_NUMBER and settings.WHATSAPP_PROVIDER != "stub":
        # For Twilio, use TWILIO_WHATSAPP_FROM; for Meta, use META_WHATSAPP_PHONE_NUMBER_ID
        # WHATSAPP_SENDER_NUMBER is optional if provider-specific numbers are set
        pass

    # All validations passed
    status.whatsapp_enabled = True
    logger.info(f"WhatsApp notifications enabled (provider: {settings.WHATSAPP_PROVIDER})")


def validate_email_config(settings: Settings, status: NotificationChannelStatus) -> None:
    """
    Validate Email/SMTP notification configuration.
    
    Args:
        settings: Application settings
        status: Channel status tracker
    """
    # Check if Email is enabled in settings
    if not settings.NOTIFICATIONS_EMAIL_ENABLED:
        logger.info("Email notifications disabled in configuration")
        return

    # Validate SMTP host
    if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        status.add_error("SMTP_HOST is required for email notifications")
        return

    # Validate SMTP port (already validated by Pydantic, but double-check)
    if not 0 <= settings.SMTP_PORT <= 65535:
        status.add_error(f"SMTP_PORT must be between 0 and 65535, got {settings.SMTP_PORT}")
        return

    # Validate sender email
    if not settings.SMTP_FROM_EMAIL or not settings.SMTP_FROM_EMAIL.strip():
        status.add_error("SMTP_FROM_EMAIL is required for email notifications")
        return

    # Validate email domain
    if not settings.EMAIL_DOMAIN or not settings.EMAIL_DOMAIN.strip():
        status.add_error("EMAIL_DOMAIN is required for email notifications")
        return

    # SMTP_USER and SMTP_PASSWORD are optional (some SMTP servers don't require auth)
    if settings.SMTP_USER and not settings.SMTP_PASSWORD:
        logger.warning("SMTP_USER is set but SMTP_PASSWORD is empty - authentication may fail")

    # All validations passed
    status.email_enabled = True
    logger.info(f"Email notifications enabled (SMTP: {settings.SMTP_HOST}:{settings.SMTP_PORT})")


def validate_websocket_config(settings: Settings, status: NotificationChannelStatus) -> None:
    """
    Validate WebSocket notification configuration.
    
    Args:
        settings: Application settings
        status: Channel status tracker
    """
    # Check if WebSocket is enabled in settings
    if not settings.NOTIFICATIONS_WEBSOCKET_ENABLED:
        logger.info("WebSocket notifications disabled in configuration")
        return

    # WebSocket doesn't require additional configuration beyond the application server
    # Just ensure it's enabled
    status.websocket_enabled = True
    logger.info("WebSocket notifications enabled")


def validate_notification_config(settings: Settings) -> NotificationChannelStatus:
    """
    Validate all notification service configurations at application startup.
    
    This function checks the configuration for each notification channel
    (WhatsApp, Email, WebSocket) and disables channels independently if
    their configuration is invalid or incomplete.
    
    Args:
        settings: Application settings
        
    Returns:
        NotificationChannelStatus with enabled channels and any errors
    """
    logger.info("Validating notification service configurations...")
    
    status = NotificationChannelStatus()
    
    # Validate each channel independently
    validate_whatsapp_config(settings, status)
    validate_email_config(settings, status)
    validate_websocket_config(settings, status)
    
    # Log summary
    summary = status.get_summary()
    enabled_channels = [channel for channel, enabled in summary.items() if enabled]
    disabled_channels = [channel for channel, enabled in summary.items() if not enabled]
    
    if enabled_channels:
        logger.info(f"Enabled notification channels: {', '.join(enabled_channels)}")
    if disabled_channels:
        logger.warning(f"Disabled notification channels: {', '.join(disabled_channels)}")
    
    if status.errors:
        logger.error(f"Configuration errors found: {len(status.errors)}")
        for error in status.errors:
            logger.error(f"  - {error}")
    else:
        logger.info("Notification configuration validation completed successfully")
    
    return status
