"""
Intelli Platform — OAuth Account Models
Feature: AUTH-6.2
"""
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import BaseModel


class OAuthAccount(BaseModel):
    """OAuth provider account linked to user."""
    __tablename__ = "auth_oauth_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # "google" | "microsoft"
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        __import__("sqlalchemy").DateTime(timezone=True), nullable=True
    )
    raw_profile: Mapped[dict] = mapped_column(JSON, default=dict)

    # Composite unique constraint: one provider account per user per provider
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)
