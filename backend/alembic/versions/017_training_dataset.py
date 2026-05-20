"""Bag Counting Detection Enhancement - Training Dataset table

Revision ID: 017_training_dataset
Revises: 016_bag_counting_detection_metrics
Create Date: 2025-01-15
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "017_training_dataset"
down_revision = "016_bag_counting_detection_metrics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create depot_training_datasets table
    op.create_table(
        "depot_training_datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("size_images", sa.Integer(), nullable=False),
        sa.Column("size_annotations", sa.Integer(), nullable=False),
        sa.Column("annotation_format", sa.String(), nullable=False),
        sa.Column("scene_conditions", postgresql.JSONB(), nullable=True),
        sa.Column("quality_score", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    
    # Create unique constraint on name
    op.create_unique_constraint("uq_depot_training_datasets_name", "depot_training_datasets", ["name"])
    
    # Create indexes
    op.create_index("ix_depot_training_datasets_is_active", "depot_training_datasets", ["is_active"])
    op.create_index("ix_depot_training_datasets_annotation_format", "depot_training_datasets", ["annotation_format"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_depot_training_datasets_annotation_format", table_name="depot_training_datasets")
    op.drop_index("ix_depot_training_datasets_is_active", table_name="depot_training_datasets")
    
    # Drop unique constraint
    op.drop_constraint("uq_depot_training_datasets_name", "depot_training_datasets", type_="unique")
    
    # Drop table
    op.drop_table("depot_training_datasets")
