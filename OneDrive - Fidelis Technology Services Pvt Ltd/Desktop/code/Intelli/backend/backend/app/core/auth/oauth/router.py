"""
Intelli Platform — OAuth2/SSO Router
Feature: AUTH-6.2

Endpoints for OAuth2 authorization and callback handling.
"""
import secrets
import hashlib
import base64
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.core.redis_client import get_redis
from app.core.auth.oauth.service import OAuthService
from app.core.auth.authentication import create_access_token, create_refresh_token
from app.core.auth.sessions.service import SessionService

import redis.asyncio as aioredis

router = APIRouter(prefix="/api/v1/auth/oauth", tags=["OAuth2/SSO"])


def _generate_pkce_pair() -> tuple[str, str]:
    """Generate PKCE code_verifier and code_challenge."""
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip("=")
    return code_verifier, code_challenge


@router.get("/authorize/{provider}")
async def oauth_authorize(
    provider: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Initiate OAuth flow: redirect to provider authorization endpoint.

    Args:
        provider: "google" or "microsoft"

    Returns:
        Redirect to provider's authorization URL
    """
    if provider not in ["google", "microsoft"]:
        raise HTTPException(status_code=400, detail="Invalid OAuth provider")

    # Get OAuth credentials
    if provider == "google":
        client_id = settings.OAUTH_GOOGLE_CLIENT_ID
        client_secret = settings.OAUTH_GOOGLE_CLIENT_SECRET
        from app.core.auth.oauth.providers import GoogleOAuthProvider

        provider_class = GoogleOAuthProvider
    else:  # microsoft
        client_id = settings.OAUTH_MICROSOFT_CLIENT_ID
        client_secret = settings.OAUTH_MICROSOFT_CLIENT_SECRET
        from app.core.auth.oauth.providers import MicrosoftOAuthProvider

        provider_class = MicrosoftOAuthProvider

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OAuth provider {provider} not configured",
        )

    # Generate PKCE pair
    code_verifier, code_challenge = _generate_pkce_pair()

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state and code_verifier in Redis (5 minute expiry)
    await redis.setex(f"oauth:state:{state}", 300, code_verifier)

    # Get authorization URL
    auth_url = provider_class.get_authorization_url(
        client_id=client_id,
        redirect_uri=f"{settings.OAUTH_REDIRECT_BASE_URL}/api/v1/auth/oauth/callback/{provider}",
        state=state,
        code_challenge=code_challenge,
    )

    return {"authorization_url": auth_url}


@router.get("/callback/{provider}")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Handle OAuth provider callback.

    Args:
        provider: "google" or "microsoft"
        code: Authorization code from provider
        state: State parameter for CSRF protection

    Returns:
        access_token and refresh_token on success
    """
    if provider not in ["google", "microsoft"]:
        raise HTTPException(status_code=400, detail="Invalid OAuth provider")

    # Verify state and get code_verifier
    code_verifier = await redis.get(f"oauth:state:{state}")
    if not code_verifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired state parameter",
        )

    # Clean up state
    await redis.delete(f"oauth:state:{state}")

    # Get OAuth credentials
    if provider == "google":
        client_id = settings.OAUTH_GOOGLE_CLIENT_ID
        client_secret = settings.OAUTH_GOOGLE_CLIENT_SECRET
    else:  # microsoft
        client_id = settings.OAUTH_MICROSOFT_CLIENT_ID
        client_secret = settings.OAUTH_MICROSOFT_CLIENT_SECRET

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OAuth provider {provider} not configured",
        )

    # Handle OAuth callback
    try:
        user, is_new = await OAuthService.handle_oauth_callback(
            db=db,
            provider_name=provider,
            code=code,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=f"{settings.OAUTH_REDIRECT_BASE_URL}/api/v1/auth/oauth/callback/{provider}",
            code_verifier=code_verifier,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create session
    access_token, refresh_token = await SessionService.create_session(
        db,
        redis,
        user,
        device_name="OAuth2 Login",
        ip_address=None,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new,
    }
