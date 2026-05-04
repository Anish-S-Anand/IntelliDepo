"""
Intelli Platform — Stream Sample Data ORM Models
Feature: STR-API-1

Models for company financials (Peer Benchmarking) and client portfolio (Revenue Concentration).
"""
from __future__ import annotations

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import BaseModel


class CompanyFinancial(BaseModel):
    """Annual financial snapshot for a company — used by Peer Benchmarking."""

    __tablename__ = "stream_company_financials"

    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    sector: Mapped[str] = mapped_column(String(100), nullable=False)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)

    # Income statement (in millions USD)
    revenue: Mapped[float] = mapped_column(Float, nullable=False)
    cogs: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    gross_profit: Mapped[float] = mapped_column(Float, nullable=False)
    operating_expenses: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    ebitda: Mapped[float] = mapped_column(Float, nullable=False)
    net_income: Mapped[float] = mapped_column(Float, nullable=False)

    # Margins (stored as decimals, e.g. 0.25 = 25%)
    gross_margin: Mapped[float] = mapped_column(Float, nullable=False)
    ebitda_margin: Mapped[float] = mapped_column(Float, nullable=False)
    net_margin: Mapped[float] = mapped_column(Float, nullable=False)

    # Balance sheet
    total_assets: Mapped[float] = mapped_column(Float, nullable=False)
    total_debt: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    cash_and_equivalents: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    total_equity: Mapped[float] = mapped_column(Float, nullable=False)

    # Ratios
    roe: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    debt_to_equity: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    current_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    # Headcount
    employees: Mapped[int] = mapped_column(Integer, nullable=True)


class ClientPortfolio(BaseModel):
    """Client revenue entry — used by Revenue Concentration analysis."""

    __tablename__ = "stream_client_portfolio"

    client_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    industry: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    annual_revenue: Mapped[float] = mapped_column(Float, nullable=False)
    contract_type: Mapped[str] = mapped_column(String(50), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(20), nullable=False)
    relationship_years: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
