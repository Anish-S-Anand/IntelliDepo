"""
Intelli Platform — Stream Sample Data API Router
Feature: STR-API-1

REST endpoints serving sample financial data for Peer Benchmarking
and Revenue Concentration features.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.stream.data.schemas import (
    CompanyFinancialOut,
    PeerBenchmarkResponse,
    RevenueConcentrationResponse,
)
from app.stream.data.service import StreamDataService

router = APIRouter(prefix="/api/v1/stream/data", tags=["stream-data"])


def _service(db: AsyncSession = Depends(get_db)) -> StreamDataService:
    return StreamDataService(db)


# ── Seed ─────────────────────────────────────────────────

@router.post("/seed", status_code=200)
async def seed_sample_data(svc: StreamDataService = Depends(_service)):
    """Seed sample data if tables are empty. Safe to call multiple times."""
    counts = await svc.seed_if_empty()
    return {"status": "ok", "seeded": counts}


# ── Peer Benchmarking ────────────────────────────────────

@router.get("/companies", response_model=PeerBenchmarkResponse)
async def list_companies(
    sector: str | None = None,
    fiscal_year: int | None = None,
    tickers: str | None = Query(
        None, description="Comma-separated tickers, e.g. TNOV,FEDG,CSYN"
    ),
    svc: StreamDataService = Depends(_service),
):
    """Get company financials for peer benchmarking. Filter by sector, year, or tickers."""
    ticker_list = [t.strip().upper() for t in tickers.split(",")] if tickers else None
    return await svc.get_peer_benchmarks(
        sector=sector, fiscal_year=fiscal_year, tickers=ticker_list
    )


@router.get("/companies/{ticker}", response_model=CompanyFinancialOut)
async def get_company(
    ticker: str, svc: StreamDataService = Depends(_service)
):
    """Get a single company's financials by ticker."""
    company = await svc.get_company(ticker.upper())
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ── Revenue Concentration ────────────────────────────────

@router.get("/clients", response_model=RevenueConcentrationResponse)
async def list_clients(
    region: str | None = None,
    industry: str | None = None,
    risk_tier: str | None = None,
    svc: StreamDataService = Depends(_service),
):
    """Get client portfolio with revenue concentration metrics."""
    return await svc.get_revenue_concentration(
        region=region, industry=industry, risk_tier=risk_tier
    )
