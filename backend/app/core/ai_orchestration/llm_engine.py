"""
Intelli Platform — LLM Orchestration Engine
Feature: AI-7.1

Central engine that routes LLM requests to the right provider, handles
fallback on failure, tracks costs, and manages provider health.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.config import settings
from app.core.ai_orchestration.cost_tracker import CostTracker
from app.core.ai_orchestration.models import (
    LLMProvider,
    LLMRequest,
    LLMResponse,
    ModelConfig,
    ProviderHealth,
)
from app.core.ai_orchestration.providers import (
    AnthropicProvider,
    BaseLLMProvider,
    LocalProvider,
    OpenAIProvider,
)

logger = logging.getLogger(__name__)

# Maximum consecutive failures before a provider is marked unhealthy
MAX_CONSECUTIVE_FAILURES = 3


class LLMEngine:
    """
    Orchestration engine for multi-provider LLM routing.

    Features:
    - Multi-model routing (OpenAI, Anthropic, local)
    - Automatic fallback on provider failure
    - Token usage & cost tracking
    - Provider health monitoring
    """

    def __init__(self):
        self._providers: dict[LLMProvider, BaseLLMProvider] = {}
        self._model_registry: dict[str, ModelConfig] = {}
        self._health: dict[LLMProvider, ProviderHealth] = {}
        self._fallback_order: list[LLMProvider] = []
        self._default_provider: LLMProvider | None = None
        self._default_model: str | None = None
        self.cost_tracker = CostTracker()

    # ── Setup ──────────────────────────────────────────────

    def register_provider(self, provider: BaseLLMProvider) -> None:
        """Register an LLM provider adapter."""
        self._providers[provider.provider] = provider
        self._health[provider.provider] = ProviderHealth(provider=provider.provider)
        logger.info("Registered LLM provider: %s", provider.provider.value)

    def register_model(self, config: ModelConfig) -> None:
        """Register a model with its pricing and config."""
        self._model_registry[config.model_id] = config
        self.cost_tracker._model_registry[config.model_id] = config
        if config.is_default:
            self._default_provider = config.provider
            self._default_model = config.model_id

    def set_fallback_order(self, order: list[LLMProvider]) -> None:
        """Set the provider fallback order for automatic retries."""
        self._fallback_order = order

    # ── Core ───────────────────────────────────────────────

    async def generate(self, request: LLMRequest) -> LLMResponse:
        """
        Route an LLM request to the appropriate provider.

        Resolution order:
        1. Explicit provider + model in request
        2. Infer provider from model name in registry
        3. Default provider/model
        4. Fallback chain on failure
        """
        provider_type, model = self._resolve_provider_and_model(request)

        # Build the attempt order: primary provider first, then fallbacks
        attempt_order = [provider_type] + [
            p for p in self._fallback_order if p != provider_type
        ]

        last_error: Exception | None = None

        for attempt_provider in attempt_order:
            if attempt_provider not in self._providers:
                continue

            health = self._health.get(attempt_provider)
            if health and not health.is_healthy:
                logger.warning(
                    "Skipping unhealthy provider %s (%d consecutive failures)",
                    attempt_provider.value,
                    health.consecutive_failures,
                )
                continue

            try:
                # Override model if falling back to a different provider
                attempt_request = request.model_copy()
                if attempt_provider != provider_type:
                    attempt_request.model = self._get_default_model_for_provider(
                        attempt_provider
                    )
                else:
                    attempt_request.model = model

                adapter = self._providers[attempt_provider]
                response = await adapter.generate(attempt_request)

                # Record success
                self._mark_healthy(attempt_provider)
                self.cost_tracker.record(response)

                if attempt_provider != provider_type:
                    logger.info(
                        "Fallback succeeded: %s → %s",
                        provider_type.value,
                        attempt_provider.value,
                    )

                return response

            except Exception as e:
                last_error = e
                self._mark_failure(attempt_provider, str(e))
                logger.error(
                    "Provider %s failed: %s", attempt_provider.value, e
                )

        raise RuntimeError(
            f"All LLM providers failed. Last error: {last_error}"
        )

    # ── Health ─────────────────────────────────────────────

    async def check_health(self) -> dict[str, ProviderHealth]:
        """Run health checks on all registered providers."""
        for provider_type, adapter in self._providers.items():
            try:
                healthy = await adapter.health_check()
                if healthy:
                    self._mark_healthy(provider_type)
                else:
                    self._mark_failure(provider_type, "Health check returned False")
            except Exception as e:
                self._mark_failure(provider_type, str(e))
        return dict(self._health)

    def get_health(self) -> dict[str, ProviderHealth]:
        """Return current health status without running checks."""
        return dict(self._health)

    # ── Info ───────────────────────────────────────────────

    def list_models(self) -> list[ModelConfig]:
        """Return all registered models."""
        return list(self._model_registry.values())

    def list_providers(self) -> list[LLMProvider]:
        """Return all registered providers."""
        return list(self._providers.keys())

    def get_usage_summary(self) -> dict:
        """Return aggregated cost/usage summary."""
        return self.cost_tracker.get_summary()

    # ── Private ────────────────────────────────────────────

    def _resolve_provider_and_model(
        self, request: LLMRequest
    ) -> tuple[LLMProvider, str]:
        """Determine which provider and model to use for a request."""
        # 1. Explicit provider and model
        if request.provider and request.model:
            return request.provider, request.model

        # 2. Explicit model → look up provider in registry
        if request.model and request.model in self._model_registry:
            cfg = self._model_registry[request.model]
            return cfg.provider, request.model

        # 3. Explicit provider, no model → use default model for that provider
        if request.provider:
            return request.provider, self._get_default_model_for_provider(
                request.provider
            )

        # 4. No provider, no model → use defaults
        if self._default_provider and self._default_model:
            return self._default_provider, self._default_model

        # 5. Last resort — first registered provider
        if self._providers:
            first = next(iter(self._providers))
            return first, self._get_default_model_for_provider(first)

        raise RuntimeError("No LLM providers are registered")

    def _get_default_model_for_provider(self, provider: LLMProvider) -> str:
        """Get the default/highest-priority model for a provider."""
        models = [
            cfg
            for cfg in self._model_registry.values()
            if cfg.provider == provider and cfg.is_enabled
        ]
        if models:
            models.sort(key=lambda m: m.priority)
            return models[0].model_id

        # Hardcoded fallback defaults
        defaults = {
            LLMProvider.OPENAI: "gpt-4o",
            LLMProvider.ANTHROPIC: "claude-sonnet-4-20250514",
            LLMProvider.LOCAL: "llama3",
        }
        return defaults.get(provider, "gpt-4o")

    def _mark_healthy(self, provider: LLMProvider) -> None:
        health = self._health.get(provider)
        if health:
            health.is_healthy = True
            health.consecutive_failures = 0
            health.last_error = None
            health.last_checked = datetime.now(timezone.utc)

    def _mark_failure(self, provider: LLMProvider, error: str) -> None:
        health = self._health.get(provider)
        if health:
            health.consecutive_failures += 1
            health.last_error = error
            health.last_checked = datetime.now(timezone.utc)
            if health.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                health.is_healthy = False
                logger.warning(
                    "Provider %s marked unhealthy after %d failures",
                    provider.value,
                    health.consecutive_failures,
                )


# ── Singleton Factory ──────────────────────────────────────

_engine_instance: LLMEngine | None = None


def get_llm_engine() -> LLMEngine:
    """Get or create the singleton LLM engine with default providers."""
    global _engine_instance
    if _engine_instance is not None:
        return _engine_instance

    engine = LLMEngine()

    # Register providers based on available API keys
    if settings.OPENAI_API_KEY:
        engine.register_provider(OpenAIProvider(api_key=settings.OPENAI_API_KEY))
        engine.register_model(ModelConfig(
            model_id="gpt-4o",
            provider=LLMProvider.OPENAI,
            display_name="GPT-4o",
            max_context=128000,
            input_cost_per_1k=0.0025,
            output_cost_per_1k=0.01,
            is_default=True,
            priority=0,
        ))
        engine.register_model(ModelConfig(
            model_id="gpt-4o-mini",
            provider=LLMProvider.OPENAI,
            display_name="GPT-4o Mini",
            max_context=128000,
            input_cost_per_1k=0.00015,
            output_cost_per_1k=0.0006,
            priority=1,
        ))

    if settings.ANTHROPIC_API_KEY:
        engine.register_provider(AnthropicProvider(api_key=settings.ANTHROPIC_API_KEY))
        engine.register_model(ModelConfig(
            model_id="claude-sonnet-4-20250514",
            provider=LLMProvider.ANTHROPIC,
            display_name="Claude Sonnet 4",
            max_context=200000,
            input_cost_per_1k=0.003,
            output_cost_per_1k=0.015,
            is_default=not settings.OPENAI_API_KEY,
            priority=0,
        ))
        engine.register_model(ModelConfig(
            model_id="claude-haiku-4-5-20241022",
            provider=LLMProvider.ANTHROPIC,
            display_name="Claude Haiku 4.5",
            max_context=200000,
            input_cost_per_1k=0.0008,
            output_cost_per_1k=0.004,
            priority=1,
        ))

    # Set fallback order
    fallback = []
    if settings.OPENAI_API_KEY:
        fallback.append(LLMProvider.OPENAI)
    if settings.ANTHROPIC_API_KEY:
        fallback.append(LLMProvider.ANTHROPIC)
    fallback.append(LLMProvider.LOCAL)
    engine.set_fallback_order(fallback)

    _engine_instance = engine
    return engine
