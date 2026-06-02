"""
WhatsApp notification channel adapter.

This adapter is intentionally provider-shaped but safe for local/demo use:
when credentials are not configured it returns a successful stub response with
metadata, so incident delivery tracking can be built and tested without sending
real messages.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class WhatsAppDeliveryResult:
    success: bool
    provider_message_id: str | None = None
    status: str = "sent"
    error_message: str | None = None
    metadata: dict[str, Any] | None = None


class WhatsAppChannel:
    """Send WhatsApp notifications through a configured provider."""

    @staticmethod
    def _provider() -> str:
        return getattr(settings, "WHATSAPP_PROVIDER", "stub") or "stub"

    @staticmethod
    def _is_configured() -> bool:
        provider = WhatsAppChannel._provider().lower()
        if provider == "twilio":
            return bool(
                getattr(settings, "TWILIO_ACCOUNT_SID", "")
                and getattr(settings, "TWILIO_AUTH_TOKEN", "")
                and getattr(settings, "TWILIO_WHATSAPP_FROM", "")
            )
        if provider == "meta":
            return bool(
                getattr(settings, "META_WHATSAPP_TOKEN", "")
                and getattr(settings, "META_WHATSAPP_PHONE_NUMBER_ID", "")
            )
        return False

    @staticmethod
    async def send(to_phone: str, body: str, template_name: str | None = None) -> WhatsAppDeliveryResult:
        """
        Send a WhatsApp message.

        Real provider calls should be added behind the provider branches below.
        The stub path keeps demo workflows deterministic and records a provider
        message id for delivery tracking.
        """
        provider = WhatsAppChannel._provider().lower()
        if not WhatsAppChannel._is_configured():
            message_id = f"stub-whatsapp-{uuid.uuid4()}"
            logger.info("WhatsApp stub delivery to %s via %s", to_phone, provider)
            return WhatsAppDeliveryResult(
                success=True,
                provider_message_id=message_id,
                status="sent",
                metadata={
                    "provider": provider,
                    "mode": "stub",
                    "template_name": template_name,
                },
            )

        # Provider integration point. Keep the return contract stable so the
        # incident notification table can track provider ids and errors.
        logger.warning("WhatsApp provider '%s' is configured but not implemented", provider)
        return WhatsAppDeliveryResult(
            success=False,
            status="failed",
            error_message=f"WhatsApp provider '{provider}' is not implemented",
            metadata={"provider": provider, "template_name": template_name},
        )
