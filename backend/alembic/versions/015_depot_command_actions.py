"""Depot Command Center action audit log

Revision ID: 015_depot_command_actions
Revises: 014_intelliops_day4_incidents
Create Date: 2026-05-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015_depot_command_actions"
down_revision = "014_intelliops_day4_incidents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "depot_command_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="completed", nullable=True),
        sa.Column("actor_id", sa.String(), nullable=True),
        sa.Column("actor_name", sa.String(), nullable=True),
        sa.Column("target_type", sa.String(), nullable=True),
        sa.Column("target_id", sa.String(), nullable=True),
        sa.Column("target_name", sa.String(), nullable=True),
        sa.Column("zone", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("affected_count", sa.Integer(), server_default="0", nullable=True),
        sa.Column("related_incident_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_depot_command_actions_action_type", "depot_command_actions", ["action_type"])
    op.create_index("ix_depot_command_actions_status", "depot_command_actions", ["status"])
    op.create_index("ix_depot_command_actions_zone", "depot_command_actions", ["zone"])
    op.create_index("ix_depot_command_actions_executed_at", "depot_command_actions", ["executed_at"])


def downgrade() -> None:
    op.drop_index("ix_depot_command_actions_executed_at", table_name="depot_command_actions")
    op.drop_index("ix_depot_command_actions_zone", table_name="depot_command_actions")
    op.drop_index("ix_depot_command_actions_status", table_name="depot_command_actions")
    op.drop_index("ix_depot_command_actions_action_type", table_name="depot_command_actions")
    op.drop_table("depot_command_actions")
