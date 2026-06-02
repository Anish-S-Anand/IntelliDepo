"""Cement Bag Detection Training - Training Models table

Revision ID: 018_training_models
Revises: 017_training_dataset
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "018_training_models"
down_revision = "017_training_dataset"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create training_models table
    op.create_table(
        "training_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("version", sa.String(50), nullable=False, unique=True),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("model_path", sa.Text(), nullable=False),
        sa.Column("base_model", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="training"),
        
        # Hyperparameters (JSON)
        sa.Column("hyperparameters", postgresql.JSONB(), nullable=False),
        
        # Metrics (JSON)
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        
        # Dataset metadata
        sa.Column("dataset_version", sa.String(50), nullable=True),
        sa.Column("dataset_path", sa.Text(), nullable=True),
        sa.Column("training_script_commit", sa.String(40), nullable=True),
        
        # Training metadata
        sa.Column("training_duration_seconds", sa.Float(), nullable=True),
        sa.Column("training_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("training_completed_at", sa.DateTime(timezone=True), nullable=True),
        
        # Deployment metadata
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deployment_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        
        # Audit fields
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        
        # CHECK constraint for valid status values
        sa.CheckConstraint(
            "status IN ('training', 'validated', 'deployed', 'retired', 'failed')",
            name="valid_status"
        )
    )
    
    # Create indexes
    op.create_index("idx_training_models_status", "training_models", ["status"])
    op.create_index("idx_training_models_version", "training_models", ["version"])
    op.create_index("idx_training_models_created_at", "training_models", ["created_at"], postgresql_ops={"created_at": "DESC"})
    
    # Create foreign key constraint to users table
    op.create_foreign_key(
        "fk_training_models_created_by",
        "training_models",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint("fk_training_models_created_by", "training_models", type_="foreignkey")
    
    # Drop indexes
    op.drop_index("idx_training_models_created_at", table_name="training_models")
    op.drop_index("idx_training_models_version", table_name="training_models")
    op.drop_index("idx_training_models_status", table_name="training_models")
    
    # Drop table (CHECK constraint is dropped automatically with the table)
    op.drop_table("training_models")
