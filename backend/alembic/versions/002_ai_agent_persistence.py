"""AI agent persistence tables.

Revision ID: 002
Revises: 001
Create Date: 2025-03-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "002a"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ai_agent_states table
    op.create_table(
        "ai_agent_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_id", sa.String(36), nullable=False),
        sa.Column("agent_type", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("config_json", postgresql.JSON(), nullable=False),
        sa.Column("status", sa.String(50), server_default="idle", nullable=False),
        sa.Column("conversation_history", postgresql.JSON(), server_default="[]", nullable=False),
        sa.Column("total_tokens_used", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_cost_usd", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("last_active", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_persistent", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agent_id"),
    )
    op.create_index("ix_ai_agent_states_agent_id", "ai_agent_states", ["agent_id"])
    op.create_index("ix_ai_agent_states_agent_type", "ai_agent_states", ["agent_type"])

    # Create ai_agent_tasks table
    op.create_table(
        "ai_agent_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", sa.String(36), nullable=False),
        sa.Column("task_name", sa.String(255), nullable=False),
        sa.Column("task_description", sa.Text(), nullable=False),
        sa.Column("agent_id", sa.String(36), nullable=True),
        sa.Column("agent_type", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(50), server_default="normal", nullable=False),
        sa.Column("input_data", postgresql.JSON(), server_default="{}", nullable=False),
        sa.Column("output_data", postgresql.JSON(), server_default="{}", nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("retries", sa.Integer(), server_default="0", nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id"),
    )
    op.create_index("ix_ai_agent_tasks_task_id", "ai_agent_tasks", ["task_id"])
    op.create_index("ix_ai_agent_tasks_agent_type", "ai_agent_tasks", ["agent_type"])
    op.create_index("ix_ai_agent_tasks_status", "ai_agent_tasks", ["status"])

    # Create ai_task_outcomes table
    op.create_table(
        "ai_task_outcomes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", sa.String(36), nullable=False),
        sa.Column("agent_type", sa.String(100), nullable=False),
        sa.Column("task_description", sa.Text(), nullable=False),
        sa.Column("response_content", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("feedback_score", sa.Float(), nullable=True),
        sa.Column("feedback_label", sa.String(50), nullable=True),
        sa.Column("was_escalated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("embedding_id", sa.String(255), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_task_outcomes_task_id", "ai_task_outcomes", ["task_id"])
    op.create_index("ix_ai_task_outcomes_agent_type", "ai_task_outcomes", ["agent_type"])


def downgrade() -> None:
    op.drop_table("ai_task_outcomes")
    op.drop_table("ai_agent_tasks")
    op.drop_table("ai_agent_states")
