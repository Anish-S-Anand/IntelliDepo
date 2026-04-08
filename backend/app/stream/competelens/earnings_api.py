"""
Intelli Platform — Earnings Transcript API Router
Feature: STR-API-3

Endpoints for uploading, analyzing, listing, and querying earnings transcripts.
Uses RAG (AI-7.3) for semantic Q&A and sentiment analysis (ANLY-6.22) for NLP.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_user
from app.database import get_db
from app.shared.models.user import User
from app.stream.competelens.earnings_service import (
    analyze_transcript,
    query_transcript,
    seed_sample_transcripts,
)
from app.stream.competelens.models import EarningsTranscript
from app.stream.competelens.schemas import (
    CompetitiveComparisonResponse,
    TranscriptListItem,
    TranscriptQueryRequest,
    TranscriptQueryResponse,
    TranscriptResponse,
    TranscriptUploadRequest,
)

router = APIRouter(prefix="/api/v1/stream/earnings", tags=["Stream — Earnings Transcripts"])


# ── List & Get ─────────────────────────────────────────────


@router.get("/transcripts", response_model=list[TranscriptListItem])
async def list_transcripts(
    ticker: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all analyzed transcripts, optionally filtered by ticker."""
    stmt = select(EarningsTranscript).order_by(
        EarningsTranscript.fiscal_year.desc(),
        EarningsTranscript.company_name,
    )
    if ticker:
        stmt = stmt.where(EarningsTranscript.ticker == ticker.upper())
    result = await db.execute(stmt)
    transcripts = result.scalars().all()
    return [
        TranscriptListItem(
            id=str(t.id),
            company_name=t.company_name,
            ticker=t.ticker,
            fiscal_quarter=t.fiscal_quarter,
            fiscal_year=t.fiscal_year,
            overall_sentiment=t.overall_sentiment,
            management_tone=t.management_tone,
            is_ingested=t.is_ingested,
        )
        for t in transcripts
    ]


@router.get("/transcripts/{transcript_id}", response_model=TranscriptResponse)
async def get_transcript(
    transcript_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full analysis results for a specific transcript."""
    stmt = select(EarningsTranscript).where(EarningsTranscript.id == transcript_id)
    result = await db.execute(stmt)
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transcript not found")
    return TranscriptResponse(
        id=str(transcript.id),
        company_name=transcript.company_name,
        ticker=transcript.ticker,
        fiscal_quarter=transcript.fiscal_quarter,
        fiscal_year=transcript.fiscal_year,
        key_themes=transcript.key_themes,
        sentiment_timeline=transcript.sentiment_timeline,
        overall_sentiment=transcript.overall_sentiment,
        summary=transcript.summary,
        key_metrics_mentioned=transcript.key_metrics_mentioned,
        management_tone=transcript.management_tone,
        risk_flags=transcript.risk_flags,
        is_ingested=transcript.is_ingested,
    )


# ── Upload & Analyze ──────────────────────────────────────


@router.post("/transcripts", response_model=TranscriptResponse, status_code=status.HTTP_201_CREATED)
async def upload_transcript(
    body: TranscriptUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and analyze a new earnings transcript."""
    transcript = await analyze_transcript(
        transcript_text=body.transcript_text,
        company_name=body.company_name,
        ticker=body.ticker.upper(),
        fiscal_quarter=body.fiscal_quarter,
        fiscal_year=body.fiscal_year,
        db=db,
        use_rag=True,
    )
    return TranscriptResponse(
        id=str(transcript.id),
        company_name=transcript.company_name,
        ticker=transcript.ticker,
        fiscal_quarter=transcript.fiscal_quarter,
        fiscal_year=transcript.fiscal_year,
        key_themes=transcript.key_themes,
        sentiment_timeline=transcript.sentiment_timeline,
        overall_sentiment=transcript.overall_sentiment,
        summary=transcript.summary,
        key_metrics_mentioned=transcript.key_metrics_mentioned,
        management_tone=transcript.management_tone,
        risk_flags=transcript.risk_flags,
        is_ingested=transcript.is_ingested,
    )


@router.post("/transcripts/upload-file", response_model=TranscriptResponse, status_code=status.HTTP_201_CREATED)
async def upload_transcript_file(
    company_name: str,
    ticker: str,
    fiscal_quarter: str,
    fiscal_year: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a transcript as a text file and analyze it."""
    content = await file.read()
    text = content.decode("utf-8")

    transcript = await analyze_transcript(
        transcript_text=text,
        company_name=company_name,
        ticker=ticker.upper(),
        fiscal_quarter=fiscal_quarter,
        fiscal_year=fiscal_year,
        db=db,
        use_rag=True,
    )
    return TranscriptResponse(
        id=str(transcript.id),
        company_name=transcript.company_name,
        ticker=transcript.ticker,
        fiscal_quarter=transcript.fiscal_quarter,
        fiscal_year=transcript.fiscal_year,
        key_themes=transcript.key_themes,
        sentiment_timeline=transcript.sentiment_timeline,
        overall_sentiment=transcript.overall_sentiment,
        summary=transcript.summary,
        key_metrics_mentioned=transcript.key_metrics_mentioned,
        management_tone=transcript.management_tone,
        risk_flags=transcript.risk_flags,
        is_ingested=transcript.is_ingested,
    )


# ── RAG Query ─────────────────────────────────────────────


@router.post("/query", response_model=TranscriptQueryResponse)
async def query_earnings(
    body: TranscriptQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a question about a company's earnings transcript using RAG."""
    result = await query_transcript(
        ticker=body.ticker.upper(),
        question=body.question,
        db=db,
    )
    return TranscriptQueryResponse(**result)


# ── Competitive Comparison ─────────────────────────────────


@router.get("/compare", response_model=CompetitiveComparisonResponse)
async def compare_transcripts(
    tickers: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare earnings analysis across multiple companies. Pass tickers comma-separated."""
    ticker_list = [t.strip().upper() for t in tickers.split(",")]

    stmt = select(EarningsTranscript).where(
        EarningsTranscript.ticker.in_(ticker_list)
    ).order_by(EarningsTranscript.fiscal_year.desc())
    result = await db.execute(stmt)
    transcripts = result.scalars().all()

    if not transcripts:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No transcripts found for given tickers")

    companies = []
    metrics_comparison = []
    sentiment_comparison = []

    for t in transcripts:
        companies.append({
            "company_name": t.company_name,
            "ticker": t.ticker,
            "quarter": t.fiscal_quarter,
            "overall_sentiment": t.overall_sentiment,
            "management_tone": t.management_tone,
            "risk_flag_count": len(t.risk_flags) if t.risk_flags else 0,
        })
        sentiment_comparison.append({
            "ticker": t.ticker,
            "sentiment": t.overall_sentiment,
            "tone": t.management_tone,
            "themes": [theme["theme"][:50] for theme in (t.key_themes or [])[:3]],
        })
        if t.key_metrics_mentioned:
            for metric in t.key_metrics_mentioned:
                metrics_comparison.append({
                    "ticker": t.ticker,
                    "metric": metric["metric"],
                    "value": metric["value"],
                    "unit": metric.get("unit", ""),
                })

    return CompetitiveComparisonResponse(
        companies=companies,
        metrics_comparison=metrics_comparison,
        sentiment_comparison=sentiment_comparison,
    )


# ── Seed ───────────────────────────────────────────────────


@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def seed_transcripts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Seed the database with pre-processed sample transcripts."""
    results = await seed_sample_transcripts(db)
    return {
        "seeded": len(results),
        "transcripts": [
            {"ticker": t.ticker, "quarter": t.fiscal_quarter, "tone": t.management_tone}
            for t in results
        ],
    }
