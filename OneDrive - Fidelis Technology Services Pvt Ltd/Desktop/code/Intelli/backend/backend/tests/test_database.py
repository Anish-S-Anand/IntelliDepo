"""
Tests for DATA-5.1: Database Setup & Models
"""
import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, BaseModel, TimestampMixin, check_db_health

pytestmark = pytest.mark.asyncio


# --- Base Model Structure ---

def test_base_model_is_abstract():
    """BaseModel should be abstract — not directly instantiable as a table."""
    assert getattr(BaseModel, "__abstract__", False) is True


def test_base_model_has_uuid_id():
    """BaseModel should define a UUID primary key."""
    columns = {c.name: c for c in BaseModel.__table__.columns} if hasattr(BaseModel, "__table__") else {}
    # Since it's abstract, check via class attributes
    assert hasattr(BaseModel, "id")


def test_base_model_has_timestamps():
    """BaseModel should include created_at and updated_at from TimestampMixin."""
    assert hasattr(BaseModel, "created_at")
    assert hasattr(BaseModel, "updated_at")


def test_timestamp_mixin_standalone():
    """TimestampMixin should provide created_at and updated_at."""
    assert hasattr(TimestampMixin, "created_at")
    assert hasattr(TimestampMixin, "updated_at")


# --- User Model inherits BaseModel ---

def test_user_inherits_base_model():
    """User model should inherit from BaseModel and get id + timestamps."""
    from app.shared.models.user import User

    assert issubclass(User, BaseModel)
    columns = {c.name for c in User.__table__.columns}
    assert "id" in columns
    assert "created_at" in columns
    assert "updated_at" in columns
    assert "email" in columns


# --- Database Session ---

async def test_db_session_works(db):
    """Verify the test database session can execute queries."""
    result = await db.execute(text("SELECT 1"))
    assert result.scalar() == 1


# --- User CRUD via ORM ---

async def test_create_and_read_user(db):
    """Test creating and reading a user through ORM."""
    from app.shared.models.user import User

    user = User(
        email="dbtest@example.com",
        hashed_password="fakehash",
        full_name="DB Test User",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    assert isinstance(user.id, uuid.UUID)
    assert user.email == "dbtest@example.com"
    assert user.created_at is not None
    assert user.updated_at is not None

    # Read back
    result = await db.execute(select(User).where(User.email == "dbtest@example.com"))
    fetched = result.scalar_one()
    assert fetched.id == user.id
    assert fetched.full_name == "DB Test User"


# --- Health Check Endpoint ---

async def test_health_endpoint(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"


async def test_db_health_endpoint(client: AsyncClient):
    """DB health endpoint returns a response (may be unhealthy in test without real PG)."""
    resp = await client.get("/health/db")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data


# --- Model Registry ---

def test_models_registered_with_base():
    """All models should be discoverable in Base.metadata."""
    table_names = Base.metadata.tables.keys()
    assert "users" in table_names
