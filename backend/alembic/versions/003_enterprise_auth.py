"""Enterprise authentication and authorization tables.

Revision ID: 003
Revises: 002
Create Date: 2025-03-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "003_enterprise_auth"
down_revision = "002b_create_rbac_and_prompt_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend users table with new columns
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("users", sa.Column("mfa_secret", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("mfa_backup_codes", postgresql.JSON(), nullable=True))
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), server_default=sa.text("0"), nullable=False))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("users", sa.Column("email_verify_token", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("email_verify_expires", sa.DateTime(timezone=True), nullable=True))

    # NOTE: auth_roles, auth_permissions, auth_role_permissions, auth_user_roles
    # are REMOVED — 002b already creates roles, permissions, role_permissions, user_roles.
    # Only enterprise-auth-specific tables (sessions, api_keys, oauth) remain.

    # Create auth_sessions table
    op.create_table(
        "auth_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("jti", sa.String(36), nullable=False),
        sa.Column("device_name", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_jti", "auth_sessions", ["jti"])

    # Create auth_api_keys table
    op.create_table(
        "auth_api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(16), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("scopes", postgresql.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_api_keys_user_id", "auth_api_keys", ["user_id"])
    op.create_index("ix_auth_api_keys_key_prefix", "auth_api_keys", ["key_prefix"])

    # Create auth_oauth_accounts table
    op.create_table(
        "auth_oauth_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_user_id", sa.String(255), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_profile", postgresql.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id"),
    )
    op.create_index("ix_auth_oauth_accounts_user_id", "auth_oauth_accounts", ["user_id"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("auth_oauth_accounts")
    op.drop_table("auth_api_keys")
    op.drop_table("auth_sessions")

    # Drop columns from users table
    op.drop_column("users", "email_verify_expires")
    op.drop_column("users", "email_verify_token")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "mfa_backup_codes")
    op.drop_column("users", "mfa_secret")
    op.drop_column("users", "mfa_enabled")
