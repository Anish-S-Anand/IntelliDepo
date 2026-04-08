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
from app.core.redis_client import get_redis
from app.shared.models.user import User

import redis.asyncio as aioredis

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> User:
    """Extract and validate the current user from the access token.

    Validates JWT token, checks if JTI is revoked, and ensures user is active.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    # Check if JTI is revoked (session-based revocation)
    jti = payload.get("jti")
    if jti:
        from app.core.auth.sessions.service import SessionService

        if await SessionService.is_jti_revoked(redis, jti):
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
    """FastAPI dependency that checks if the current user has a specific permission.

    Usage:
        @router.get("/depot/inventory")
        async def list_inventory(user: User = Depends(require_permission("depot:read"))):
            ...
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_permission(permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_code}' required",
            )
        return current_user
    return _check


def require_role(role_name: str) -> Callable:
    """FastAPI dependency that checks if the current user has a specific role.

    Usage:
        @router.delete("/users/{user_id}")
        async def delete_user(user: User = Depends(require_role("admin"))):
            ...
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.has_role(role_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' required",
            )
        return current_user
    return _check


def require_any_permission(*permission_codes: str) -> Callable:
    """Require at least one of the listed permissions."""
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
