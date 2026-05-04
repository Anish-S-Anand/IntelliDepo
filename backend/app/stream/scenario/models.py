"""
Intelli Stream — Scenario Engine Models
Feature: STR-API-2

SQLAlchemy models for What-if scenarios and sensitivity configurations.
The frontend does the financial calculations — these models persist the
user's scenario inputs and sensitivity parameter sets.
"""
import uuid

from sqlalchemy import String, Text, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import BaseModel


class Scenario(BaseModel):
    """A saved What-if financial scenario.

    Stores the user's adjusted financial variables (revenue, COGS, OpEx, etc.)
    and a snapshot of the computed results so they can be reloaded later.
    """
    __tablename__ = "stream_scenarios"

    # Ownership
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), index=True, nullable=False
    )

    # Scenario metadata
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_baseline: Mapped[bool] = mapped_column(Boolean, default=False)

    # Financial inputs — stored as JSON for flexibility
    # Example: {"revenue": 1200000, "cogs": 480000, "opex": 360000, ...}
    base_inputs: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Adjusted inputs — the user's modified values
    adjusted_inputs: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Computed deltas (cached by frontend, stored for quick reload)
    # Example: {"ebitda_delta": 50000, "margin_delta": 2.5, ...}
    computed_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Tags for organization
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Relationships
    sensitivity_configs: Mapped[list["SensitivityConfig"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", lazy="selectin"
    )


class SensitivityConfig(BaseModel):
    """A sensitivity analysis configuration tied to a scenario.

    Defines which variable to stress-test, the range, and step size.
    Used by the Impact Sensitivity Mapping (STR-ISM) frontend feature.
    """
    __tablename__ = "stream_sensitivity_configs"

    # Parent scenario
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stream_scenarios.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )

    # Which variable to stress
    variable_name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_label: Mapped[str] = mapped_column(String(255), nullable=False)

    # Range: e.g. -20% to +20% in 5% steps
    min_pct: Mapped[float] = mapped_column(Float, nullable=False, default=-20.0)
    max_pct: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    step_pct: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)

    # Pre-computed sensitivity results (tornado chart data)
    # Example: [{"pct": -20, "ebitda": 950000}, {"pct": -15, ...}, ...]
    results: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Relationship
    scenario: Mapped["Scenario"] = relationship(back_populates="sensitivity_configs")
