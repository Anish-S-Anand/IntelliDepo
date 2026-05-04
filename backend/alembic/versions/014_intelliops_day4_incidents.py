"""IntelliOps Day 4 — Incidents, notifications, audit trail, auto-escalation rules

Revision ID: 014_intelliops_day4_incidents
Revises: 013_intelliops_day3_fleet_yard
Create Date: 2026-04-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014_intelliops_day4_incidents"
down_revision = "013_intelliops_day3_fleet_yard"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Unified OpsIncident
    op.create_table(
        "ops_incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("incident_type", sa.String(64), nullable=True, index=True),
        sa.Column("source", sa.String(32), server_default="manual", index=True),
        sa.Column("source_ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("priority", sa.String(4), server_default="P3", index=True),
        sa.Column("severity_score", sa.Float, server_default="0.5"),
        sa.Column("status", sa.String(16), server_default="open", index=True),
        sa.Column("zone", sa.String(64), nullable=True),
        sa.Column("assigned_to", sa.String(128), nullable=True),
        sa.Column("escalation_level", sa.Integer, server_default="0"),
        sa.Column("escalation_chain", postgresql.JSON, server_default="[]"),
        sa.Column("escalation_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(128), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(128), nullable=True),
        sa.Column("resolution_notes", sa.Text, nullable=True),
        sa.Column("resolution_steps", postgresql.JSON, server_default="[]"),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-071 — Notification records per incident
    op.create_table(
        "ops_incident_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("recipient", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), server_default="sent"),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-073 — Immutable audit trail per incident
    op.create_table(
        "ops_incident_audit",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("actor", sa.String(128), nullable=True),
        sa.Column("actor_role", sa.String(32), nullable=True),
        sa.Column("previous_state", sa.String(16), nullable=True),
        sa.Column("new_state", sa.String(16), nullable=True),
        sa.Column("details", sa.Text, nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-069 — Auto-escalation rules
    op.create_table(
        "ops_auto_escalation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("priority_trigger", sa.String(4), nullable=False, index=True),
        sa.Column("source_filter", sa.String(32), nullable=True),
        sa.Column("time_window_minutes", sa.Integer, server_default="15"),
        sa.Column("target_tier", sa.String(64), nullable=True),
        sa.Column("notification_channels", postgresql.JSON, server_default='["in_app","email"]'),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_by", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ops_auto_escalation_rules")
    op.drop_table("ops_incident_audit")
    op.drop_table("ops_incident_notifications")
    op.drop_table("ops_incidents")
