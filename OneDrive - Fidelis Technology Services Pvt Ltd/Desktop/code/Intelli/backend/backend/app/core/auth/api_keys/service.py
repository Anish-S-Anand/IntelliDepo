"""
Intelli Platform — API Key Service
Feature: AUTH-6.2

Service-to-service authentication via API keys.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.config import settings
from app.core.auth.api_keys.models import APIKey
from app.shared.models.user import User

# Use same password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class APIKeyService:
    """Manages API key generation, verification, and revocation."""

    @staticmethod
    def generate_key(prefix: str = "") -> tuple[str, str, str]:
        """Generate a new API key.

        Args:
            prefix: Optional custom prefix (defaults to settings.API_KEY_PREFIX)

        Returns:
            (full_key, key_prefix, key_hash)
            - full_key: The complete key (show to user once)
            - key_prefix: First 16 chars (for database lookup)
            - key_hash: Bcrypt hash for storage
        """
        if not prefix:
            prefix = settings.API_KEY_PREFIX

        # Generate random portion
        random_part = secrets.token_urlsafe(32)
        full_key = f"{prefix}{random_part}"

        # Create prefix for lookup (first 16 chars total)
        key_prefix = full_key[:16]

        # Hash for storage
        key_hash = pwd_context.hash(full_key)

        return full_key, key_prefix, key_hash

    @staticmethod
    async def create_api_key(
        db: AsyncSession,
        user_id: uuid.UUID,
        name: str,
        scopes: list[str] | None = None,
        expires_days: int | None = None,
    ) -> tuple[APIKey, str]:
        """Create a new API key for a user.

        Args:
            db: Database session
            user_id: User ID
            name: Friendly name for the key
            scopes: List of permission scopes (e.g., ["agents:read", "agents:execute"])
            expires_days: Days until key expires (None = never expires)

        Returns:
            (APIKey model, full_key_string)
            Note: full_key is returned ONCE here. After this, only the hash is stored.
        """
        full_key, key_prefix, key_hash = APIKeyService.generate_key()

        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)

        api_key = APIKey(
            user_id=user_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=scopes or [],
            is_active=True,
            expires_at=expires_at,
        )
        db.add(api_key)
        await db.commit()
        await db.refresh(api_key)

        return api_key, full_key

    @staticmethod
    async def verify_api_key(db: AsyncSession, raw_key: str) -> User | None:
        """Verify an API key and return the associated user.

        Args:
            db: Database session
            raw_key: The full API key provided by client

        Returns:
            User object if key is valid and active, None otherwise
        """
        # Extract prefix for fast lookup
        key_prefix = raw_key[:16] if len(raw_key) >= 16 else raw_key

        # Look up key by prefix
        result = await db.execute(
            select(APIKey).where(APIKey.key_prefix == key_prefix)
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            return None

        # Check if key is active
        if not api_key.is_active:
            return None

        # Check if key has expired
        if api_key.expires_at and datetime.now(timezone.utc) > api_key.expires_at:
            return None

        # Verify hash
        if not pwd_context.verify(raw_key, api_key.key_hash):
            return None

        # Update last_used_at
        api_key.last_used_at = datetime.now(timezone.utc)
        await db.commit()

        # Get and return user
        user_result = await db.execute(
            select(User).where(User.id == api_key.user_id)
        )
        return user_result.scalar_one_or_none()

    @staticmethod
    async def revoke_api_key(
        db: AsyncSession, key_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Revoke an API key.

        Args:
            db: Database session
            key_id: ID of the API key
            user_id: ID of the user (for ownership check)

        Returns:
            True if revoked, False if not found or unauthorized
        """
        result = await db.execute(
            select(APIKey).where(APIKey.id == key_id).where(APIKey.user_id == user_id)
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            return False

        api_key.is_active = False
        await db.commit()
        return True

    @staticmethod
    async def list_user_keys(db: AsyncSession, user_id: uuid.UUID) -> list[APIKey]:
        """List all API keys for a user (showing only non-sensitive info).

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of APIKey objects (key_hash is still in object but should not be exposed in response)
        """
        result = await db.execute(
            select(APIKey)
            .where(APIKey.user_id == user_id)
            .order_by(APIKey.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def delete_api_key(
        db: AsyncSession, key_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Delete an API key (hard delete).

        Args:
            db: Database session
            key_id: ID of the API key
            user_id: ID of the user (for ownership check)

        Returns:
            True if deleted, False if not found or unauthorized
        """
        result = await db.execute(
            select(APIKey).where(APIKey.id == key_id).where(APIKey.user_id == user_id)
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            return False

        await db.delete(api_key)
        await db.commit()
        return True
