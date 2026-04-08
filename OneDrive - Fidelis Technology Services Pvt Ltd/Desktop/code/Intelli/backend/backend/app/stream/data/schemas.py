"""
Intelli Platform — Stream Sample Data Pydantic Schemas
Feature: STR-API-1
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Company Financials ───────────────────────────────────

class CompanyFinancialOut(BaseModel):
    id: uuid.UUID
    company_name: str
    ticker: str
    sector: str
    fiscal_year: int

    revenue: float
    cogs: float
    gross_profit: float
    operating_expenses: float
    ebitda: float
    net_income: float

    gross_margin: float
    ebitda_margin: float
    net_margin: float

    total_assets: float
    total_debt: float
    cash_and_equivalents: float
    total_equity: float

    roe: float
    debt_to_equity: float
    current_ratio: float
    employees: int | None

    model_config = {"from_attributes": True}


class PeerBenchmarkResponse(BaseModel):
    """Response for Peer Benchmarking feature — multiple companies to compare."""
    companies: list[CompanyFinancialOut]
    sectors: list[str]
    fiscal_years: list[int]
    count: int


# ── Client Portfolio ─────────────────────────────────────

class ClientPortfolioOut(BaseModel):
    id: uuid.UUID
    client_name: str
    industry: str
    region: str
    annual_revenue: float
    contract_type: str
    risk_tier: str
    relationship_years: int
    notes: str | None

    model_config = {"from_attributes": True}


class RevenueConcentrationResponse(BaseModel):
    """Response for Revenue Concentration feature — portfolio analysis."""
    clients: list[ClientPortfolioOut]
    total_revenue: float
    herfindahl_index: float = Field(
        description="HHI: sum of squared revenue shares. 0-0.15=diversified, 0.15-0.25=moderate, >0.25=concentrated"
    )
    top_client_share: float
    top_3_share: float
    top_5_share: float
    count: int
