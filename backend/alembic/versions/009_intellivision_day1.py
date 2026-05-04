"""IntelliVision Day 1 — Colour analysis tables and detection model calibration.

Revision ID: 009
Revises: 008
Create Date: 2026-04-10 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_intellivision_day1"
down_revision = "008_macropulse_tenant_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Detection model calibration columns ---
    op.add_column(
        "depot_detection_models",
        sa.Column("frame_width_px", sa.Integer(), server_default="1920", nullable=True),
    )
    op.add_column(
        "depot_detection_models",
        sa.Column("frame_height_px", sa.Integer(), server_default="1080", nullable=True),
    )
    op.add_column(
        "depot_detection_models",
        sa.Column("px_to_cm_x", sa.Float(), server_default="0.5", nullable=True),
    )
    op.add_column(
        "depot_detection_models",
        sa.Column("px_to_cm_y", sa.Float(), server_default="0.5", nullable=True),
    )

    # --- Colour analysis run ---
    op.create_table(
        "depot_colour_analysis_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("detection_run_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("status", sa.String(), server_default="pending"),
        sa.Column("total_analysed", sa.Integer(), server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("initiated_by", sa.String(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- Colour extraction results ---
    op.create_table(
        "depot_colour_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("analysis_run_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("detected_object_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("class_label", sa.String(), nullable=False),
        sa.Column("colour_category", sa.String(), nullable=False),
        sa.Column("rgb_r", sa.Integer(), server_default="0"),
        sa.Column("rgb_g", sa.Integer(), server_default="0"),
        sa.Column("rgb_b", sa.Integer(), server_default="0"),
        sa.Column("hsv_h", sa.Float(), server_default="0"),
        sa.Column("hsv_s", sa.Float(), server_default="0"),
        sa.Column("hsv_v", sa.Float(), server_default="0"),
        sa.Column("confidence", sa.Float(), server_default="0"),
        sa.Column("bbox_x", sa.Float(), nullable=True),
        sa.Column("bbox_y", sa.Float(), nullable=True),
        sa.Column("bbox_w", sa.Float(), nullable=True),
        sa.Column("bbox_h", sa.Float(), nullable=True),
        sa.Column("frame_number", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # --- Colour mismatch alerts ---
    op.create_table(
        "depot_colour_mismatch_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("analysis_run_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("manifest_code", sa.String(), nullable=True),
        sa.Column("expected_colour", sa.String(), nullable=True),
        sa.Column("detected_colours", sa.Text(), nullable=True),
        sa.Column("mismatch_count", sa.Integer(), server_default="0"),
        sa.Column("total_analysed", sa.Integer(), server_default="0"),
        sa.Column("severity", sa.String(), server_default="medium"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("acknowledged", sa.Boolean(), server_default="false"),
        sa.Column("acknowledged_by", sa.String(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("depot_colour_mismatch_alerts")
    op.drop_table("depot_colour_results")
    op.drop_table("depot_colour_analysis_runs")
    op.drop_column("depot_detection_models", "px_to_cm_y")
    op.drop_column("depot_detection_models", "px_to_cm_x")
    op.drop_column("depot_detection_models", "frame_height_px")
    op.drop_column("depot_detection_models", "frame_width_px")
