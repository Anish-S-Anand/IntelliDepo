"""
Tests for AI-7.1: LLM Orchestration Engine

Tests the engine's routing, fallback, cost tracking, and health management
using mock providers (no real API calls).
"""
import pytest

from app.core.ai_orchestration.cost_tracker import CostTracker
from app.core.ai_orchestration.models import (
    LLMProvider,
    LLMRequest,
    LLMResponse,
    Message,
    MessageRole,
    ModelConfig,
    TokenUsage,
)
from app.core.ai_orchestration.llm_engine import LLMEngine
from app.core.ai_orchestration.providers import BaseLLMProvider


# ── Mock Providers ─────────────────────────────────────────


class MockProvider(BaseLLMProvider):
    """A mock provider that returns canned responses."""

    def __init__(self, provider: LLMProvider, should_fail: bool = False):
        self.provider = provider
        self.should_fail = should_fail
        self.call_count = 0

    async def generate(self, request: LLMRequest) -> LLMResponse:
        self.call_count += 1
        if self.should_fail:
            raise RuntimeError(f"{self.provider.value} is down")
        return LLMResponse(
            content=f"Response from {self.provider.value}",
            model=request.model or "mock-model",
            provider=self.provider,
            usage=TokenUsage(prompt_tokens=10, completion_tokens=20, total_tokens=30),
            latency_ms=50.0,
        )

    async def health_check(self) -> bool:
        return not self.should_fail


# ── Engine Tests ───────────────────────────────────────────


@pytest.fixture
def engine():
    return LLMEngine()


@pytest.fixture
def simple_request():
    return LLMRequest(
        messages=[Message(role=MessageRole.USER, content="Hello")],
    )


@pytest.mark.asyncio
async def test_generate_with_single_provider(engine, simple_request):
    mock = MockProvider(LLMProvider.OPENAI)
    engine.register_provider(mock)

    response = await engine.generate(simple_request)

    assert response.content == "Response from openai"
    assert response.provider == LLMProvider.OPENAI
    assert mock.call_count == 1


@pytest.mark.asyncio
async def test_generate_with_explicit_provider(engine, simple_request):
    mock_openai = MockProvider(LLMProvider.OPENAI)
    mock_anthropic = MockProvider(LLMProvider.ANTHROPIC)
    engine.register_provider(mock_openai)
    engine.register_provider(mock_anthropic)

    simple_request.provider = LLMProvider.ANTHROPIC
    response = await engine.generate(simple_request)

    assert response.provider == LLMProvider.ANTHROPIC
    assert mock_anthropic.call_count == 1
    assert mock_openai.call_count == 0


@pytest.mark.asyncio
async def test_fallback_on_failure(engine, simple_request):
    failing = MockProvider(LLMProvider.OPENAI, should_fail=True)
    backup = MockProvider(LLMProvider.ANTHROPIC)

    engine.register_provider(failing)
    engine.register_provider(backup)
    engine.set_fallback_order([LLMProvider.OPENAI, LLMProvider.ANTHROPIC])

    response = await engine.generate(simple_request)

    assert response.provider == LLMProvider.ANTHROPIC
    assert failing.call_count == 1
    assert backup.call_count == 1


@pytest.mark.asyncio
async def test_all_providers_fail(engine, simple_request):
    engine.register_provider(MockProvider(LLMProvider.OPENAI, should_fail=True))
    engine.register_provider(MockProvider(LLMProvider.ANTHROPIC, should_fail=True))
    engine.set_fallback_order([LLMProvider.OPENAI, LLMProvider.ANTHROPIC])

    with pytest.raises(RuntimeError, match="All LLM providers failed"):
        await engine.generate(simple_request)


@pytest.mark.asyncio
async def test_unhealthy_provider_skipped(engine, simple_request):
    failing = MockProvider(LLMProvider.OPENAI, should_fail=True)
    backup = MockProvider(LLMProvider.ANTHROPIC)

    engine.register_provider(failing)
    engine.register_provider(backup)
    engine.set_fallback_order([LLMProvider.OPENAI, LLMProvider.ANTHROPIC])

    # Force 3 failures to mark provider unhealthy
    for _ in range(3):
        try:
            simple_request.provider = LLMProvider.OPENAI
            await engine.generate(simple_request)
        except RuntimeError:
            pass

    health = engine.get_health()
    assert health[LLMProvider.OPENAI].is_healthy is False

    # Now request without explicit provider — should skip unhealthy openai
    simple_request.provider = None
    response = await engine.generate(simple_request)
    assert response.provider == LLMProvider.ANTHROPIC


@pytest.mark.asyncio
async def test_cost_tracking(engine, simple_request):
    mock = MockProvider(LLMProvider.OPENAI)
    engine.register_provider(mock)
    engine.register_model(ModelConfig(
        model_id="mock-model",
        provider=LLMProvider.OPENAI,
        display_name="Mock",
        input_cost_per_1k=0.01,
        output_cost_per_1k=0.03,
        is_default=True,
    ))

    await engine.generate(simple_request)
    summary = engine.get_usage_summary()

    assert summary["total_requests"] == 1
    assert summary["total_tokens"] == 30
    assert summary["total_cost_usd"] > 0


@pytest.mark.asyncio
async def test_health_check(engine):
    healthy = MockProvider(LLMProvider.OPENAI)
    unhealthy = MockProvider(LLMProvider.ANTHROPIC, should_fail=True)

    engine.register_provider(healthy)
    engine.register_provider(unhealthy)

    health = await engine.check_health()

    assert health[LLMProvider.OPENAI].is_healthy is True
    # Single failure doesn't mark unhealthy (needs MAX_CONSECUTIVE_FAILURES=3)
    assert health[LLMProvider.ANTHROPIC].consecutive_failures == 1
    assert health[LLMProvider.ANTHROPIC].last_error is not None

    # Fail two more times to trigger unhealthy
    await engine.check_health()
    health = await engine.check_health()
    assert health[LLMProvider.ANTHROPIC].is_healthy is False


@pytest.mark.asyncio
async def test_model_registry(engine):
    engine.register_model(ModelConfig(
        model_id="gpt-4o",
        provider=LLMProvider.OPENAI,
        display_name="GPT-4o",
        is_default=True,
    ))
    engine.register_model(ModelConfig(
        model_id="claude-sonnet-4-20250514",
        provider=LLMProvider.ANTHROPIC,
        display_name="Claude Sonnet 4",
    ))

    models = engine.list_models()
    assert len(models) == 2
    assert any(m.model_id == "gpt-4o" for m in models)


# ── Cost Tracker Tests ─────────────────────────────────────


def test_cost_calculation():
    tracker = CostTracker()
    response = LLMResponse(
        content="test",
        model="gpt-4o",
        provider=LLMProvider.OPENAI,
        usage=TokenUsage(prompt_tokens=1000, completion_tokens=500, total_tokens=1500),
    )

    cost = tracker.calculate_cost(response)
    # gpt-4o: 1000/1000 * 0.0025 + 500/1000 * 0.01 = 0.0025 + 0.005 = 0.0075
    assert cost == pytest.approx(0.0075, abs=0.0001)


def test_cost_tracker_summary():
    tracker = CostTracker()
    for i in range(3):
        response = LLMResponse(
            content="test",
            model="gpt-4o",
            provider=LLMProvider.OPENAI,
            usage=TokenUsage(prompt_tokens=100, completion_tokens=100, total_tokens=200),
        )
        tracker.record(response)

    summary = tracker.get_summary()
    assert summary["total_requests"] == 3
    assert summary["total_tokens"] == 600
    assert summary["total_cost_usd"] > 0


def test_no_provider_registered(engine, simple_request):
    """Engine should raise if no providers are registered."""
    with pytest.raises(RuntimeError, match="No LLM providers are registered"):
        import asyncio
        asyncio.get_event_loop().run_until_complete(engine.generate(simple_request))
