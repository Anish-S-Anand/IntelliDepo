"""
Intelli Platform — LLM Orchestration Data Models
Feature: AI-7.1

Pydantic models for LLM requests, responses, provider config, and usage tracking.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"


class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    role: MessageRole
    content: str


class LLMRequest(BaseModel):
    """Unified request format sent to the orchestration engine."""
    messages: list[Message]
    model: str | None = None
    provider: LLMProvider | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=128000)
    stream: bool = False
    tools: list[dict] | None = None  # OpenAI/Anthropic tool specs
    metadata: dict | None = None


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class LLMResponse(BaseModel):
    """Unified response format returned by all providers."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    model: str
    provider: LLMProvider
    usage: TokenUsage = Field(default_factory=TokenUsage)
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)
    confidence_method: str = "default"  # "logprobs" | "self_assessment" | "default"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ModelConfig(BaseModel):
    """Configuration for a registered model."""
    model_id: str
    provider: LLMProvider
    display_name: str
    max_context: int = 128000
    input_cost_per_1k: float = 0.0
    output_cost_per_1k: float = 0.0
    is_default: bool = False
    is_enabled: bool = True
    priority: int = 0  # lower = higher priority for fallback


class ProviderHealth(BaseModel):
    provider: LLMProvider
    is_healthy: bool = True
    last_error: str | None = None
    last_checked: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    consecutive_failures: int = 0
