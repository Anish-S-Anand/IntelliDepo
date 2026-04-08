"""
Intelli Platform — Explainability Engine API Router
Feature: AI-7.5

Endpoints for generating explanations, querying audit trails,
flagging decisions, and viewing XAI statistics.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.core.ai_orchestration.explainability import (
    ExplainabilityEngine,
    get_explainability_engine,
)
from app.core.ai_orchestration.explainability_models import (
    ExplanationRequest,
    ExplanationResult,
    ExplanationType,
    SourceCitation,
)

router = APIRouter(prefix="/api/v1/xai", tags=["Explainability Engine"])


def get_engine() -> ExplainabilityEngine:
    return get_explainability_engine()


# ── Request Schemas ────────────────────────────────────────


class ExplainRequest(BaseModel):
    """API request to explain an AI response."""
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


class FlagDecisionRequest(BaseModel):
    """API request to flag an audited decision."""
    audit_entry_id: str
    reason: str


# ── Endpoints ──────────────────────────────────────────────


@router.post("/explain", response_model=ExplanationResult)
async def explain_response(
    req: ExplainRequest,
    current_user: User = Depends(get_current_user),
    engine: ExplainabilityEngine = Depends(get_engine),
):
    """
    Generate an explanation for an AI-generated response.

    Produces reasoning traces, confidence scores, source citations,
    decision factors, and bias checks.
    """
    explanation_request = ExplanationRequest(
        response_id=req.response_id,
        response_content=req.response_content,
        prompt=req.prompt,
        model=req.model,
        sources=req.sources,
        explanation_types=req.explanation_types,
    )

    try:
        result = await engine.explain(explanation_request)

        # Auto-log to audit trail
        engine.log_decision(
            user_id=str(current_user.id),
            response_id=req.response_id,
            explanation=result,
            prompt_summary=req.prompt[:200],
            response_summary=req.response_content[:200],
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {e}")


@router.get("/explain/{response_id}")
async def get_explanation(
    response_id: str,
    current_user: User = Depends(get_current_user),
    engine: ExplainabilityEngine = Depends(get_engine),
):
    """Retrieve a cached explanation by response ID."""
    result = engine.get_cached_explanation(response_id)
    if not result:
        raise HTTPException(
            status_code=404, detail=f"No explanation found for response '{response_id}'"
        )
    return result


@router.post("/audit/flag")
async def flag_decision(
    req: FlagDecisionRequest,
    current_user: User = Depends(get_current_user),
    engine: ExplainabilityEngine = Depends(get_engine),
):
    """Flag an AI decision for human review."""
    entry = engine.flag_decision(req.audit_entry_id, req.reason)
    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"Audit entry '{req.audit_entry_id}' not found",
        )
    return entry.model_dump()


@router.get("/audit")
async def get_audit_log(
    flagged_only: bool = False,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    engine: ExplainabilityEngine = Depends(get_engine),
):
    """Query the decision audit trail."""
    entries = engine.get_audit_log(
        user_id=str(current_user.id),
        flagged_only=flagged_only,
        limit=limit,
    )
    return {"entries": [e.model_dump() for e in entries]}


@router.get("/audit/stats")
async def audit_stats(
    current_user: User = Depends(get_current_user),
    engine: ExplainabilityEngine = Depends(get_engine),
):
    """Get summary statistics of the audit log."""
    return engine.get_audit_stats()


@router.delete("/cache")
async def clear_cache(
    current_user: User = Depends(get_current_user),
    engine: ExplainabilityEngine = Depends(get_engine),
):
    """Clear the explanation cache."""
    count = engine.clear_cache()
    return {"cleared": count}
