"""
In-app notification channel — logs notifications (Redis pub/sub removed).
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class InAppChannel:
    """Send in-app notifications via logging (Redis removed)."""

    @staticmethod
    async def send(
        user_id: str | None,
        alert_id: str,
        title: str,
        message: str,
        priority: str,
        payload: dict[str, Any] | None = None,
    ) -> bool:
        logger.info(
            f"In-app notification for user {user_id}: [{priority}] {title} — {message}"
        )
        return True
