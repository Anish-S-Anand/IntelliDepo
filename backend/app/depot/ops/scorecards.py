"""
IntelliOps™ — Performance Scorecards Backend
Feature: F-063 (Performance Scorecards Dashboard)

Pranisree: Scorecard view tabbed by client / team / SLA type.
           Compliance %, breach count, penalty forecast summary cards.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User

logger = logging.getLogger("intelli.ops.scorecards")

router = APIRouter(prefix="/ops/scorecards", tags=["IntelliOps - Scorecards"])


# ---------------------------------------------------------------------------
# Database Model
# ---------------------------------------------------------------------------

class ScorecardEntry(DBBaseModel):
    """Scorecard row — one per module/client/team per reporting period."""
    __tablename__ = "ops_scorecard_entries"

    period = Column(String, nullable=False, index=True)       # e.g., "2026-W15", "2026-04"
    group_type = Column(String, nullable=False, index=True)   # "module", "client", "team"
    group_name = Column(String, nullable=False, index=True)   # "Live Monitoring", "Acme Corp", "Shift A"
    total_slas = Column(Integer, default=0)
    compliant = Column(Integer, default=0)
    at_risk = Column(Integer, default=0)
    breached = Column(Integer, default=0)
    compliance_pct = Column(Float, default=100.0)
    penalty_amount = Column(Float, default=0)
    currency = Column(String, default="USD")
    metadata_json = Column(JSON, nullable=True)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ScorecardCreate(BaseModel):
    period: str = Field(..., json_schema_extra={"example": "2026-W15"})
    group_type: str = Field(default="module")
    group_name: str
    total_slas: int = 0
    compliant: int = 0
    at_risk: int = 0
    breached: int = 0
    penalty_amount: float = 0
    currency: str = "USD"


class ScorecardResponse(BaseModel):
    id: uuid.UUID
    period: str
    group_type: str
    group_name: str
    total_slas: int
    compliant: int
    at_risk: int
    breached: int
    compliance_pct: float
    penalty_amount: float
    currency: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ScorecardSummary(BaseModel):
    overall_compliance_pct: float
    total_slas: int
    total_compliant: int
    total_at_risk: int
    total_breached: int
    total_penalty: float
    currency: str = "USD"
    by_group: list[ScorecardResponse]






# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/entries", response_model=ScorecardResponse, status_code=201)
async def create_scorecard_entry(
    body: ScorecardCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a scorecard entry for a period + group."""
    compliance = (body.compliant / body.total_slas * 100) if body.total_slas > 0 else 100
    entry = ScorecardEntry(
        **body.model_dump(),
        compliance_pct=round(compliance, 1),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return ScorecardResponse.model_validate(entry)


@router.get("/entries", response_model=list[ScorecardResponse])
async def list_scorecard_entries(
    period: Optional[str] = None,
    group_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List scorecard entries, optionally filtered by period or group type."""
    q = select(ScorecardEntry)
    if period:
        q = q.where(ScorecardEntry.period == period)
    if group_type:
        q = q.where(ScorecardEntry.group_type == group_type)
    q = q.order_by(desc(ScorecardEntry.compliance_pct))
    result = await db.execute(q)
    rows = result.scalars().all()
    return [ScorecardResponse.model_validate(r) for r in rows]


@router.get("/summary", response_model=ScorecardSummary)
async def scorecard_summary(
    period: Optional[str] = None,
    group_type: str = "module",
    db: AsyncSession = Depends(get_db),
):
    """Aggregate scorecard summary (F-063)."""
    q = select(ScorecardEntry).where(ScorecardEntry.group_type == group_type)
    if period:
        q = q.where(ScorecardEntry.period == period)
    q = q.order_by(desc(ScorecardEntry.compliance_pct))
    result = await db.execute(q)
    entries = result.scalars().all()

    if not entries:
        return ScorecardSummary(
            overall_compliance_pct=0, total_slas=0,
            total_compliant=0, total_at_risk=0,
            total_breached=0, total_penalty=0,
            by_group=[],
        )

    total_slas = sum(e.total_slas for e in entries)
    total_compliant = sum(e.compliant for e in entries)
    total_at_risk = sum(e.at_risk for e in entries)
    total_breached = sum(e.breached for e in entries)
    total_penalty = sum(e.penalty_amount for e in entries)
    overall_pct = round(total_compliant / total_slas * 100, 1) if total_slas > 0 else 100

    return ScorecardSummary(
        overall_compliance_pct=overall_pct,
        total_slas=total_slas,
        total_compliant=total_compliant,
        total_at_risk=total_at_risk,
        total_breached=total_breached,
        total_penalty=round(total_penalty, 2),
        by_group=[ScorecardResponse.model_validate(e) for e in entries],
    )
