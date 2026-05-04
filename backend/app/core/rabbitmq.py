"""
Intelli Platform — RabbitMQ Publisher
Feature: PLAT-MQ

Async RabbitMQ publisher for event-driven alert routing.
Used by IntelliVision modules for mismatch alerts, gate signals,
and perimeter breach notifications.

Requires aio-pika (already in requirements.txt).
Gracefully degrades to logging-only when RabbitMQ is unreachable.
"""
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("intelli.rabbitmq")

_connection = None
_channel = None

RABBITMQ_URL = os.getenv(
    "RABBITMQ_URL",
    "amqp://intelli:intelli@localhost:5672/",
)


async def _ensure_channel():
    """Lazily open a persistent connection and channel."""
    global _connection, _channel
    if _channel is not None and not _channel.is_closed:
        return _channel

    try:
        import aio_pika
        _connection = await aio_pika.connect_robust(RABBITMQ_URL)
        _channel = await _connection.channel()
        logger.info("RabbitMQ channel established")
        return _channel
    except Exception as e:
        logger.warning(f"RabbitMQ unavailable — events will be logged only: {e}")
        _channel = None
        return None


async def publish_event(
    exchange: str,
    routing_key: str,
    event_type: str,
    payload: dict,
    headers: Optional[dict] = None,
) -> bool:
    """
    Publish a JSON event to a RabbitMQ exchange.
    Returns True if published successfully, False if RabbitMQ is unavailable.
    """
    message_body = {
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }

    channel = await _ensure_channel()
    if channel is None:
        logger.info(f"[MQ-FALLBACK] {event_type} -> {routing_key}: {json.dumps(payload)[:200]}")
        return False

    try:
        import aio_pika

        # Declare exchange if it doesn't exist (topic type for flexible routing)
        ex = await channel.declare_exchange(
            exchange,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )

        await ex.publish(
            aio_pika.Message(
                body=json.dumps(message_body).encode(),
                content_type="application/json",
                headers=headers or {},
            ),
            routing_key=routing_key,
        )
        logger.debug(f"[MQ] Published {event_type} -> {exchange}/{routing_key}")
        return True
    except Exception as e:
        logger.error(f"[MQ] Failed to publish {event_type}: {e}")
        return False


async def publish_alert(
    alert_type: str,
    severity: str,
    payload: dict,
) -> bool:
    """
    Convenience method for publishing alert events.
    Routes to 'depot.alerts' exchange with severity-based routing key.
    """
    return await publish_event(
        exchange="depot.alerts",
        routing_key=f"alert.{alert_type}.{severity}",
        event_type=f"depot.alert.{alert_type}",
        payload=payload,
    )


async def publish_gate_signal(
    gate_id: str,
    decision: str,
    payload: dict,
) -> bool:
    """Publish gate access decision to RabbitMQ."""
    return await publish_event(
        exchange="depot.gate",
        routing_key=f"gate.{decision}",
        event_type="depot.gate.signal",
        payload={"gate_id": gate_id, "decision": decision, **payload},
    )


async def close():
    """Gracefully close RabbitMQ connection."""
    global _connection, _channel
    if _connection and not _connection.is_closed:
        await _connection.close()
    _connection = None
    _channel = None
