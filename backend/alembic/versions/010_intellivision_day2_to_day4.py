"""IntelliVision Day 2-4 — Tracking, escalation, visitor management tables.

Revision ID: 010
Revises: 009
Create Date: 2026-04-10 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_intellivision_day2_to_day4"
down_revision = "009_intellivision_day1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Day 2: DeepSORT multi-object tracking ---
    op.create_table(
        "depot_tracked_objects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("class_label", sa.String(), nullable=False),
        sa.Column("first_seen_frame", sa.Integer(), nullable=False),
        sa.Column("last_seen_frame", sa.Integer(), nullable=False),
        sa.Column("total_frames", sa.Integer(), server_default="1"),
        sa.Column("avg_confidence", sa.Float(), server_default="0"),
        sa.Column("last_bbox_x", sa.Float(), nullable=True),
        sa.Column("last_bbox_y", sa.Float(), nullable=True),
        sa.Column("last_bbox_w", sa.Float(), nullable=True),
        sa.Column("last_bbox_h", sa.Float(), nullable=True),
        sa.Column("direction", sa.String(), nullable=True),
        sa.Column("speed_estimate", sa.Float(), nullable=True),
        sa.Column("is_counted", sa.Boolean(), server_default="false"),
        sa.Column("crossed_line", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_depot_tracked_objects_track_session", "depot_tracked_objects", ["track_id", "session_id"], unique=True)

    op.create_table(
        "depot_tracking_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("detection_run_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("status", sa.String(), server_default="running"),
        sa.Column("total_frames", sa.Integer(), server_default="0"),
        sa.Column("unique_objects", sa.Integer(), server_default="0"),
        sa.Column("counts_by_class", postgresql.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("initiated_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- Day 2: Cluster zone density history (time-series) ---
    op.create_table(
        "depot_zone_density_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("zone_code", sa.String(), nullable=True),
        sa.Column("occupancy", sa.Integer(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("utilization_pct", sa.Float(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_depot_zone_density_ts", "depot_zone_density_history", ["zone_id", "recorded_at"])

    # --- Day 3: Visitor registration for gate control ---
    op.create_table(
        "depot_visitors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column("purpose", sa.String(), nullable=True),
        sa.Column("contact_number", sa.String(), nullable=True),
        sa.Column("id_proof_type", sa.String(), nullable=True),
        sa.Column("id_proof_number", sa.String(), nullable=True),
        sa.Column("vehicle_plate", sa.String(), nullable=True, index=True),
        sa.Column("host_name", sa.String(), nullable=True),
        sa.Column("gate_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pass_valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(), server_default="checked_in"),
        sa.Column("registered_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- Day 4: Perimeter incident escalation ---
    op.create_table(
        "depot_perimeter_incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("breach_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("escalation_level", sa.Integer(), server_default="0"),
        sa.Column("escalation_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalated_to", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default="open"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.String(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("video_archive_ref", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- Day 3: Pick log with full traceability ---
    op.create_table(
        "depot_pick_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pick_order_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("batch_code", sa.String(), nullable=True),
        sa.Column("sku_code", sa.String(), nullable=False),
        sa.Column("quantity_picked", sa.Integer(), nullable=False),
        sa.Column("sequencing_rule_applied", sa.String(), nullable=True),
        sa.Column("compliance_status", sa.String(), server_default="compliant"),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("overridden_by", sa.String(), nullable=True),
        sa.Column("scan_method", sa.String(), nullable=True),
        sa.Column("scan_value", sa.String(), nullable=True),
        sa.Column("zone", sa.String(), nullable=True),
        sa.Column("rack", sa.String(), nullable=True),
        sa.Column("bin_location", sa.String(), nullable=True),
        sa.Column("picked_by", sa.String(), nullable=True),
        sa.Column("picked_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("depot_pick_logs")
    op.drop_table("depot_perimeter_incidents")
    op.drop_table("depot_visitors")
    op.drop_index("ix_depot_zone_density_ts", table_name="depot_zone_density_history")
    op.drop_table("depot_zone_density_history")
    op.drop_index("ix_depot_tracked_objects_track_session", table_name="depot_tracked_objects")
    op.drop_table("depot_tracking_sessions")
    op.drop_table("depot_tracked_objects")
