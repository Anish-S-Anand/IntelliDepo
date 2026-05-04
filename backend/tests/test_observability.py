"""
Tests for Day 2 features:
- OBS-6.18: Audit Logging
- OBS-6.19: Application Monitoring
"""
import pytest
import pytest_asyncio


# --- OBS-6.19: Health Check Endpoint ---

@pytest.mark.asyncio
async def test_health_check_returns_healthy(client):
    response = await client.get("/health/observability")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "intelli-platform-core"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_check_timestamp_is_string(client):
    response = await client.get("/health/observability")
    data = response.json()
    assert isinstance(data["timestamp"], str)  # ISO format string


# --- OBS-6.18: Audit Logging ---

@pytest.mark.asyncio
async def test_log_action_creates_entry(db):
    from app.core.observability.audit import log_action, AuditLog
    from sqlalchemy import select

    entry = await log_action(
        db=db,
        user_id="user-123",
        action="LOGIN",
        resource=None,
        metadata=None,
    )

    assert entry.id is not None
    assert entry.user_id == "user-123"
    assert entry.action == "LOGIN"
    assert entry.created_at is not None


@pytest.mark.asyncio
async def test_log_action_with_metadata(db):
    from app.core.observability.audit import log_action

    entry = await log_action(
        db=db,
        user_id="user-456",
        action="UPDATE_SKU",
        resource="SKU-001",
        metadata={"old_qty": 10, "new_qty": 20},
    )

    assert entry.resource == "SKU-001"
    assert entry.metadata_json["old_qty"] == 10
    assert entry.metadata_json["new_qty"] == 20


@pytest.mark.asyncio
async def test_multiple_audit_entries_are_independent(db):
    from app.core.observability.audit import log_action, AuditLog
    from sqlalchemy import select

    await log_action(db, "user-1", "LOGIN")
    await log_action(db, "user-2", "LOGOUT")
    await log_action(db, "user-1", "CREATE_ORDER", resource="ORD-001")

    result = await db.execute(select(AuditLog))
    logs = result.scalars().all()
    assert len(logs) == 3
