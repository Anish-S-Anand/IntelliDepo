"""
Intelli Platform — Auth Dependencies
Feature: AUTH-6.1, AUTH-6.2

FastAPI dependencies for extracting/validating users and checking RBAC permissions.
"""
import uuid
import logging
from collections.abc import Callable

from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.auth.authentication import decode_token, get_user_by_id
from app.shared.models.user import User

logger = logging.getLogger("intelli.auth")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
http_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Demo token support — allows frontend demo credentials to work without
# a real JWT. Demo tokens have the format: "demo-token-<user-id>"
# ---------------------------------------------------------------------------

_DEMO_USER_MAP = {
    "wm.blr@fidelis-demo.com": {"full_name": "Warehouse Manager - Bengaluru", "role": "warehouse_manager", "is_superuser": False},
    "wm.hyd@fidelis-demo.com": {"full_name": "Warehouse Manager - Hyderabad", "role": "warehouse_manager", "is_superuser": False},
    "wm.mum@fidelis-demo.com": {"full_name": "Warehouse Manager - Mumbai", "role": "warehouse_manager", "is_superuser": False},
    "regional@fidelis-demo.com": {"full_name": "Regional Manager - India", "role": "regional_manager", "is_superuser": False},
    "central@fidelis-demo.com": {"full_name": "Central Manager - Command", "role": "central_manager", "is_superuser": False},
    "admin@fidelis-demo.com": {"full_name": "Platform Admin", "role": "admin", "is_superuser": True},
}

_DEMO_TOKEN_EMAIL_MAP = {
    "wh-blr": "wm.blr@fidelis-demo.com",
    "wh-hyd": "wm.hyd@fidelis-demo.com",
    "wh-mum": "wm.mum@fidelis-demo.com",
    "regional-india": "regional@fidelis-demo.com",
    "central-command": "central@fidelis-demo.com",
    "admin-platform": "admin@fidelis-demo.com",
}


async def _get_or_create_demo_user(db: AsyncSession, email: str) -> User | None:
    """Look up a demo user by email, creating them if they don't exist yet."""
    info = _DEMO_USER_MAP.get(email)
    if not info:
        return None

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user

    # Create the demo user on-the-fly
    try:
        from app.core.auth.authentication import register_user
        user = await register_user(db, email, "MacroPulse2025!", info["full_name"])
        user.is_superuser = info["is_superuser"]
        user.email_verified = True
        await db.commit()
        await db.refresh(user)
        return user
    except Exception as e:
        logger.warning(f"Could not create demo user {email}: {e}")
        await db.rollback()
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the access token.

    Supports both real JWTs and demo tokens (demo-token-<email-index>).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # ── Demo token bypass ──────────────────────────────────────────────────
    if token.startswith("demo-token-"):
        token_id = token.removeprefix("demo-token-")
        demo_email = _DEMO_TOKEN_EMAIL_MAP.get(token_id, "admin@fidelis-demo.com")
        user = await _get_or_create_demo_user(db, demo_email)
        if user:
            return user
        raise credentials_exception

    # ── Real JWT validation ────────────────────────────────────────────────
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
