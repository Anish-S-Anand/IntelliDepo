"""Cement Bag Detection Training - Anomaly Alerts table

Revision ID: 023_anomaly_alerts
Revises: 022_detection_metrics
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "023_anomaly_alerts"
down_revision = "022_detection_metrics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create anomaly_alerts table
    op.create_table(
        "anomaly_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("anomaly_type", sa.String(50), nullable=False),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        
        # Anomaly details
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column("threshold_violated", postgresql.JSONB(), nullable=True),
        
        # Alert status
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        
        # Audit
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        
        # CHECK constraints for valid values
        sa.CheckConstraint(
            "anomaly_type IN ('confidence_drop', 'latency_spike', 'count_anomaly', 'error_rate_increase')",
            name="valid_anomaly_type"
        ),
        sa.CheckConstraint(
            "severity IN ('info', 'warning', 'critical')",
            name="valid_severity"
        ),
        sa.CheckConstraint(
            "status IN ('open', 'acknowledged', 'resolved', 'false_positive')",
            name="valid_status"
        )
    )
    
    # Create indexes
    op.create_index("idx_anomaly_alerts_camera_id", "anomaly_alerts", ["camera_id"])
    op.create_index("idx_anomaly_alerts_status", "anomaly_alerts", ["status"])
    op.create_index("idx_anomaly_alerts_detected_at", "anomaly_alerts", ["detected_at"], postgresql_ops={"detected_at": "DESC"})
    op.create_index("idx_anomaly_alerts_severity", "anomaly_alerts", ["severity"])
    
    # Create foreign key constraint
    op.create_foreign_key(
        "fk_anomaly_alerts_acknowledged_by",
        "anomaly_alerts",
        "users",
        ["acknowledged_by"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint("fk_anomaly_alerts_acknowledged_by", "anomaly_alerts", type_="foreignkey")
    
    # Drop indexes
    op.drop_index("idx_anomaly_alerts_severity", table_name="anomaly_alerts")
    op.drop_index("idx_anomaly_alerts_detected_at", table_name="anomaly_alerts")
    op.drop_index("idx_anomaly_alerts_status", table_name="anomaly_alerts")
    op.drop_index("idx_anomaly_alerts_camera_id", table_name="anomaly_alerts")
    
    # Drop table (CHECK constraints are dropped automatically with the table)
    op.drop_table("anomaly_alerts")
