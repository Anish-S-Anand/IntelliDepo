"""Cement Bag Detection Training - Validation Reports table

Revision ID: 020_validation_reports
Revises: 019_training_runs
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "020_validation_reports"
down_revision = "019_training_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create validation_reports table
    op.create_table(
        "validation_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_dataset_path", sa.Text(), nullable=False),
        
        # Core metrics
        sa.Column("map50", sa.Float(), nullable=False),
        sa.Column("map50_95", sa.Float(), nullable=False),
        sa.Column("precision", sa.Float(), nullable=False),
        sa.Column("recall", sa.Float(), nullable=False),
        sa.Column("f1_score", sa.Float(), nullable=False),
        
        # Per-class metrics (JSON)
        sa.Column("per_class_metrics", postgresql.JSONB(), nullable=True),
        
        # Edge case results
        sa.Column("edge_case_results", postgresql.JSONB(), nullable=True),
        sa.Column("edge_case_pass_rate", sa.Float(), nullable=True),
        
        # Calibration
        sa.Column("calibration_ece", sa.Float(), nullable=True),
        sa.Column("calibration_params", postgresql.JSONB(), nullable=True),
        
        # Inference benchmarks
        sa.Column("gpu_inference_fps", sa.Float(), nullable=True),
        sa.Column("cpu_inference_fps", sa.Float(), nullable=True),
        sa.Column("gpu_latency_ms", sa.Float(), nullable=True),
        sa.Column("cpu_latency_ms", sa.Float(), nullable=True),
        
        # Error analysis
        sa.Column("false_positive_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("false_negative_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_analysis", postgresql.JSONB(), nullable=True),
        
        # Validation result
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("recommendations", postgresql.ARRAY(sa.Text()), nullable=True),
        
        # Audit
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("validated_by", postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Create indexes
    op.create_index("idx_validation_reports_model_id", "validation_reports", ["model_id"])
    op.create_index("idx_validation_reports_passed", "validation_reports", ["passed"])
    op.create_index("idx_validation_reports_map50", "validation_reports", ["map50"], postgresql_ops={"map50": "DESC"})
    
    # Create foreign key constraints
    op.create_foreign_key(
        "fk_validation_reports_model_id",
        "validation_reports",
        "training_models",
        ["model_id"],
        ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_validation_reports_validated_by",
        "validation_reports",
        "users",
        ["validated_by"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    # Drop foreign key constraints
    op.drop_constraint("fk_validation_reports_validated_by", "validation_reports", type_="foreignkey")
    op.drop_constraint("fk_validation_reports_model_id", "validation_reports", type_="foreignkey")
    
    # Drop indexes
    op.drop_index("idx_validation_reports_map50", table_name="validation_reports")
    op.drop_index("idx_validation_reports_passed", table_name="validation_reports")
    op.drop_index("idx_validation_reports_model_id", table_name="validation_reports")
    
    # Drop table
    op.drop_table("validation_reports")
