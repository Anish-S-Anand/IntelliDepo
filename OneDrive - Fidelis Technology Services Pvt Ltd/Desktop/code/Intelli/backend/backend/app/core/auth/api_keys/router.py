"""
Intelli Platform — API Key Management Router
Feature: AUTH-6.2

Endpoints for API key generation, listing, and revocation.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.auth.dependencies import get_current_user
from app.core.auth.api_keys.service import APIKeyService
from app.shared.models.user import User

router = APIRouter(prefix="/api/v1/auth/api-keys", tags=["API Keys"])


class APIKeyCreateRequest(BaseModel):
    """Request to create an API key."""

    name: str = Field(min_length=1, max_length=255)
    scopes: list[str] = Field(default_factory=list)
    expires_days: int | None = Field(None, ge=1, le=365)


class APIKeyResponseWithKey(BaseModel):
    """Response with full key (only shown once)."""

    id: uuid.UUID
    name: str
    key_prefix: str
    full_key: str  # Only in this response
    scopes: list[str]
    expires_days: int | None
    created_at: str

    class Config:
        from_attributes = True


class APIKeyResponse(BaseModel):
    """Response without full key (for listing)."""

    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: str | None
    created_at: str

    class Config:
        from_attributes = True


@router.post("/", response_model=APIKeyResponseWithKey, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: APIKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new API key.

    The full key is shown ONLY in this response. Store it securely.
    After creation, you can only see the key prefix.
    """
    api_key, full_key = await APIKeyService.create_api_key(
        db=db,
        user_id=current_user.id,
        name=body.name,
        scopes=body.scopes,
        expires_days=body.expires_days,
    )

    return {
        "id": api_key.id,
        "name": api_key.name,
        "key_prefix": api_key.key_prefix,
        "full_key": full_key,
        "scopes": api_key.scopes,
        "expires_days": body.expires_days,
        "created_at": api_key.created_at.isoformat(),
    }


@router.get("/", response_model=list[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the current user.

    Note: Full key is never shown after creation. Only prefix is visible.
    """
    keys = await APIKeyService.list_user_keys(db, current_user.id)

    return [
        {
            "id": key.id,
            "name": key.name,
            "key_prefix": key.key_prefix,
            "scopes": key.scopes,
            "is_active": key.is_active,
            "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
            "created_at": key.created_at.isoformat(),
        }
        for key in keys
    ]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke (deactivate) an API key.

    The key can no longer be used for authentication.
    """
    success = await APIKeyService.revoke_api_key(db, key_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="API key not found")

    return None


@router.delete("/{key_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete an API key.

    Hard delete — cannot be recovered.
    """
    success = await APIKeyService.delete_api_key(db, key_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="API key not found")

    return None
