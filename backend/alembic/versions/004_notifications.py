"""Real-time notifications system

Revision ID: 004
Revises: 003
Create Date: 2026-03-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004_notifications"
down_revision = "003_enterprise_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notif_templates table
    op.create_table(
        "notif_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("subject_template", sa.Text(), nullable=True),
        sa.Column("body_template", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_notif_templates_event_type", "notif_templates", ["event_type"])
    op.create_index("ix_notif_templates_channel", "notif_templates", ["channel"])

    # Create notif_alerts table
    op.create_table(
        "notif_alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="NORMAL"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parent_alert_id", sa.Uuid(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_alert_id"], ["notif_alerts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notif_alerts_user_id", "notif_alerts", ["user_id"])
    op.create_index("ix_notif_alerts_event_type", "notif_alerts", ["event_type"])
    op.create_index("ix_notif_alerts_priority", "notif_alerts", ["priority"])
    op.create_index("ix_notif_alerts_status", "notif_alerts", ["status"])
    op.create_index("ix_notif_alerts_user_status", "notif_alerts", ["user_id", "status"])

    # Create notif_delivery_logs table
    op.create_table(
        "notif_delivery_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("recipient", sa.String(500), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["alert_id"], ["notif_alerts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notif_delivery_logs_alert_id", "notif_delivery_logs", ["alert_id"])
    op.create_index("ix_notif_delivery_logs_alert_status", "notif_delivery_logs", ["alert_id", "status"])

    # Create notif_preferences table
    op.create_table(
        "notif_preferences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("webhook_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("webhook_url", sa.String(500), nullable=True),
        sa.Column("email_overrides", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("quiet_hours_start", sa.String(5), nullable=True),
        sa.Column("quiet_hours_end", sa.String(5), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    # Drop in reverse order
    op.drop_table("notif_preferences")
    op.drop_table("notif_delivery_logs")
    op.drop_table("notif_alerts")
    op.drop_table("notif_templates")
