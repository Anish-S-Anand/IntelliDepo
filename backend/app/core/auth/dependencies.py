"""
Intelli Platform — Auth Dependencies
Feature: AUTH-6.1, AUTH-6.2

FastAPI dependencies for extracting/validating users and checking RBAC permissions.
"""
import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.auth.authentication import decode_token, get_user_by_id
from app.shared.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    # Check if JTI is revoked (DB-backed)
    jti = payload.get("jti")
    if jti:
        from app.core.auth.sessions.service import SessionService

        if await SessionService.is_jti_revoked(db, jti):
            raise credentials_exception

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise credentials_exception

    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise credentials_exception

    # Touch session activity
    if jti:
        from app.core.auth.sessions.service import SessionService

        await SessionService.touch_session(db, jti)

    return user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to be a superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return current_user


# ── RBAC Dependencies (AUTH-6.2) ──────────────────────────


def require_permission(permission_code: str) -> Callable:
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_permission(permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_code}' required",
            )
        return current_user
    return _check


def require_role(role_name: str) -> Callable:
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_role(role_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' required",
            )
        return current_user
    return _check


def require_any_permission(*permission_codes: str) -> Callable:
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        user_perms = current_user.get_permissions()
        if "*" in user_perms:
            return current_user
        if not any(p in user_perms for p in permission_codes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of permissions {list(permission_codes)} required",
            )
        return current_user
    return _check
