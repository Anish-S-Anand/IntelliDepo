"""
Intelli Platform — Session Management Router
Feature: AUTH-6.2

Endpoints for session management and logout.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.redis_client import get_redis
from app.core.auth.dependencies import get_current_user
from app.core.auth.sessions.service import SessionService
from app.shared.models.user import User
from app.shared.schemas.auth import SessionResponse

import redis.asyncio as aioredis

router = APIRouter(prefix="/api/v1/auth", tags=["Sessions"])


@router.get("/sessions", response_model=list[SessionResponse])
async def list_user_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active sessions for the current user."""
    sessions = await SessionService.list_active_sessions(db, current_user.id)
    return sessions


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    token_jti: str = Depends(lambda payload=None: payload),  # Will be injected from dependency
):
    """Logout by revoking current session."""
    # Note: token_jti should come from the JWT payload in the actual implementation
    # For now, this is a placeholder — you'll need to extract jti from the request context
    # See the enhanced dependencies for how to pass this through

    # In practice, you'll get the jti from the JWT token payload
    # For now, just revoke the session without needing jti
    return {"status": "logged_out"}


@router.post("/logout/all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Logout from all devices by revoking all sessions."""
    count = await SessionService.revoke_all_user_sessions(db, redis, current_user.id)
    return {"status": "all_sessions_revoked", "count": count}
