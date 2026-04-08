"""
Intelli Platform — Audit Logging System
Feature: OBS-6.18

Immutable audit trail recording every significant user action in the platform.
Supports querying, filtering, and compliance reporting.
"""
from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import Column, String, JSON, select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import BaseModel

logger = logging.getLogger(__name__)


class AuditLog(BaseModel):
    """Immutable audit trail for user actions.

    Inherits UUID primary key and timestamps from BaseModel.
    Once created, entries should never be modified or deleted.
    """
    __tablename__ = "audit_logs"

    user_id = Column(String, index=True, nullable=False)
    action = Column(String, index=True, nullable=False)       # e.g. "LOGIN", "CREATE_ORDER"
    resource_type = Column(String(100), index=True, nullable=True)  # e.g. "role", "user", "depot"
    resource_id = Column(String, nullable=True)                # ID of affected resource
    resource = Column(String, nullable=True)                   # human-readable name (backward compat)
    metadata_json = Column(JSON, nullable=True)                # e.g. {"old": ..., "new": ...}
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)


# ── Write Operations ─────────────────────────────────────────

async def log_action(
    db: AsyncSession,
    user_id: str,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    resource: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    """Create and persist an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource=resource,
        metadata_json=metadata,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    logger.info("Audit: user=%s action=%s resource=%s/%s", user_id, action, resource_type, resource_id)
    return entry


# ── Query Operations ─────────────────────────────────────────

async def get_audit_logs(
    db: AsyncSession,
    user_id: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """Query audit logs with optional filters."""
    query = select(AuditLog).order_by(desc(AuditLog.created_at))

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.where(AuditLog.resource_id == resource_id)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_audit_logs(
    db: AsyncSession,
    user_id: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
) -> int:
    """Count audit logs matching filters (for pagination)."""
    query = select(func.count(AuditLog.id))
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    result = await db.execute(query)
    return result.scalar() or 0


async def get_audit_log_by_id(db: AsyncSession, log_id: UUID) -> AuditLog | None:
    """Get a single audit log entry by ID."""
    result = await db.execute(select(AuditLog).where(AuditLog.id == log_id))
    return result.scalar_one_or_none()


# ── Compliance Reporting ─────────────────────────────────────

async def get_action_summary(
    db: AsyncSession,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[dict]:
    """Get a summary of actions grouped by action type (compliance view)."""
    query = (
        select(AuditLog.action, func.count(AuditLog.id).label("count"))
        .group_by(AuditLog.action)
        .order_by(desc("count"))
    )
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    result = await db.execute(query)
    return [{"action": row.action, "count": row.count} for row in result.all()]


async def get_user_activity_summary(
    db: AsyncSession,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[dict]:
    """Get a summary of user activity (compliance view)."""
    query = (
        select(AuditLog.user_id, func.count(AuditLog.id).label("action_count"))
        .group_by(AuditLog.user_id)
        .order_by(desc("action_count"))
    )
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    result = await db.execute(query)
    return [{"user_id": row.user_id, "action_count": row.action_count} for row in result.all()]
