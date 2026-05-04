"""
Intelli Platform — OAuth Service
Feature: AUTH-6.2

Handles OAuth provider callbacks and account linking.
"""
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.user import User
from app.core.auth.oauth.models import OAuthAccount
from app.core.auth.oauth.providers import GoogleOAuthProvider, MicrosoftOAuthProvider


class OAuthService:
    """Manages OAuth provider integrations and account linking."""

    @staticmethod
    async def handle_oauth_callback(
        db: AsyncSession,
        provider_name: str,
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        code_verifier: str,
    ) -> tuple[User, bool]:
        """Handle OAuth provider callback and return/create user.

        Args:
            db: Database session
            provider_name: "google" or "microsoft"
            code: Authorization code from provider
            client_id: OAuth client ID
            client_secret: OAuth client secret
            redirect_uri: Redirect URI used in auth request
            code_verifier: PKCE code verifier

        Returns:
            (user, is_new_user)
            - user: The authenticated User object
            - is_new_user: True if this was a new user registration

        Raises:
            ValueError: If provider is invalid or OAuth exchange fails
        """
        # Get provider
        if provider_name == "google":
            provider = GoogleOAuthProvider
        elif provider_name == "microsoft":
            provider = MicrosoftOAuthProvider
        else:
            raise ValueError(f"Invalid OAuth provider: {provider_name}")

        # Exchange code for tokens
        token_data = await provider.exchange_code(
            code=code,
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            code_verifier=code_verifier,
        )

        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Failed to get access token from OAuth provider")

        # Fetch user info
        userinfo = await provider.get_userinfo(access_token)

        provider_user_id = userinfo.get("id")
        email = userinfo.get("email")
        name = userinfo.get("name", email or "User")

        if not provider_user_id:
            raise ValueError("OAuth provider did not return user ID")

        # Check if OAuthAccount exists
        oauth_result = await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == provider_name,
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        existing_oauth = oauth_result.scalar_one_or_none()

        if existing_oauth:
            # Account already linked — update tokens and return user
            existing_oauth.access_token = access_token
            existing_oauth.refresh_token = token_data.get("refresh_token")
            if "expires_in" in token_data:
                existing_oauth.token_expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=token_data["expires_in"]
                )
            existing_oauth.raw_profile = userinfo
            await db.commit()

            # Get user
            user_result = await db.execute(
                select(User).where(User.id == existing_oauth.user_id)
            )
            user = user_result.scalar_one_or_none()

            return user, False

        # OAuthAccount doesn't exist — check if email exists
        if email:
            user_result = await db.execute(select(User).where(User.email == email))
            existing_user = user_result.scalar_one_or_none()

            if existing_user:
                # Email exists — link OAuthAccount to existing user
                oauth_account = OAuthAccount(
                    user_id=existing_user.id,
                    provider=provider_name,
                    provider_user_id=provider_user_id,
                    access_token=access_token,
                    refresh_token=token_data.get("refresh_token"),
                    raw_profile=userinfo,
                )
                if "expires_in" in token_data:
                    oauth_account.token_expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=token_data["expires_in"]
                    )
                db.add(oauth_account)
                await db.commit()

                return existing_user, False

        # New user — create account
        new_user = User(
            email=email or f"{provider_name}_{provider_user_id}@intelli.local",
            hashed_password="!oauth",  # Placeholder — OAuth users don't use passwords
            full_name=name,
            is_active=True,
            email_verified=True,  # OAuth email is verified by provider
        )
        db.add(new_user)
        await db.flush()

        # Create OAuthAccount
        oauth_account = OAuthAccount(
            user_id=new_user.id,
            provider=provider_name,
            provider_user_id=provider_user_id,
            access_token=access_token,
            refresh_token=token_data.get("refresh_token"),
            raw_profile=userinfo,
        )
        if "expires_in" in token_data:
            oauth_account.token_expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=token_data["expires_in"]
            )
        db.add(oauth_account)
        await db.commit()
        await db.refresh(new_user)

        return new_user, True
