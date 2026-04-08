"""
Tests for PLAT-6.26: Real-Time Engine
"""
from types import SimpleNamespace

import pytest

from app.core.auth.dependencies import get_current_user
from app.core.gateway.realtime import realtime_hub
from app.main import app


@pytest.mark.asyncio
async def test_hub_publish_delivers_to_subscribers():
    queue = await realtime_hub.subscribe("ops")
    event, delivered_to = await realtime_hub.publish(
        "ops",
        "alert",
        {"severity": "high"},
        sender="system",
    )
    received = await queue.get()

    assert delivered_to >= 1
    assert received.topic == "ops"
    assert received.event_type == "alert"
    assert received.payload["severity"] == "high"
    assert received.id == event.id

    await realtime_hub.unsubscribe("ops", queue)


@pytest.mark.asyncio
async def test_publish_endpoint_requires_auth(client):
    response = await client.post(
        "/api/v1/realtime/publish",
        json={"topic": "ops", "event_type": "alert", "payload": {"severity": "high"}},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_publish_and_topics_endpoints(client):
    async def override_current_user():
        return SimpleNamespace(
            email="realtime@example.com",
            full_name="Realtime Tester",
            is_active=True,
            is_superuser=False,
            roles=[],
        )

    app.dependency_overrides[get_current_user] = override_current_user
    queue = await realtime_hub.subscribe("command-center")
    try:
        response = await client.post(
            "/api/v1/realtime/publish",
            json={
                "topic": "command-center",
                "event_type": "status.update",
                "payload": {"healthy": True},
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["delivered_to"] >= 1
        assert body["event"]["topic"] == "command-center"

        topics_response = await client.get("/api/v1/realtime/topics")
        assert topics_response.status_code == 200
        topics = topics_response.json()
        assert any(topic["topic"] == "command-center" for topic in topics)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        await realtime_hub.unsubscribe("command-center", queue)
