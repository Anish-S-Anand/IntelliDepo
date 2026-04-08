"""
Intelli Platform — Stream Sample Data Service
Feature: STR-API-1

Seeding + query logic for company financials and client portfolio.
"""
from __future__ import annotations

import logging

from sqlalchemy import select, distinct, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.stream.data.models import CompanyFinancial, ClientPortfolio
from app.stream.data.schemas import (
    PeerBenchmarkResponse,
    CompanyFinancialOut,
    RevenueConcentrationResponse,
    ClientPortfolioOut,
)
from app.stream.data.seed import COMPANY_FINANCIALS, CLIENT_PORTFOLIO

logger = logging.getLogger(__name__)


class StreamDataService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Seeding ──────────────────────────────────────────

    async def seed_if_empty(self) -> dict[str, int]:
        """Seed sample data if tables are empty. Returns counts of seeded rows."""
        counts: dict[str, int] = {"companies": 0, "clients": 0}

        existing = await self.db.execute(
            select(func.count()).select_from(CompanyFinancial)
        )
        if existing.scalar() == 0:
            for data in COMPANY_FINANCIALS:
                self.db.add(CompanyFinancial(**data))
            counts["companies"] = len(COMPANY_FINANCIALS)

        existing_clients = await self.db.execute(
            select(func.count()).select_from(ClientPortfolio)
        )
        if existing_clients.scalar() == 0:
            for data in CLIENT_PORTFOLIO:
                self.db.add(ClientPortfolio(**data))
            counts["clients"] = len(CLIENT_PORTFOLIO)

        if counts["companies"] > 0 or counts["clients"] > 0:
            await self.db.commit()
            logger.info("Seeded stream sample data: %s", counts)

        return counts

    # ── Peer Benchmarking ────────────────────────────────

    async def get_peer_benchmarks(
        self,
        sector: str | None = None,
        fiscal_year: int | None = None,
        tickers: list[str] | None = None,
    ) -> PeerBenchmarkResponse:
        """Query company financials for peer benchmarking."""
        stmt = select(CompanyFinancial).order_by(
            CompanyFinancial.revenue.desc()
        )
        if sector:
            stmt = stmt.where(CompanyFinancial.sector == sector)
        if fiscal_year:
            stmt = stmt.where(CompanyFinancial.fiscal_year == fiscal_year)
        if tickers:
            stmt = stmt.where(CompanyFinancial.ticker.in_(tickers))

        result = await self.db.execute(stmt)
        companies = list(result.scalars().all())

        # Get available sectors and years for filter dropdowns
        sectors_result = await self.db.execute(
            select(distinct(CompanyFinancial.sector)).order_by(CompanyFinancial.sector)
        )
        years_result = await self.db.execute(
            select(distinct(CompanyFinancial.fiscal_year)).order_by(
                CompanyFinancial.fiscal_year.desc()
            )
        )

        return PeerBenchmarkResponse(
            companies=[CompanyFinancialOut.model_validate(c) for c in companies],
            sectors=list(sectors_result.scalars().all()),
            fiscal_years=list(years_result.scalars().all()),
            count=len(companies),
        )

    async def get_company(self, ticker: str) -> CompanyFinancialOut | None:
        result = await self.db.execute(
            select(CompanyFinancial).where(CompanyFinancial.ticker == ticker)
        )
        company = result.scalar_one_or_none()
        if company is None:
            return None
        return CompanyFinancialOut.model_validate(company)

    # ── Revenue Concentration ────────────────────────────

    async def get_revenue_concentration(
        self,
        region: str | None = None,
        industry: str | None = None,
        risk_tier: str | None = None,
    ) -> RevenueConcentrationResponse:
        """Query client portfolio and compute concentration metrics."""
        stmt = select(ClientPortfolio).order_by(ClientPortfolio.annual_revenue.desc())
        if region:
            stmt = stmt.where(ClientPortfolio.region == region)
        if industry:
            stmt = stmt.where(ClientPortfolio.industry == industry)
        if risk_tier:
            stmt = stmt.where(ClientPortfolio.risk_tier == risk_tier)

        result = await self.db.execute(stmt)
        clients = list(result.scalars().all())

        total_revenue = sum(c.annual_revenue for c in clients) if clients else 0
        sorted_clients = sorted(clients, key=lambda c: c.annual_revenue, reverse=True)

        # Herfindahl-Hirschman Index
        hhi = 0.0
        if total_revenue > 0:
            hhi = sum((c.annual_revenue / total_revenue) ** 2 for c in clients)

        top_1 = sorted_clients[0].annual_revenue / total_revenue if total_revenue and sorted_clients else 0
        top_3 = sum(c.annual_revenue for c in sorted_clients[:3]) / total_revenue if total_revenue else 0
        top_5 = sum(c.annual_revenue for c in sorted_clients[:5]) / total_revenue if total_revenue else 0

        return RevenueConcentrationResponse(
            clients=[ClientPortfolioOut.model_validate(c) for c in clients],
            total_revenue=total_revenue,
            herfindahl_index=round(hhi, 4),
            top_client_share=round(top_1, 4),
            top_3_share=round(top_3, 4),
            top_5_share=round(top_5, 4),
            count=len(clients),
        )
