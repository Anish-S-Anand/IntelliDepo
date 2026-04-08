"""
Intelli Platform — Earnings Transcript ORM Models
Feature: STR-API-3

Stores pre-processed / cached transcript analysis results.
"""
from __future__ import annotations

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import BaseModel


class EarningsTranscript(BaseModel):
    """A cached earnings call transcript with pre-processed NLP results."""

    __tablename__ = "stream_earnings_transcripts"

    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    fiscal_quarter: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g. "Q4 2025"
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    transcript_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Pre-processed NLP results (cached)
    key_themes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sentiment_timeline: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    overall_sentiment: Mapped[float] = mapped_column(Float, default=0.0)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_metrics_mentioned: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    management_tone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_flags: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # RAG ingestion status
    is_ingested: Mapped[bool] = mapped_column(default=False)
    collection_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
