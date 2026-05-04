"""
Intelli Platform — Database Connection & Session
Feature: DATA-5.1

Async SQLAlchemy engine with connection pooling, session management, and health check.
"""
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime

from sqlalchemy import DateTime, text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import NullPool

from app.config import settings

# --- Engine Setup with Connection Pooling ---

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine_kwargs: dict = {
    "echo": settings.DEBUG,
}

if _is_sqlite:
    # SQLite doesn't support pool configuration
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_pre_ping": True,
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# --- Declarative Base ---

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class TimestampMixin:
    """Mixin that adds created_at and updated_at timestamps to any model."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class BaseModel(Base, TimestampMixin):
    """Abstract base model with UUID primary key and timestamps.

    All product models should inherit from this instead of Base directly.
    """
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


# --- Session Dependency ---

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session and handles cleanup."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# --- Health Check ---

async def check_db_health() -> dict:
    """Check database connectivity and return pool stats."""
    try:
        async with async_session() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()

        pool_status = {}
        if not _is_sqlite and hasattr(engine.pool, "size"):
            pool_status = {
                "pool_size": engine.pool.size(),
                "checked_in": engine.pool.checkedin(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow(),
            }

        return {"status": "healthy", "pool": pool_status}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
