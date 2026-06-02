"""Cement Bag Detection Training - Detection Metrics table

Revision ID: 022_detection_metrics
Revises: 021_deployment_history
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "022_detection_metrics"
down_revision = "021_deployment_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create detection_metrics table
    op.create_table(
        "detection_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        
        # Detection counts
        sa.Column("total_detections", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detections_by_class", postgresql.JSONB(), nullable=True),
        
        # Confidence metrics
        sa.Column("avg_confidence", sa.Float(), nullable=True),
        sa.Column("min_confidence", sa.Float(), nullable=True),
        sa.Column("max_confidence", sa.Float(), nullable=True),
        
        # Performance metrics
        sa.Column("inference_time_ms", sa.Float(), nullable=False),
        sa.Column("fps", sa.Float(), nullable=True),
        
        # Error tracking
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_types", postgresql.JSONB(), nullable=True),
        
        # Aggregation window
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_duration_seconds", sa.Integer(), nullable=True),
        
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)
    )
    
    # Create indexes
    op.create_index("idx_detection_metrics_camera_id", "detection_metrics", ["camera_id"])
    op.create_index("idx_detection_metrics_timestamp", "detection_metrics", ["timestamp"], postgresql_ops={"timestamp": "DESC"})
    op.create_index("idx_detection_metrics_model_version", "detection_metrics", ["model_version"])
    
    # Note: Partitioning by month would be done at table creation time in production
    # For now, we create the base table. Partitioning can be added later with:
    # ALTER TABLE detection_metrics PARTITION BY RANGE (timestamp);
    # CREATE TABLE detection_metrics_y2025m01 PARTITION OF detection_metrics
    #     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');


def downgrade() -> None:
    # Drop indexes
    op.drop_index("idx_detection_metrics_model_version", table_name="detection_metrics")
    op.drop_index("idx_detection_metrics_timestamp", table_name="detection_metrics")
    op.drop_index("idx_detection_metrics_camera_id", table_name="detection_metrics")
    
    # Drop table
    op.drop_table("detection_metrics")
