"""
Intelli Platform — Auth API Router
Feature: AUTH-6.2

Endpoints: register, login, refresh, logout, password reset, change password, me, email verify.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
import secrets
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.config import settings
from app.core.redis_client import get_redis
from app.core.auth.sessions.service import SessionService
from app.core.auth.authentication import (
    authenticate_user,
    change_password,
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    get_user_by_email,
    get_user_by_id,
    register_user,
    reset_password,
)
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.shared.schemas.auth import (
    MessageResponse,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    user = await register_user(db, body.email, body.password, body.full_name)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate and return access + refresh tokens.

    Supports both JSON payloads and OAuth2 password form submissions so Swagger's
    Authorize flow can reuse the same endpoint.
    """
    content_type = request.headers.get("content-type", "")
    email: str | None = None
    password: str | None = None

    if "application/json" in content_type:
        payload = UserLogin.model_validate(await request.json())
        email = payload.email
        password = payload.password
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email/username and password are required",
        )

    user = await authenticate_user(db, email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check if MFA is enabled
    if user.mfa_enabled:
        # Return MFA challenge token instead of full tokens
        import uuid

        mfa_jti = str(uuid.uuid4())
        mfa_token = create_access_token(user.id, mfa_jti, roles=[])
        # Override token type for MFA challenge
        from app.core.auth.authentication import jwt

        payload = jwt.decode(mfa_token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        payload["type"] = "mfa_challenge"
        payload["exp"] = payload["exp"] + 300  # 5 min expiry for MFA token
        mfa_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "access_token": None,
            "refresh_token": None,
            "token_type": "bearer",
        }

    # Create session with tokens
    redis = await get_redis()
    access_token, refresh_token = await SessionService.create_session(
        db, redis, user, device_name=None, ip_address=None
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for new access + refresh tokens."""
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    import uuid

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    new_access_jti = str(uuid.uuid4())
    new_refresh_jti = str(uuid.uuid4())
    return TokenResponse(
        access_token=create_access_token(user.id, new_access_jti),
        refresh_token=create_refresh_token(user.id, new_refresh_jti),
    )


@router.post("/password-reset/request", response_model=MessageResponse)
async def request_password_reset(
    body: PasswordResetRequest, db: AsyncSession = Depends(get_db)
):
    """Request a password reset token. Always returns success to prevent email enumeration."""
    await create_password_reset_token(db, body.email)
    # Always return success to prevent email enumeration
    return MessageResponse(
        message="If an account with that email exists, a password reset link has been sent."
    )


@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset(
    body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)
):
    """Reset password using a valid reset token."""
    success = await reset_password(db, body.token, body.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    return MessageResponse(message="Password has been reset successfully.")


@router.post("/change-password", response_model=MessageResponse)
async def change_user_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for the authenticated user."""
    success = await change_password(db, current_user, body.current_password, body.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return MessageResponse(message="Password changed successfully.")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return current_user


# --- Email Verification Endpoints ---


@router.post("/email/verify/send", response_model=MessageResponse)
async def send_email_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send email verification link to the user's email.

    Note: This is a placeholder. In production, send an actual email.
    """
    if current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified",
        )

    # Generate verification token
    token = secrets.token_urlsafe(32)
    current_user.email_verify_token = token
    current_user.email_verify_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()

    # In production, send email with verification link
    # email_service.send_verification_email(current_user.email, token)

    # For development, log the token
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"Email verification token for {current_user.email}: {token}")

    return MessageResponse(
        message="Verification email sent. Check your inbox for the verification link."
    )


@router.post("/email/verify/confirm", response_model=MessageResponse)
async def confirm_email_verification(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Confirm email verification using the token sent to user's email."""
    from sqlalchemy import select

    # Find user by verification token
    result = await db.execute(
        select(User).where(User.email_verify_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token",
        )

    # Check if token has expired
    if user.email_verify_expires and datetime.now(timezone.utc) > user.email_verify_expires:
        user.email_verify_token = None
        user.email_verify_expires = None
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired",
        )

    # Verify email
    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_expires = None
    await db.commit()

    return MessageResponse(message="Email verified successfully!")
