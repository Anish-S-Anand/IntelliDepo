"""
Intelli Platform — Explainability Engine Data Models
Feature: AI-7.5

Pydantic models for AI decision explanations, confidence scoring,
reasoning traces, and audit trails.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class ConfidenceLevel(str, Enum):
    HIGH = "high"          # >= 0.8
    MEDIUM = "medium"      # 0.5 – 0.79
    LOW = "low"            # 0.3 – 0.49
    VERY_LOW = "very_low"  # < 0.3


class ExplanationType(str, Enum):
    REASONING_TRACE = "reasoning_trace"
    SOURCE_CITATION = "source_citation"
    CONFIDENCE_BREAKDOWN = "confidence_breakdown"
    DECISION_FACTORS = "decision_factors"
    BIAS_CHECK = "bias_check"


class SourceCitation(BaseModel):
    """A reference to a source that contributed to the AI's response."""
    source_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content_snippet: str
    source_type: str = "document"  # document, database, api, user_input
    relevance_score: float = Field(default=0.0, ge=0.0, le=1.0)
    url: str | None = None
    metadata: dict = Field(default_factory=dict)


class ReasoningStep(BaseModel):
    """A single step in the AI's reasoning chain."""
    step_number: int
    description: str
    evidence: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class DecisionFactor(BaseModel):
    """A factor that influenced the AI's decision."""
    factor_name: str
    weight: float = Field(default=0.0, ge=0.0, le=1.0)
    value: str
    impact: str = "neutral"  # positive, negative, neutral


class BiasCheckResult(BaseModel):
    """Result of a bias detection check on the AI's output."""
    check_name: str
    passed: bool = True
    details: str = ""
    severity: str = "none"  # none, low, medium, high


class ConfidenceScore(BaseModel):
    """Detailed confidence scoring for an AI response."""
    overall: float = Field(default=0.0, ge=0.0, le=1.0)
    level: ConfidenceLevel = ConfidenceLevel.LOW
    factors: dict[str, float] = Field(default_factory=dict)
    # e.g. {"source_quality": 0.9, "model_certainty": 0.7, "data_coverage": 0.6}


class ExplanationRequest(BaseModel):
    """Request to generate an explanation for an AI response."""
    response_id: str
    response_content: str
    prompt: str
    model: str | None = None
    sources: list[SourceCitation] = Field(default_factory=list)
    explanation_types: list[ExplanationType] = Field(
        default_factory=lambda: [
            ExplanationType.REASONING_TRACE,
            ExplanationType.CONFIDENCE_BREAKDOWN,
        ]
    )
    metadata: dict = Field(default_factory=dict)


class ExplanationResult(BaseModel):
    """Complete explanation for an AI-generated response."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    response_id: str
    confidence: ConfidenceScore
    reasoning_steps: list[ReasoningStep] = Field(default_factory=list)
    sources: list[SourceCitation] = Field(default_factory=list)
    decision_factors: list[DecisionFactor] = Field(default_factory=list)
    bias_checks: list[BiasCheckResult] = Field(default_factory=list)
    summary: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_used: str = ""
    latency_ms: float = 0.0


class ExplanationAuditEntry(BaseModel):
    """Audit trail entry for an AI decision with its explanation."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    response_id: str
    explanation_id: str
    prompt_summary: str
    response_summary: str
    confidence_score: float
    confidence_level: ConfidenceLevel
    model_used: str
    flagged: bool = False
    flag_reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
