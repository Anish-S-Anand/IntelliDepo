"""
Intelli Platform — Auth Schemas
Feature: AUTH-6.1
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# --- Request Schemas ---

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# --- Response Schemas ---

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_superuser: bool
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str


# --- MFA Schemas ---


class MFASetupResponse(BaseModel):
    """Response from MFA setup endpoint."""

    secret: str
    qr_uri: str
    backup_codes: list[str]


class MFAVerifyRequest(BaseModel):
    """Request to verify TOTP or backup code."""

    code: str = Field(min_length=6, max_length=8)


class MFAChallengeRequest(BaseModel):
    """Request to complete MFA challenge."""

    mfa_token: str
    code: str = Field(min_length=6, max_length=8)


class TokenResponseWithMFA(BaseModel):
    """Token response when MFA is required."""

    mfa_required: bool = False
    mfa_token: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


# --- Session Schemas ---


class SessionResponse(BaseModel):
    """Active session information."""

    id: uuid.UUID
    device_name: str | None
    ip_address: str | None
    is_active: bool
    created_at: datetime
    last_seen_at: datetime | None

    model_config = {"from_attributes": True}


# --- API Key Schemas ---


class APIKeyCreate(BaseModel):
    """Request to create an API key."""

    name: str = Field(min_length=1, max_length=255)
    scopes: list[str] = Field(default_factory=list)
    expires_days: int | None = Field(None, ge=1, le=365)


class APIKeyResponse(BaseModel):
    """API key response (without full key)."""

    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- RBAC Schemas ---


class RoleResponse(BaseModel):
    """Role information."""

    id: uuid.UUID
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class PermissionResponse(BaseModel):
    """Permission information."""

    id: uuid.UUID
    name: str
    resource: str
    action: str

    model_config = {"from_attributes": True}


# --- Extended User Schemas ---


class UserResponseWithRoles(UserResponse):
    """User response with roles and permissions."""

    roles: list[str] = []
    permissions: list[str] = []
    mfa_enabled: bool = False
    email_verified: bool = False
