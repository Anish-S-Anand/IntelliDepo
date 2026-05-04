"""
Tests for Day 1 features:
- SHARED-1: TimestampMixin, SoftDeleteMixin
- SHARED-2: request_id_middleware
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock


# --- SHARED-1: Mixins ---

def test_timestamp_mixin_has_correct_fields():
    from app.shared.models.mixins import TimestampMixin
    mixin = TimestampMixin()
    assert hasattr(mixin, "created_at")
    assert hasattr(mixin, "updated_at")


def test_soft_delete_mixin_defaults():
    from app.shared.models.mixins import SoftDeleteMixin
    mixin = SoftDeleteMixin()
    mixin.is_deleted = False
    mixin.deleted_at = None
    assert mixin.is_deleted is False
    assert mixin.deleted_at is None


def test_soft_delete_sets_fields():
    from app.shared.models.mixins import SoftDeleteMixin
    mixin = SoftDeleteMixin()
    mixin.is_deleted = False
    mixin.deleted_at = None
    mixin.soft_delete()
    assert mixin.is_deleted is True
    assert mixin.deleted_at is not None
    assert isinstance(mixin.deleted_at, datetime)


# --- SHARED-2: Middleware ---

@pytest.mark.asyncio
async def test_request_id_middleware_adds_headers():
    from app.shared.middleware.handlers import request_id_middleware
    from unittest.mock import patch

    mock_request = MagicMock()
    mock_request.state = MagicMock()
    mock_request.method = "GET"
    mock_request.url = MagicMock()
    mock_request.url.path = "/test"

    mock_response = MagicMock()
    mock_response.headers = {}
    mock_response.status_code = 200

    async def mock_call_next(req):
        return mock_response

    result = await request_id_middleware(mock_request, mock_call_next)

    assert "X-Request-ID" in result.headers
    assert "X-Process-Time" in result.headers
    assert len(result.headers["X-Request-ID"]) == 36   # UUID length


@pytest.mark.asyncio
async def test_request_id_is_unique_per_request():
    from app.shared.middleware.handlers import request_id_middleware

    ids = set()
    for _ in range(5):
        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.method = "GET"
        mock_request.url = MagicMock()
        mock_request.url.path = "/test"
        mock_response = MagicMock()
        mock_response.headers = {}
        mock_response.status_code = 200

        async def mock_call_next(req):
            return mock_response

        await request_id_middleware(mock_request, mock_call_next)
        ids.add(mock_request.state.request_id)

    assert len(ids) == 5   # all unique
