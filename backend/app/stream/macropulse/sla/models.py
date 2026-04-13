"""SLA definition models — Day 2 (F-059) Keerthi"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SLADefinition(Base):
    __tablename__ = "macropulse_sla_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(128), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    metric_key = Column(String(128), nullable=False)          # e.g. "alert_dispatch_latency_ms"
    threshold_value = Column(Float, nullable=False)
    threshold_unit = Column(String(64), nullable=False)       # e.g. "ms", "pct", "count"
    window_minutes = Column(Float, nullable=False, default=60.0)
    breach_probability_threshold = Column(Float, nullable=False, default=0.75)
    is_active = Column(Boolean, nullable=False, default=True)
    requires_approval = Column(Boolean, nullable=False, default=False)
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    is_deleted = Column(Boolean, nullable=False, default=False)


class SLAEvent(Base):
    """Persisted operator acknowledge events + audit log — Day 2 Pranisree"""
    __tablename__ = "macropulse_sla_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sla_id = Column(UUID(as_uuid=True), ForeignKey("macropulse_sla_definitions.id"), nullable=False)
    tenant_id = Column(String(128), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)           # "acknowledged" | "escalated" | "breach"
    operator_id = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    alert_id = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
