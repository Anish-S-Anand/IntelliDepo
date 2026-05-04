"""
Intelli Platform — Sentiment Analysis API Router
Feature: ANLY-6.22 [ORANGE — MVP Scope]

Endpoints for single and batch sentiment analysis.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.core.analytics.sentiment import (
    BatchSentimentResult,
    SentimentResult,
    analyze_sentiment,
    analyze_sentiment_batch,
)

router = APIRouter(prefix="/api/v1/analytics/sentiment", tags=["Sentiment Analysis"])


class SentimentRequest(BaseModel):
    text: str
    use_llm: bool = False


class BatchSentimentRequest(BaseModel):
    texts: list[str]
    use_llm: bool = False


@router.post("/analyze", response_model=SentimentResult)
async def api_analyze_sentiment(
    request: SentimentRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze sentiment of a single text (positive/negative/neutral)."""
    return await analyze_sentiment(request.text, use_llm=request.use_llm)


@router.post("/batch", response_model=BatchSentimentResult)
async def api_batch_sentiment(
    request: BatchSentimentRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze sentiment of multiple texts with summary counts."""
    return await analyze_sentiment_batch(request.texts, use_llm=request.use_llm)
