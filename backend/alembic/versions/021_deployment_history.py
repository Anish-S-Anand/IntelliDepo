"""Cement Bag Detection Training - Deployment History table

Revision ID: 021_deployment_history
Revises: 020_validation_reports
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "021_deployment_history"
down_revision = "020_validation_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create deployment_history table
    op.create_table(
        "deployment_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("deployment_type", sa.String(20), nullable=False),
        sa.Column("target_environment", sa.String(20), nullable=False, server_default="production"),
        sa.Column("status", sa.String(20), nullable=False),
        
        # Deployment configuration
        sa.Column("deployment_config", postgresql.JSONB(), nullable=True),
        
        # Backup information
        sa.Column("backup_path", sa.Text(), nullable=True),
        sa.Column("previous_model_version", sa.String(50), nullable=True),
        
        # A/B testing
        sa.Column("ab_test_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("traffic_split", sa.Float(), nullable=True),
        
        # Results
        sa.Column("deployed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rollback_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rollback_reason", sa.Text(), nullable=True),
        
        # Monitoring results
        sa.Column("monitoring_metrics", postgresql.JSONB(), nullable=True),
        
        # Audit
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deployed_by", postgresql.UUID(as_uuid=True), nullable=True),
        
        # CHECK constraints for valid values
        sa.CheckConstraint(
            "deployment_type IN ('full', 'ab_test', 'rollback')",
            name="valid_deployment_type"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'deploying', 'deployed', 'rolled_back', 'failed')",
            name="valid_status"
        )
    )
    
    # Create indexes
    op.create_index("idx_deployment_history_model_id", "deployment_history", ["model_id"])
    op.create_index("idx_deployment_history_status", "deployment_history", ["status"])
    op.create_index("idx_deployment_history_deployed_at", "deployment_history", ["deployed_at"], postgresql_ops={"deployed_at": "DESC"})
    
    # Create foreign key constraints
    op.create_foreign_key(
        "fk_deployment_history_model_id",
        "deployment_history",
        "training_models",
        ["model_id"],
        ["id"],
        ondelete="CASCADE"
    )
    
    op.create_foreign_key(
        "fk_deployment_history_deployed_by",
        "deployment_history",
        "users",
        ["deployed_by"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    # Drop foreign key constraints
    op.drop_constraint("fk_deployment_history_deployed_by", "deployment_history", type_="foreignkey")
    op.drop_constraint("fk_deployment_history_model_id", "deployment_history", type_="foreignkey")
    
    # Drop indexes
    op.drop_index("idx_deployment_history_deployed_at", table_name="deployment_history")
    op.drop_index("idx_deployment_history_status", table_name="deployment_history")
    op.drop_index("idx_deployment_history_model_id", table_name="deployment_history")
    
    # Drop table (CHECK constraints are dropped automatically with the table)
    op.drop_table("deployment_history")
