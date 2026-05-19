"""IntelliOps Day 1 — Task Assignment, SOP Checklists, Exception Handling tables.

Revision ID: 012
Revises: 011
Create Date: 2026-04-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012"
down_revision = "011_intelliops_day2_sla"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- ops_tasks ---
    op.create_table(
        "ops_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title",        sa.String(),  nullable=False),
        sa.Column("description",  sa.Text(),    nullable=True),
        sa.Column("worker_name",  sa.String(),  nullable=True),
        sa.Column("worker_id",    sa.String(),  nullable=True),
        sa.Column("area",         sa.String(),  nullable=True),
        sa.Column("zone",         sa.String(),  nullable=True),
        sa.Column("priority",     sa.String(),  nullable=False, server_default="medium"),
        sa.Column("status",       sa.String(),  nullable=False, server_default="pending"),
        sa.Column("due_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("incident_ref", sa.String(),  nullable=True),
        sa.Column("created_by",   sa.String(),  nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ops_tasks_status",   "ops_tasks", ["status"])
    op.create_index("ix_ops_tasks_priority", "ops_tasks", ["priority"])
    op.create_index("ix_ops_tasks_zone",     "ops_tasks", ["zone"])

    # --- ops_sop_checklists ---
    op.create_table(
        "ops_sop_checklists",
        sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name",         sa.String(),  nullable=False),
        sa.Column("shift",        sa.String(),  nullable=True),
        sa.Column("zone",         sa.String(),  nullable=True),
        sa.Column("progress_pct", sa.Integer(), server_default="0"),
        sa.Column("status",       sa.String(),  nullable=False, server_default="not_started"),
        sa.Column("assigned_to",  sa.String(),  nullable=True),
        sa.Column("due_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("item_count",   sa.Integer(), server_default="0"),
        sa.Column("items_done",   sa.Integer(), server_default="0"),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ops_sop_checklists_status", "ops_sop_checklists", ["status"])

    # --- ops_exceptions ---
    op.create_table(
        "ops_exceptions",
        sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("exception_type",   sa.String(), nullable=False),
        sa.Column("location",         sa.String(), nullable=True),
        sa.Column("zone",             sa.String(), nullable=True),
        sa.Column("root_cause",       sa.String(), nullable=True),
        sa.Column("description",      sa.Text(),   nullable=True),
        sa.Column("status",           sa.String(), nullable=False, server_default="open"),
        sa.Column("severity",         sa.String(), nullable=False, server_default="medium"),
        sa.Column("assigned_to",      sa.String(), nullable=True),
        sa.Column("resolved_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(),   nullable=True),
        sa.Column("sla_minutes",      sa.Integer(), server_default="60"),
        sa.Column("detected_at",      sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",       sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ops_exceptions_status",         "ops_exceptions", ["status"])
    op.create_index("ix_ops_exceptions_exception_type", "ops_exceptions", ["exception_type"])


def downgrade() -> None:
    op.drop_table("ops_exceptions")
    op.drop_table("ops_sop_checklists")
    op.drop_table("ops_tasks")
