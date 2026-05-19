"""IntelliOps Day 2 — SLA definitions + SLA events tables

Revision ID: 011_intelliops_day2_sla
Revises: 010_intellivision_day2_to_day4
Create Date: 2026-04-13
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011_intelliops_day2_sla"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "macropulse_sla_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", sa.String(128), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("metric_key", sa.String(128), nullable=False),
        sa.Column("threshold_value", sa.Float, nullable=False),
        sa.Column("threshold_unit", sa.String(64), nullable=False),
        sa.Column("window_minutes", sa.Float, nullable=False, server_default="60"),
        sa.Column("breach_probability_threshold", sa.Float, nullable=False, server_default="0.75"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("requires_approval", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("approved_by", sa.String(128), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
    )

    op.create_table(
        "macropulse_sla_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sla_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("macropulse_sla_definitions.id"), nullable=False),
        sa.Column("tenant_id", sa.String(128), nullable=False, index=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("operator_id", sa.String(128), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("alert_id", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("macropulse_sla_events")
    op.drop_table("macropulse_sla_definitions")
