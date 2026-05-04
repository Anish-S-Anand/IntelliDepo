"""
Intelli Platform — Session Management Service
Feature: AUTH-6.2

DB-only session management (no Redis dependency).
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.shared.models.user import User
from app.core.auth.sessions.models import Session


class SessionService:
    """Manages user sessions with DB-backed token revocation."""

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user: User,
        device_name: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, str]:
        """Create a new session and return (access_token, refresh_token)."""
        from app.core.auth.authentication import create_access_token, create_refresh_token

        access_jti = str(uuid.uuid4())
        refresh_jti = str(uuid.uuid4())

        access_token = create_access_token(user.id, access_jti, roles=[])
        refresh_token = create_refresh_token(user.id, refresh_jti)

        session = Session(
            user_id=user.id,
            jti=access_jti,
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
        jti: str,
    ) -> None:
        """Revoke a session by marking it inactive in the DB."""
        result = await db.execute(select(Session).where(Session.jti == jti))
        session = result.scalar_one_or_none()

        if session:
            session.is_active = False
            await db.commit()

    @staticmethod
    async def revoke_all_user_sessions(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Revoke all active sessions for a user (logout all devices)."""
        result = await db.execute(
            select(Session).where(Session.user_id == user_id).where(Session.is_active == True)
        )
        sessions = result.scalars().all()

        for session in sessions:
            session.is_active = False

        await db.commit()
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
        """Update last_seen_at for a session."""
        result = await db.execute(select(Session).where(Session.jti == jti))
        session = result.scalar_one_or_none()
        if session:
            session.last_seen_at = datetime.now(timezone.utc)
            await db.commit()

    @staticmethod
    async def is_jti_revoked(db: AsyncSession, jti: str) -> bool:
        """Check if a JTI is revoked by checking the session's is_active flag."""
        result = await db.execute(select(Session).where(Session.jti == jti))
        session = result.scalar_one_or_none()
        if session is None:
            return False
        return not session.is_active
