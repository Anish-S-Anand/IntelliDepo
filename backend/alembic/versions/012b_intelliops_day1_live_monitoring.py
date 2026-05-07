"""IntelliOps Day 1 — Live monitoring tables: sensor_events, alert_queue, alert_thresholds

Revision ID: 012b_intelliops_day1_live_monitoring
Revises: 012
Create Date: 2026-04-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012b_intelliops_day1_live_monitoring"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # F-054 / F-055 — Sensor Events (TimescaleDB-ready hypertable)
    op.create_table(
        "ops_sensor_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(32), server_default="sensor", index=True),
        sa.Column("source_id", sa.String(64), nullable=False, index=True),
        sa.Column("source_name", sa.String(128), nullable=True),
        sa.Column("zone", sa.String(64), nullable=True, index=True),
        sa.Column("severity", sa.String(16), server_default="info", index=True),
        sa.Column("value", sa.Float, nullable=True),
        sa.Column("unit", sa.String(16), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("processed", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-055 / F-056 — Alert Queue
    op.create_table(
        "ops_alert_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("alert_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), server_default="high", index=True),
        sa.Column("priority_score", sa.Integer, server_default="50"),
        sa.Column("source_id", sa.String(64), nullable=True),
        sa.Column("source_name", sa.String(128), nullable=True),
        sa.Column("zone", sa.String(64), nullable=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("status", sa.String(16), server_default="active", index=True),
        sa.Column("acknowledged_by", sa.String(128), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-055 — Alert Thresholds
    op.create_table(
        "ops_alert_thresholds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(32), nullable=False, index=True),
        sa.Column("metric_name", sa.String(64), nullable=False),
        sa.Column("warning_value", sa.Float, nullable=False),
        sa.Column("critical_value", sa.Float, nullable=False),
        sa.Column("comparison", sa.String(8), server_default="gte"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_by", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ops_alert_thresholds")
    op.drop_table("ops_alert_queue")
    op.drop_table("ops_sensor_events")
