"""
Intelli Platform — Audit Log API Router
Feature: OBS-6.18

Read-only endpoints for querying the immutable audit trail.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.auth.dependencies import require_permission
from app.core.observability.audit import (
    count_audit_logs,
    get_action_summary,
    get_audit_log_by_id,
    get_audit_logs,
    get_user_activity_summary,
)
from app.shared.models.user import User

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: str
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    resource: str | None = None
    metadata_json: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    limit: int
    offset: int


class ActionSummaryItem(BaseModel):
    action: str
    count: int


class UserActivityItem(BaseModel):
    user_id: str
    action_count: int


@router.get("/logs", response_model=AuditLogListResponse)
async def api_list_audit_logs(
    user_id: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_permission("settings:read")),
    db: AsyncSession = Depends(get_db),
):
    """Query audit logs with filters and pagination."""
    items = await get_audit_logs(
        db, user_id=user_id, action=action, resource_type=resource_type,
        resource_id=resource_id, start_date=start_date, end_date=end_date,
        limit=limit, offset=offset,
    )
    total = await count_audit_logs(db, user_id=user_id, action=action, resource_type=resource_type)
    return AuditLogListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def api_get_audit_log(
    log_id: uuid.UUID,
    current_user: User = Depends(require_permission("settings:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single audit log entry."""
    entry = await get_audit_log_by_id(db, log_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")
    return entry


@router.get("/summary/actions", response_model=list[ActionSummaryItem])
async def api_action_summary(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    current_user: User = Depends(require_permission("settings:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a compliance summary of actions by type."""
    return await get_action_summary(db, start_date=start_date, end_date=end_date)


@router.get("/summary/users", response_model=list[UserActivityItem])
async def api_user_activity_summary(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    current_user: User = Depends(require_permission("settings:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a compliance summary of user activity."""
    return await get_user_activity_summary(db, start_date=start_date, end_date=end_date)
