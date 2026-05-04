"""
Intelli Platform — Session Management Models
Feature: AUTH-6.2
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database import BaseModel


class Session(BaseModel):
    """Active sessions — tracks JTI, device info, and last activity."""
    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime] = mapped_column(
        __import__("sqlalchemy").DateTime(timezone=True), nullable=False
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        __import__("sqlalchemy").DateTime(timezone=True), nullable=True
    )
