"""
Intelli Platform — LLM Cost Tracker
Feature: AI-7.1

Tracks token usage and cost per request. Calculates costs based on
the model registry pricing and aggregates usage over time.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone

from app.core.ai_orchestration.models import LLMProvider, LLMResponse, ModelConfig

logger = logging.getLogger(__name__)


# Default pricing per 1K tokens (USD) — updated as of 2025
DEFAULT_PRICING: dict[str, tuple[float, float]] = {
    # OpenAI  (input, output)
    "gpt-4o": (0.0025, 0.01),
    "gpt-4o-mini": (0.00015, 0.0006),
    "gpt-4-turbo": (0.01, 0.03),
    # Anthropic
    "claude-opus-4-20250514": (0.015, 0.075),
    "claude-sonnet-4-20250514": (0.003, 0.015),
    "claude-haiku-4-5-20241022": (0.0008, 0.004),
    # Local (free)
    "llama3": (0.0, 0.0),
}


class CostTracker:
    """In-memory cost tracker. Attach to the engine to record every LLM call."""

    def __init__(self, model_registry: dict[str, ModelConfig] | None = None):
        self._model_registry = model_registry or {}
        self._usage_log: list[dict] = []
        self._totals: dict[str, dict[str, float]] = defaultdict(
            lambda: {"total_tokens": 0, "total_cost": 0.0, "request_count": 0}
        )

    def calculate_cost(self, response: LLMResponse) -> float:
        """Calculate the USD cost for a single LLM response."""
        model = response.model

        # Check model registry first, then fall back to defaults
        if model in self._model_registry:
            cfg = self._model_registry[model]
            input_rate = cfg.input_cost_per_1k
            output_rate = cfg.output_cost_per_1k
        elif model in DEFAULT_PRICING:
            input_rate, output_rate = DEFAULT_PRICING[model]
        else:
            # Unknown model — try to find a partial match
            for key, rates in DEFAULT_PRICING.items():
                if key in model or model in key:
                    input_rate, output_rate = rates
                    break
            else:
                logger.warning("No pricing found for model %s, cost set to 0", model)
                return 0.0

        cost = (
            (response.usage.prompt_tokens / 1000) * input_rate
            + (response.usage.completion_tokens / 1000) * output_rate
        )
        return round(cost, 6)

    def record(self, response: LLMResponse) -> float:
        """Record a response and return its cost."""
        cost = self.calculate_cost(response)
        response.cost_usd = cost

        entry = {
            "id": response.id,
            "model": response.model,
            "provider": response.provider.value,
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
            "cost_usd": cost,
            "latency_ms": response.latency_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._usage_log.append(entry)

        key = f"{response.provider.value}/{response.model}"
        self._totals[key]["total_tokens"] += response.usage.total_tokens
        self._totals[key]["total_cost"] += cost
        self._totals[key]["request_count"] += 1

        return cost

    def get_summary(self) -> dict:
        """Return aggregated usage summary across all models."""
        total_cost = sum(t["total_cost"] for t in self._totals.values())
        total_tokens = sum(t["total_tokens"] for t in self._totals.values())
        total_requests = sum(t["request_count"] for t in self._totals.values())

        return {
            "total_cost_usd": round(total_cost, 6),
            "total_tokens": int(total_tokens),
            "total_requests": int(total_requests),
            "by_model": dict(self._totals),
        }

    def get_recent(self, limit: int = 50) -> list[dict]:
        """Return the most recent usage entries."""
        return self._usage_log[-limit:]
