"""
Intelli Platform — MFA Management Router
Feature: AUTH-6.2

Endpoints for MFA setup, verification, and challenge.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.auth.dependencies import get_current_user
from app.core.auth.mfa.service import MFAService
from app.shared.models.user import User
from app.shared.schemas.auth import MFASetupResponse, MFAVerifyRequest, MFAChallengeRequest

router = APIRouter(prefix="/api/v1/auth/mfa", tags=["MFA"])


class MFASetupResponse(BaseModel):
    """Response for MFA setup."""
    secret: str
    qr_uri: str
    backup_codes: list[str]


class MFAVerifySetupRequest(BaseModel):
    """Request to verify MFA setup."""
    code: str = Field(min_length=6, max_length=8)


class MFADisableRequest(BaseModel):
    """Request to disable MFA."""
    code: str = Field(min_length=6, max_length=8)


@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start MFA setup: generate secret and backup codes.

    Response includes:
    - secret: For manual entry if QR code doesn't scan
    - qr_uri: For scanning with Authenticator app
    - backup_codes: One-time use codes (shown only once)
    """
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="MFA is already enabled",
        )

    setup_data = await MFAService.setup_mfa(db, current_user)
    return setup_data


@router.post("/verify-setup")
async def verify_mfa_setup(
    body: MFAVerifySetupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code and enable MFA."""
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="MFA is already enabled",
        )

    success = await MFAService.verify_setup(db, current_user, body.code)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code",
        )

    return {"status": "mfa_enabled"}


@router.post("/challenge")
async def mfa_challenge(
    body: MFAChallengeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange MFA token + TOTP code for access/refresh tokens.

    This endpoint is called after login when user has MFA enabled.
    The login endpoint will have returned mfa_required: true with an mfa_token.
    """
    from app.core.auth.authentication import decode_token, create_access_token, create_refresh_token
    from app.core.auth.sessions.service import SessionService

    # Decode MFA token
    payload = decode_token(body.mfa_token)
    if not payload or payload.get("type") != "mfa_challenge":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA token",
        )

    # Get user
    import uuid
    from sqlalchemy import select
    from app.shared.models.user import User as UserModel

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Verify TOTP code
    if not await MFAService.verify_totp(user, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired code",
        )

    # Create new session with full tokens
    access_token, refresh_token = await SessionService.create_session(
        db,
        user,
        device_name=None,
        ip_address=None,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/backup-verify")
async def backup_code_verify(
    body: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Use a backup code to authenticate (for when app is unavailable)."""
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled",
        )

    success = await MFAService.use_backup_code(db, current_user, body.code)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid backup code",
        )

    return {"status": "authenticated_with_backup"}


@router.post("/disable")
async def disable_mfa(
    body: MFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable MFA after verifying current TOTP code."""
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled",
        )

    success = await MFAService.disable_mfa(db, current_user, body.code)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid code",
        )

    return {"status": "mfa_disabled"}
