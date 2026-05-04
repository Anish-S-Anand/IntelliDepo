"""
Intelli Platform — User Model
Feature: AUTH-6.1, DATA-5.1, AUTH-6.2
"""
from __future__ import annotations

from datetime import datetime

import uuid

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    password_reset_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Account lockout (enterprise auth)
    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    # MFA (enterprise auth)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    mfa_backup_codes: Mapped[list | None] = mapped_column(JSON, nullable=True, default=None)
    # Email verification
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    email_verify_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    # Multi-tenant: NULL = platform-level user, UUID = tenant-scoped
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), index=True, nullable=True, default=None
    )
    tenant_key: Mapped[str | None] = mapped_column(
        String(100), index=True, nullable=True, default=None
    )
    account_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="platform_user"
    )

    # RBAC (AUTH-6.2)
    roles: Mapped[list["Role"]] = relationship(
        secondary="user_roles", back_populates="users", lazy="selectin"
    )

    def has_permission(self, permission_code: str) -> bool:
        """Check if user has a specific permission through any of their roles."""
        if self.is_superuser:
            return True
        return any(
            perm.code == permission_code
            for role in self.roles
            for perm in role.permissions
        )

    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role."""
        if self.is_superuser:
            return True
        return any(role.name == role_name for role in self.roles)

    def get_permissions(self) -> set[str]:
        """Get all permission codes for this user across all roles."""
        if self.is_superuser:
            return {"*"}
        return {
            perm.code
            for role in self.roles
            for perm in role.permissions
        }


# Import here to avoid circular imports — Role is needed for the relationship
from app.shared.models.rbac import Role  # noqa: E402, F401
