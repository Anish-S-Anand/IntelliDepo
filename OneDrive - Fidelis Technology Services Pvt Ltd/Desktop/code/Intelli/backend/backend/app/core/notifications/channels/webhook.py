"""
Webhook channel implementation with exponential backoff retry.
"""
import asyncio
import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class WebhookChannel:
    """Send notifications via HTTP webhooks with retry logic."""

    @staticmethod
    async def send(
        webhook_url: str,
        payload: dict[str, Any],
        attempt: int = 1,
    ) -> bool:
        """
        Send a notification via webhook with exponential backoff retry.

        Args:
            webhook_url: Target webhook URL
            payload: JSON payload to send
            attempt: Current attempt number (1-based)

        Returns:
            True if sent successfully, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=settings.NOTIFICATION_WEBHOOK_TIMEOUT) as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )

                # Success if 2xx status code
                if 200 <= response.status_code < 300:
                    logger.info(f"Webhook sent to {webhook_url}: {response.status_code}")
                    return True

                # Retry on certain error codes
                if attempt < settings.NOTIFICATION_WEBHOOK_RETRIES:
                    wait_seconds = 2 ** (attempt - 1)  # 1s, 2s, 4s
                    logger.warning(
                        f"Webhook retry {attempt}/{settings.NOTIFICATION_WEBHOOK_RETRIES} "
                        f"for {webhook_url} in {wait_seconds}s (status {response.status_code})"
                    )
                    await asyncio.sleep(wait_seconds)
                    return await WebhookChannel.send(webhook_url, payload, attempt + 1)

                logger.error(f"Webhook failed after retries: {webhook_url} ({response.status_code})")
                return False

        except asyncio.TimeoutError:
            logger.error(f"Webhook timeout: {webhook_url}")
            if attempt < settings.NOTIFICATION_WEBHOOK_RETRIES:
                wait_seconds = 2 ** (attempt - 1)
                await asyncio.sleep(wait_seconds)
                return await WebhookChannel.send(webhook_url, payload, attempt + 1)
            return False

        except Exception as e:
            logger.error(f"Webhook error: {webhook_url} — {str(e)}")
            if attempt < settings.NOTIFICATION_WEBHOOK_RETRIES:
                wait_seconds = 2 ** (attempt - 1)
                await asyncio.sleep(wait_seconds)
                return await WebhookChannel.send(webhook_url, payload, attempt + 1)
            return False
