"""SLA schemas — Day 2 (F-059) Keerthi"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SLACreate(BaseModel):
    tenant_id: str
    name: str
    description: Optional[str] = None
    metric_key: str
    threshold_value: float
    threshold_unit: str
    window_minutes: float = 60.0
    breach_probability_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    is_active: bool = True
    requires_approval: bool = False


class SLAUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    threshold_value: Optional[float] = None
    threshold_unit: Optional[str] = None
    window_minutes: Optional[float] = None
    breach_probability_threshold: Optional[float] = None
    is_active: Optional[bool] = None
    requires_approval: Optional[bool] = None


class SLAApprove(BaseModel):
    approved_by: str


class SLAResponse(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    description: Optional[str]
    metric_key: str
    threshold_value: float
    threshold_unit: str
    window_minutes: float
    breach_probability_threshold: float
    is_active: bool
    requires_approval: bool
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SLAEventCreate(BaseModel):
    operator_id: str
    notes: Optional[str] = None
    alert_id: Optional[str] = None


class SLAEventResponse(BaseModel):
    id: UUID
    sla_id: UUID
    tenant_id: str
    event_type: str
    operator_id: Optional[str]
    notes: Optional[str]
    alert_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Breach prediction response shape (F-060) ─────────────────────────────────

class BreachPrediction(BaseModel):
    sla_id: UUID
    sla_name: str
    metric_key: str
    current_value: float
    threshold_value: float
    breach_probability: float
    predicted_breach_at: Optional[datetime]
    time_to_breach_minutes: Optional[float]
    escalation_status: str   # "ok" | "at_risk" | "breached"
    confidence: float
