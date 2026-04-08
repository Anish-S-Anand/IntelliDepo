"""
Intelli Platform — AI Orchestration API Router
Feature: AI-7.1

Endpoints for LLM generation, model listing, health checks, and usage stats.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.core.ai_orchestration.llm_engine import get_llm_engine, LLMEngine
from app.core.ai_orchestration.models import LLMRequest, LLMResponse

router = APIRouter(prefix="/api/v1/ai", tags=["AI Orchestration"])


def get_engine() -> LLMEngine:
    return get_llm_engine()


@router.post("/generate", response_model=LLMResponse)
async def generate(
    request: LLMRequest,
    current_user: User = Depends(get_current_user),
    engine: LLMEngine = Depends(get_engine),
):
    """Send a prompt to the LLM engine and get a response."""
    try:
        response = await engine.generate(request)
        return response
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/models")
async def list_models(
    current_user: User = Depends(get_current_user),
    engine: LLMEngine = Depends(get_engine),
):
    """List all registered LLM models and their configuration."""
    return {"models": [m.model_dump() for m in engine.list_models()]}


@router.get("/providers")
async def list_providers(
    current_user: User = Depends(get_current_user),
    engine: LLMEngine = Depends(get_engine),
):
    """List all registered LLM providers."""
    return {"providers": [p.value for p in engine.list_providers()]}


@router.get("/health")
async def provider_health(
    engine: LLMEngine = Depends(get_engine),
):
    """Check health of all LLM providers."""
    health = await engine.check_health()
    return {
        name.value: {
            "is_healthy": status.is_healthy,
            "last_error": status.last_error,
            "consecutive_failures": status.consecutive_failures,
        }
        for name, status in health.items()
    }


@router.get("/usage")
async def usage_summary(
    current_user: User = Depends(get_current_user),
    engine: LLMEngine = Depends(get_engine),
):
    """Get aggregated token usage and cost summary."""
    return engine.get_usage_summary()
