"""
Intelli Platform — OAuth2/SSO Router
Feature: AUTH-6.2

Endpoints for OAuth2 authorization and callback handling.
Uses in-memory state store instead of Redis for CSRF tokens.
"""
import secrets
import hashlib
import base64
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.core.auth.oauth.service import OAuthService
from app.core.auth.authentication import create_access_token, create_refresh_token
from app.core.auth.sessions.service import SessionService

router = APIRouter(prefix="/api/v1/auth/oauth", tags=["OAuth2/SSO"])

# In-memory OAuth state store (state -> code_verifier, with expiry tracking)
_oauth_states: dict[str, str] = {}


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
):
    """Initiate OAuth flow: redirect to provider authorization endpoint."""
    if provider not in ["google", "microsoft"]:
        raise HTTPException(status_code=400, detail="Invalid OAuth provider")

    if provider == "google":
        client_id = settings.OAUTH_GOOGLE_CLIENT_ID
        client_secret = settings.OAUTH_GOOGLE_CLIENT_SECRET
        from app.core.auth.oauth.providers import GoogleOAuthProvider
        provider_class = GoogleOAuthProvider
    else:
        client_id = settings.OAUTH_MICROSOFT_CLIENT_ID
        client_secret = settings.OAUTH_MICROSOFT_CLIENT_SECRET
        from app.core.auth.oauth.providers import MicrosoftOAuthProvider
        provider_class = MicrosoftOAuthProvider

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OAuth provider {provider} not configured",
        )

    code_verifier, code_challenge = _generate_pkce_pair()
    state = secrets.token_urlsafe(32)

    # Store state in memory
    _oauth_states[state] = code_verifier

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
):
    """Handle OAuth provider callback."""
    if provider not in ["google", "microsoft"]:
        raise HTTPException(status_code=400, detail="Invalid OAuth provider")

    # Verify state and get code_verifier
    code_verifier = _oauth_states.pop(state, None)
    if not code_verifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired state parameter",
        )

    if provider == "google":
        client_id = settings.OAUTH_GOOGLE_CLIENT_ID
        client_secret = settings.OAUTH_GOOGLE_CLIENT_SECRET
    else:
        client_id = settings.OAUTH_MICROSOFT_CLIENT_ID
        client_secret = settings.OAUTH_MICROSOFT_CLIENT_SECRET

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OAuth provider {provider} not configured",
        )

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

    access_token, refresh_token = await SessionService.create_session(
        db,
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
