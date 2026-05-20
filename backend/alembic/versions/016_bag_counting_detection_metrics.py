"""Bag Counting Detection Enhancement - Detection Metrics table

Revision ID: 016_bag_counting_detection_metrics
Revises: 015_depot_command_actions
Create Date: 2025-01-15
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "016_bag_counting_detection_metrics"
down_revision = "015_depot_command_actions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, ensure depot_detection_runs table exists
    # If it doesn't exist, create it based on the model definition
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if "depot_detection_runs" not in inspector.get_table_names():
        op.create_table(
            "depot_detection_runs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
            sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column("status", sa.String(), server_default="pending", nullable=False),
            sa.Column("frame_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("total_detections", sa.Integer(), server_default="0", nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("initiated_by", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_depot_detection_runs_camera_id", "depot_detection_runs", ["camera_id"])
        op.create_index("ix_depot_detection_runs_model_id", "depot_detection_runs", ["model_id"])
    
    # Create depot_detection_metrics table
    op.create_table(
        "depot_detection_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("precision", sa.Float(), nullable=False),
        sa.Column("recall", sa.Float(), nullable=False),
        sa.Column("f1_score", sa.Float(), nullable=False),
        sa.Column("true_positives", sa.Integer(), nullable=False),
        sa.Column("false_positives", sa.Integer(), nullable=False),
        sa.Column("false_negatives", sa.Integer(), nullable=False),
        sa.Column("confidence_distribution", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    
    # Create indexes
    op.create_index("ix_depot_detection_metrics_run_id", "depot_detection_metrics", ["run_id"])
    op.create_index("ix_depot_detection_metrics_created_at", "depot_detection_metrics", ["created_at"])
    
    # Add foreign key constraint to depot_detection_runs
    op.create_foreign_key(
        "fk_depot_detection_metrics_run_id",
        "depot_detection_metrics",
        "depot_detection_runs",
        ["run_id"],
        ["id"],
        ondelete="CASCADE"
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint("fk_depot_detection_metrics_run_id", "depot_detection_metrics", type_="foreignkey")
    
    # Drop indexes
    op.drop_index("ix_depot_detection_metrics_created_at", table_name="depot_detection_metrics")
    op.drop_index("ix_depot_detection_metrics_run_id", table_name="depot_detection_metrics")
    
    # Drop table
    op.drop_table("depot_detection_metrics")
    
    # Note: We don't drop depot_detection_runs table here as it may have been created
    # outside this migration or may be used by other parts of the system
