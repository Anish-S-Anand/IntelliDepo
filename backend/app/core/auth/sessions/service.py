"""
Intelli Platform — Session Management Service
Feature: AUTH-6.2
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.config import settings
from app.shared.models.user import User
from app.core.auth.sessions.models import Session


class SessionService:
    """Manages user sessions with Redis-backed token revocation."""

    @staticmethod
    async def create_session(
        db: AsyncSession,
        redis: aioredis.Redis,
        user: User,
        device_name: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, str]:
        """Create a new session and return (access_token, refresh_token).

        Generates unique JTI for each token and stores session in DB.
        """
        from app.core.auth.authentication import create_access_token, create_refresh_token

        # Generate JTIs for this session
        access_jti = str(uuid.uuid4())
        refresh_jti = str(uuid.uuid4())

        # Create tokens with JTIs
        access_token = create_access_token(user.id, access_jti, roles=[])
        refresh_token = create_refresh_token(user.id, refresh_jti)

        # Create session record in DB
        session = Session(
            user_id=user.id,
            jti=access_jti,  # Primary JTI is the access token JTI
            device_name=device_name,
            ip_address=ip_address,
            user_agent=user_agent,
            is_active=True,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS),
            last_seen_at=datetime.now(timezone.utc),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        return access_token, refresh_token

    @staticmethod
    async def revoke_session(
        db: AsyncSession,
        redis: aioredis.Redis,
        jti: str,
    ) -> None:
        """Revoke a session by adding JTI to Redis blocklist.

        The blocklist is checked on every token decode to ensure revoked tokens are rejected.
        """
        # Find session by JTI and mark as inactive
        result = await db.execute(select(Session).where(Session.jti == jti))
        session = result.scalar_one_or_none()

        if session:
            session.is_active = False
            await db.commit()

        # Add JTI to Redis blocklist
        # Calculate TTL: token expiry - now
        # For simplicity, use a fixed TTL matching SESSION_MAX_AGE_SECONDS
        blocklist_key = f"jti_blocklist:{jti}"
        await redis.setex(blocklist_key, settings.SESSION_MAX_AGE_SECONDS, "revoked")

    @staticmethod
    async def revoke_all_user_sessions(
        db: AsyncSession,
        redis: aioredis.Redis,
        user_id: uuid.UUID,
    ) -> int:
        """Revoke all active sessions for a user (logout all devices)."""
        # Find all active sessions for user
        result = await db.execute(
            select(Session).where(Session.user_id == user_id).where(Session.is_active == True)
        )
        sessions = result.scalars().all()

        # Revoke each session
        for session in sessions:
            await SessionService.revoke_session(db, redis, session.jti)

        return len(sessions)

    @staticmethod
    async def list_active_sessions(db: AsyncSession, user_id: uuid.UUID) -> list[Session]:
        """List all active sessions for a user."""
        result = await db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .where(Session.is_active == True)
            .order_by(Session.last_seen_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def touch_session(db: AsyncSession, jti: str) -> None:
        """Update last_seen_at for a session (called on each API request)."""
        result = await db.execute(select(Session).where(Session.jti == jti))
        session = result.scalar_one_or_none()
        if session:
            session.last_seen_at = datetime.now(timezone.utc)
            await db.commit()

    @staticmethod
    async def is_jti_revoked(redis: aioredis.Redis, jti: str) -> bool:
        """Check if a JTI is in the revocation blocklist."""
        blocklist_key = f"jti_blocklist:{jti}"
        return await redis.exists(blocklist_key) > 0
