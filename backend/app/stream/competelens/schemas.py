"""
Intelli Platform — Earnings Transcript API Schemas
Feature: STR-API-3
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TranscriptUploadRequest(BaseModel):
    company_name: str
    ticker: str
    fiscal_quarter: str = Field(..., description="e.g. 'Q4 2025'")
    fiscal_year: int
    transcript_text: str


class TranscriptResponse(BaseModel):
    id: str
    company_name: str
    ticker: str
    fiscal_quarter: str
    fiscal_year: int
    key_themes: list[dict] | None
    sentiment_timeline: list[dict] | None
    overall_sentiment: float
    summary: str | None
    key_metrics_mentioned: list[dict] | None
    management_tone: str | None
    risk_flags: list[dict] | None
    is_ingested: bool

    model_config = {"from_attributes": True}


class TranscriptListItem(BaseModel):
    id: str
    company_name: str
    ticker: str
    fiscal_quarter: str
    fiscal_year: int
    overall_sentiment: float
    management_tone: str | None
    is_ingested: bool

    model_config = {"from_attributes": True}


class TranscriptQueryRequest(BaseModel):
    ticker: str
    question: str


class TranscriptQueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    company: str | None = None
    quarter: str | None = None
    model: str | None = None


class CompetitiveComparisonResponse(BaseModel):
    """Side-by-side comparison of multiple transcripts."""
    companies: list[dict]
    metrics_comparison: list[dict]
    sentiment_comparison: list[dict]
