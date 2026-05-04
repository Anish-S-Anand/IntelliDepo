"""
In-app notification channel using Redis pub/sub.
"""
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)


class InAppChannel:
    """Send notifications via Redis pub/sub for real-time WebSocket delivery."""

    @staticmethod
    async def send(
        redis_client: aioredis.Redis,
        user_id: str | None,
        alert_id: str,
        title: str,
        message: str,
        priority: str,
        payload: dict[str, Any] | None = None,
    ) -> bool:
        """
        Publish an in-app notification via Redis.

        Args:
            redis_client: Redis client
            user_id: Target user ID (or None for broadcast)
            alert_id: Alert ID
            title: Alert title
            message: Alert message
            priority: Priority level
            payload: Optional additional payload

        Returns:
            True (fire-and-forget, always returns success)
        """
        try:
            event = {
                "type": "alert",
                "user_id": user_id,
                "alert_id": alert_id,
                "title": title,
                "message": message,
                "priority": priority,
                "payload": payload or {},
            }

            await redis_client.publish(
                settings.NOTIFICATION_WS_REDIS_CHANNEL,
                json.dumps(event),
            )

            logger.debug(
                f"In-app notification published for user {user_id}: {title}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to publish in-app notification: {str(e)}")
            # Fire-and-forget, so don't fail the entire alert
            return False
