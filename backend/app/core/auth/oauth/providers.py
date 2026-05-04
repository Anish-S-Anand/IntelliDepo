"""
Intelli Platform — OAuth2 Provider Implementations
Feature: AUTH-6.2

Google and Microsoft OAuth2 providers with PKCE support.
"""
import httpx
from typing import Optional


class GoogleOAuthProvider:
    """Google OAuth2 provider."""

    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    @staticmethod
    def get_authorization_url(
        client_id: str,
        redirect_uri: str,
        state: str,
        code_challenge: str,
    ) -> str:
        """Generate Google authorization URL with PKCE."""
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "access_type": "offline",
        }
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{GoogleOAuthProvider.AUTH_URL}?{query_string}"

    @staticmethod
    async def exchange_code(
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        code_verifier: str,
    ) -> dict:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GoogleOAuthProvider.TOKEN_URL,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                    "code_verifier": code_verifier,
                },
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def get_userinfo(access_token: str) -> dict:
        """Fetch user info from Google."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                GoogleOAuthProvider.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()


class MicrosoftOAuthProvider:
    """Microsoft OAuth2 provider."""

    AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    USERINFO_URL = "https://graph.microsoft.com/v1.0/me"

    @staticmethod
    def get_authorization_url(
        client_id: str,
        redirect_uri: str,
        state: str,
        code_challenge: str,
    ) -> str:
        """Generate Microsoft authorization URL with PKCE."""
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{MicrosoftOAuthProvider.AUTH_URL}?{query_string}"

    @staticmethod
    async def exchange_code(
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        code_verifier: str,
    ) -> dict:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                MicrosoftOAuthProvider.TOKEN_URL,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                    "code_verifier": code_verifier,
                },
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def get_userinfo(access_token: str) -> dict:
        """Fetch user info from Microsoft Graph."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                MicrosoftOAuthProvider.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            # Normalize Microsoft response to match Google format
            return {
                "id": data.get("id"),
                "email": data.get("userPrincipalName") or data.get("mail"),
                "name": data.get("displayName"),
                "picture": None,  # Microsoft doesn't provide this easily
            }
