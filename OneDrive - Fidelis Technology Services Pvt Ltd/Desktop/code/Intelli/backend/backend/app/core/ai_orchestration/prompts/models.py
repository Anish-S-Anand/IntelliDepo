"""
Intelli Platform — Prompt Management ORM Models
Feature: AI-7.4

SQLAlchemy models for prompt templates, versions, and A/B test experiments.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel


class PromptTemplate(BaseModel):
    """A named prompt template that can have multiple versions."""

    __tablename__ = "prompt_templates"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    tags: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Active version pointer
    active_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    versions: Mapped[list[PromptVersion]] = relationship(
        "PromptVersion", back_populates="template", cascade="all, delete-orphan",
        order_by="PromptVersion.version_number.desc()",
    )
    experiments: Mapped[list[PromptExperiment]] = relationship(
        "PromptExperiment", back_populates="template", cascade="all, delete-orphan",
    )


class PromptVersion(BaseModel):
    """An immutable version of a prompt template's content."""

    __tablename__ = "prompt_versions"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=list)
    model_params: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
    )
    change_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    template: Mapped[PromptTemplate] = relationship("PromptTemplate", back_populates="versions")


class PromptExperiment(BaseModel):
    """A/B test experiment between two prompt versions."""

    __tablename__ = "prompt_experiments"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Two competing versions
    variant_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_versions.id"), nullable=False,
    )
    variant_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_versions.id"), nullable=False,
    )

    # Traffic split: 0.0–1.0, fraction routed to variant A (rest goes to B)
    traffic_split: Mapped[float] = mapped_column(Float, default=0.5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Metrics
    variant_a_impressions: Mapped[int] = mapped_column(Integer, default=0)
    variant_b_impressions: Mapped[int] = mapped_column(Integer, default=0)
    variant_a_score: Mapped[float] = mapped_column(Float, default=0.0)
    variant_b_score: Mapped[float] = mapped_column(Float, default=0.0)

    winner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    concluded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    template: Mapped[PromptTemplate] = relationship("PromptTemplate", back_populates="experiments")
    variant_a: Mapped[PromptVersion] = relationship("PromptVersion", foreign_keys=[variant_a_id])
    variant_b: Mapped[PromptVersion] = relationship("PromptVersion", foreign_keys=[variant_b_id])
