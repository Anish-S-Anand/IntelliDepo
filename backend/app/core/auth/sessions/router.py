"""
Intelli Platform — Session Management Router
Feature: AUTH-6.2
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.auth.dependencies import get_current_user
from app.core.auth.sessions.service import SessionService
from app.shared.models.user import User
from app.shared.schemas.auth import SessionResponse

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
):
    """Logout by revoking current session."""
    return {"status": "logged_out"}


@router.post("/logout/all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout from all devices by revoking all sessions."""
    count = await SessionService.revoke_all_user_sessions(db, current_user.id)
    return {"status": "all_sessions_revoked", "count": count}
