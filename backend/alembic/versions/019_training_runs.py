"""Cement Bag Detection Training - Training Runs table

Revision ID: 019_training_runs
Revises: 018_training_models
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "019_training_runs"
down_revision = "018_training_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create training_runs table
    op.create_table(
        "training_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("dataset_path", sa.Text(), nullable=False),
        sa.Column("hyperparameters", postgresql.JSONB(), nullable=False),
        
        # Progress tracking
        sa.Column("current_epoch", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_epochs", sa.Integer(), nullable=False),
        sa.Column("best_epoch", sa.Integer(), nullable=True),
        
        # Metrics per epoch (array of JSON objects)
        sa.Column("epoch_metrics", postgresql.JSONB(), nullable=True),
        
        # Final results
        sa.Column("final_metrics", postgresql.JSONB(), nullable=True),
        sa.Column("output_path", sa.Text(), nullable=True),
        sa.Column("logs_path", sa.Text(), nullable=True),
        
        # Timing
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        
        # Error handling
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_traceback", sa.Text(), nullable=True),
        
        # Audit
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("initiated_by", postgresql.UUID(as_uuid=True), nullable=True),
        
        # CHECK constraint for valid status values
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed', 'cancelled')",
            name="valid_status"
        )
    )
    
    # Create indexes
    op.create_index("idx_training_runs_model_id", "training_runs", ["model_id"])
    op.create_index("idx_training_runs_status", "training_runs", ["status"])
    op.create_index("idx_training_runs_created_at", "training_runs", ["created_at"], postgresql_ops={"created_at": "DESC"})
    
    # Create foreign key constraints
    op.create_foreign_key(
        "fk_training_runs_model_id",
        "training_runs",
        "training_models",
        ["model_id"],
        ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_training_runs_initiated_by",
        "training_runs",
        "users",
        ["initiated_by"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    # Drop foreign key constraints
    op.drop_constraint("fk_training_runs_initiated_by", "training_runs", type_="foreignkey")
    op.drop_constraint("fk_training_runs_model_id", "training_runs", type_="foreignkey")
    
    # Drop indexes
    op.drop_index("idx_training_runs_created_at", table_name="training_runs")
    op.drop_index("idx_training_runs_status", table_name="training_runs")
    op.drop_index("idx_training_runs_model_id", table_name="training_runs")
    
    # Drop table (CHECK constraint is dropped automatically with the table)
    op.drop_table("training_runs")
