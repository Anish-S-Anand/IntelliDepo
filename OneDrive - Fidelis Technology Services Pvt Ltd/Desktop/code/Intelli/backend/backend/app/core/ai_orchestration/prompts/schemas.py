"""
Intelli Platform — Prompt Management Pydantic Schemas
Feature: AI-7.4

Request/response schemas for the prompt management API.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Prompt Template ──────────────────────────────────────

class PromptTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    system_prompt: str | None = None
    user_prompt: str
    variables: list[str] = Field(default_factory=list)
    model_params: dict | None = None
    change_note: str | None = "Initial version"


class PromptTemplateUpdate(BaseModel):
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_active: bool | None = None


class PromptVersionCreate(BaseModel):
    system_prompt: str | None = None
    user_prompt: str
    variables: list[str] = Field(default_factory=list)
    model_params: dict | None = None
    change_note: str | None = None


class PromptRenderRequest(BaseModel):
    variables: dict[str, str] = Field(default_factory=dict)
    version_id: uuid.UUID | None = None


# ── Experiments ──────────────────────────────────────────

class ExperimentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    variant_a_id: uuid.UUID
    variant_b_id: uuid.UUID
    traffic_split: float = Field(default=0.5, ge=0.0, le=1.0)


class ExperimentScoreRequest(BaseModel):
    variant: str = Field(..., pattern="^[ab]$")
    score: float = Field(..., ge=0.0, le=1.0)


class ExperimentConclude(BaseModel):
    winner: str = Field(..., pattern="^[ab]$")
    promote: bool = Field(default=True, description="Set winner as active version on template")


# ── Response Schemas ─────────────────────────────────────

class PromptVersionOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    version_number: int
    system_prompt: str | None
    user_prompt: str
    variables: list[str] | None
    model_params: dict | None
    change_note: str | None
    created_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PromptTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str | None
    tags: list[str] | None
    is_active: bool
    active_version_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    versions: list[PromptVersionOut] = []

    model_config = {"from_attributes": True}


class PromptTemplateSummary(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str | None
    is_active: bool
    active_version_id: uuid.UUID | None
    version_count: int = 0

    model_config = {"from_attributes": True}


class PromptRenderOut(BaseModel):
    system_prompt: str | None
    user_prompt: str
    version_id: uuid.UUID
    version_number: int
    experiment_id: uuid.UUID | None = None
    variant: str | None = None


class ExperimentOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    name: str
    description: str | None
    variant_a_id: uuid.UUID
    variant_b_id: uuid.UUID
    traffic_split: float
    is_active: bool
    variant_a_impressions: int
    variant_b_impressions: int
    variant_a_score: float
    variant_b_score: float
    winner_id: uuid.UUID | None
    concluded_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
