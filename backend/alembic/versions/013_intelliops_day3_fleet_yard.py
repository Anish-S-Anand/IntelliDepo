"""IntelliOps Day 3 — Escalation workflows, penalties, fleet/yard, dwell, dock scheduling, scorecards

Revision ID: 013_intelliops_day3_fleet_yard
Revises: 012_intelliops_day1_operations
Create Date: 2026-04-13
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "013_intelliops_day3_fleet_yard"
down_revision = "012b_intelliops_day1_live_monitoring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # F-061 — Escalation Rules
    op.create_table(
        "ops_escalation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("severity_trigger", sa.String(32), nullable=False, index=True),
        sa.Column("breach_probability_threshold", sa.Float, nullable=False, server_default="0.80"),
        sa.Column("tier_1_delay_minutes", sa.Integer, nullable=False, server_default="5"),
        sa.Column("tier_2_delay_minutes", sa.Integer, nullable=False, server_default="15"),
        sa.Column("tier_3_delay_minutes", sa.Integer, nullable=False, server_default="30"),
        sa.Column("tier_1_contacts", postgresql.JSON, server_default="[]"),
        sa.Column("tier_2_contacts", postgresql.JSON, server_default="[]"),
        sa.Column("tier_3_contacts", postgresql.JSON, server_default="[]"),
        sa.Column("notification_channels", postgresql.JSON, server_default='["in_app","email"]'),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-061 — Escalation Workflows
    op.create_table(
        "ops_escalation_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("sla_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("trigger_type", sa.String(64), server_default="sla_breach"),
        sa.Column("trigger_source", sa.String(256), nullable=True),
        sa.Column("breach_probability", sa.Float, nullable=True),
        sa.Column("severity", sa.String(32), nullable=False, index=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending", index=True),
        sa.Column("current_tier", sa.String(16), server_default="tier_1"),
        sa.Column("tier_1_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tier_2_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tier_3_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tier_1_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tier_2_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tier_3_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(128), nullable=True),
        sa.Column("resolution_notes", sa.Text, nullable=True),
        sa.Column("notifications_sent", postgresql.JSON, server_default="[]"),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-062 — SLA Penalties
    op.create_table(
        "ops_sla_penalties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sla_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("sla_name", sa.String(256), nullable=True),
        sa.Column("client_name", sa.String(256), nullable=True, index=True),
        sa.Column("breach_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("breach_ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("breach_duration_minutes", sa.Float, server_default="0"),
        sa.Column("penalty_rate_per_hour", sa.Float, server_default="0"),
        sa.Column("penalty_amount", sa.Float, server_default="0"),
        sa.Column("currency", sa.String(8), server_default="USD"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending", index=True),
        sa.Column("waiver_reason", sa.Text, nullable=True),
        sa.Column("invoiced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-064 — Fleet Vehicles
    op.create_table(
        "ops_vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vehicle_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("vehicle_type", sa.String(32), server_default="truck"),
        sa.Column("driver_name", sa.String(128), nullable=True),
        sa.Column("driver_contact", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), server_default="in_transit", index=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("speed_kmh", sa.Float, server_default="0"),
        sa.Column("heading", sa.Float, server_default="0"),
        sa.Column("current_zone", sa.String(64), nullable=True, index=True),
        sa.Column("assigned_dock", sa.String(32), nullable=True),
        sa.Column("entered_yard_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_gps_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Dock Slots
    op.create_table(
        "ops_dock_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dock_id", sa.String(32), nullable=False, unique=True, index=True),
        sa.Column("dock_name", sa.String(128), nullable=True),
        sa.Column("zone", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), server_default="free", index=True),
        sa.Column("assigned_vehicle_id", sa.String(64), nullable=True),
        sa.Column("reserved_for", sa.String(64), nullable=True),
        sa.Column("reserved_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reserved_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("capacity_tonnes", sa.Float, server_default="20"),
        sa.Column("dock_type", sa.String(32), server_default="standard"),
        sa.Column("x_position", sa.Float, server_default="0"),
        sa.Column("y_position", sa.Float, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-066 — Dwell Records
    op.create_table(
        "ops_dwell_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vehicle_id", sa.String(64), nullable=False, index=True),
        sa.Column("vehicle_type", sa.String(32), nullable=True),
        sa.Column("zone", sa.String(64), nullable=True, index=True),
        sa.Column("dock_id", sa.String(32), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dwell_minutes", sa.Float, server_default="0"),
        sa.Column("alert_level", sa.String(16), server_default="normal", index=True),
        sa.Column("alert_sent", sa.Boolean, server_default="false"),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Dock Schedules (F-067)
    op.create_table(
        "ops_dock_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dock_id", sa.String(32), nullable=False, index=True),
        sa.Column("vehicle_id", sa.String(64), nullable=True),
        sa.Column("client_name", sa.String(256), nullable=True),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_departure", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), server_default="scheduled", index=True),
        sa.Column("delay_risk", sa.Boolean, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # F-063 — Scorecard Entries
    op.create_table(
        "ops_scorecard_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("period", sa.String(32), nullable=False, index=True),
        sa.Column("group_type", sa.String(32), nullable=False, index=True),
        sa.Column("group_name", sa.String(256), nullable=False, index=True),
        sa.Column("total_slas", sa.Integer, server_default="0"),
        sa.Column("compliant", sa.Integer, server_default="0"),
        sa.Column("at_risk", sa.Integer, server_default="0"),
        sa.Column("breached", sa.Integer, server_default="0"),
        sa.Column("compliance_pct", sa.Float, server_default="100"),
        sa.Column("penalty_amount", sa.Float, server_default="0"),
        sa.Column("currency", sa.String(8), server_default="USD"),
        sa.Column("metadata_json", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ops_scorecard_entries")
    op.drop_table("ops_dock_schedules")
    op.drop_table("ops_dwell_records")
    op.drop_table("ops_dock_slots")
    op.drop_table("ops_vehicles")
    op.drop_table("ops_sla_penalties")
    op.drop_table("ops_escalation_workflows")
    op.drop_table("ops_escalation_rules")
