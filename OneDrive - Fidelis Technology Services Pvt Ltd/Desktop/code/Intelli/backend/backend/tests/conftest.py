"""
Shared test fixtures for all Intelli Platform tests.
Uses an in-memory SQLite database so no real PostgreSQL is needed.
Mocks Redis so tests don't require a running Redis instance.
"""
import os
import sys
from pathlib import Path

# Must be set BEFORE any app imports so database.py picks up SQLite
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["DEBUG"] = "false"

# Force the installed cryptography package to load before the backend root is on
# sys.path. The repo currently contains a sibling `backend/cryptography` folder
# that can shadow the real dependency during tests.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
backend_root_str = str(BACKEND_ROOT)
original_sys_path = sys.path.copy()
sys.path = [entry for entry in sys.path if Path(entry or ".").resolve() != BACKEND_ROOT]
import cryptography  # noqa: F401
sys.path = original_sys_path

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# ── Fake Redis for tests ──────────────────────────────────

class FakeRedis:
    """In-memory Redis mock for testing without a running Redis server."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None, **kwargs) -> None:
        self._store[key] = value

    async def setex(self, key: str, time: int, value: str) -> None:
        self._store[key] = value

    async def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                count += 1
        return count

    async def exists(self, *keys: str) -> int:
        return sum(1 for k in keys if k in self._store)

    async def keys(self, pattern: str = "*") -> list[str]:
        return list(self._store.keys())

    async def close(self) -> None:
        pass


_fake_redis = FakeRedis()


# Monkey-patch the Redis client module so it returns our fake.
# Must set _redis_client directly since get_redis() checks it first.
import app.core.redis_client as redis_module
redis_module._redis_client = _fake_redis


@pytest_asyncio.fixture(scope="function")
async def db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Clear fake redis between tests
    _fake_redis._store.clear()


@pytest_asyncio.fixture(scope="function")
async def client(db):
    async def override_get_db():
        yield db
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", follow_redirects=True) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def auth_client(db):
    """Authenticated test client with a valid JWT token.

    Creates a test user in the DB and provides a client with Authorization header.
    """
    import uuid as _uuid
    from app.shared.models.user import User
    from app.core.auth.authentication import create_access_token, hash_password

    user_id = _uuid.uuid4()
    user = User(
        id=user_id,
        email="testuser@intelli.ai",
        full_name="Test User",
        hashed_password=hash_password("testpass123"),
        is_active=True,
        is_superuser=True,
    )
    db.add(user)
    await db.commit()

    jti = str(_uuid.uuid4())
    token = create_access_token(user_id=user_id, jti=jti, roles=["admin"])

    async def override_get_db():
        yield db
    app.dependency_overrides[get_db] = override_get_db

    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers=headers,
        follow_redirects=True,
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
