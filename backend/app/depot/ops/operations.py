"""
IntelliOps™ — Operations Management Backend
Features: Task Assignment, SOP Checklists, Exception Handling

Covers the IntelliOps Day 1 plan:
  - Task queue with worker assignment, priority, status
  - SOP compliance checklists with progress tracking
  - Exception detection and management
  - KPI summary endpoint
"""
import uuid
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User

logger = logging.getLogger("intelli.ops.operations")

router = APIRouter(prefix="/ops/operations", tags=["IntelliOps - Operations"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TaskPriority(str, Enum):
    HIGH   = "high"
    MEDIUM = "medium"
    LOW    = "low"


class TaskStatus(str, Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED   = "completed"
    BLOCKED     = "blocked"
    CANCELLED   = "cancelled"


class ChecklistStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE    = "complete"
    OVERDUE     = "overdue"


class ExceptionType(str, Enum):
    COUNT_MISMATCH        = "count_mismatch"
    FIFO_VIOLATION        = "fifo_violation"
    DAMAGED_GOODS         = "damaged_goods"
    MISSING_DOCUMENTATION = "missing_documentation"
    SLA_BREACH            = "sla_breach"
    UNAUTHORIZED_ACCESS   = "unauthorized_access"
    EQUIPMENT_FAULT       = "equipment_fault"


class ExceptionStatus(str, Enum):
    OPEN         = "open"
    INVESTIGATING = "investigating"
    RESOLVED     = "resolved"
    ESCALATED    = "escalated"


# ---------------------------------------------------------------------------
# DB Models
# ---------------------------------------------------------------------------

class OpsTask(DBBaseModel):
    __tablename__ = "ops_tasks"

    title        = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    worker_name  = Column(String, nullable=True)
    worker_id    = Column(String, nullable=True)
    area         = Column(String, nullable=True)
    zone         = Column(String, nullable=True)
    priority     = Column(String, default=TaskPriority.MEDIUM, index=True)
    status       = Column(String, default=TaskStatus.PENDING, index=True)
    due_at       = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    incident_ref = Column(String, nullable=True)   # link to incident ID
    created_by   = Column(String, nullable=True)


class SOPChecklist(DBBaseModel):
    __tablename__ = "ops_sop_checklists"

    name         = Column(String, nullable=False)
    shift        = Column(String, nullable=True)   # e.g. "Shift A"
    zone         = Column(String, nullable=True)
    progress_pct = Column(Integer, default=0)      # 0-100
    status       = Column(String, default=ChecklistStatus.NOT_STARTED, index=True)
    assigned_to  = Column(String, nullable=True)
    due_at       = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    item_count   = Column(Integer, default=0)
    items_done   = Column(Integer, default=0)


class OpsException(DBBaseModel):
    __tablename__ = "ops_exceptions"

    exception_type = Column(String, nullable=False, index=True)
    location       = Column(String, nullable=True)
    zone           = Column(String, nullable=True)
    root_cause     = Column(String, nullable=True)
    description    = Column(Text, nullable=True)
    status         = Column(String, default=ExceptionStatus.OPEN, index=True)
    severity       = Column(String, default="medium")
    assigned_to    = Column(String, nullable=True)
    resolved_at    = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    sla_minutes    = Column(Integer, default=60)   # resolution SLA
    detected_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title:        str
    description:  Optional[str] = None
    worker_name:  Optional[str] = None
    worker_id:    Optional[str] = None
    area:         Optional[str] = None
    zone:         Optional[str] = None
    priority:     TaskPriority  = TaskPriority.MEDIUM
    due_at:       Optional[datetime] = None
    incident_ref: Optional[str] = None


class TaskUpdate(BaseModel):
    status:       Optional[TaskStatus] = None
    worker_name:  Optional[str] = None
    worker_id:    Optional[str] = None
    priority:     Optional[TaskPriority] = None


class TaskResponse(BaseModel):
    id:           uuid.UUID
    title:        str
    description:  Optional[str]
    worker_name:  Optional[str]
    area:         Optional[str]
    zone:         Optional[str]
    priority:     str
    status:       str
    due_at:       Optional[datetime]
    completed_at: Optional[datetime]
    incident_ref: Optional[str]
    created_at:   datetime
    model_config = ConfigDict(from_attributes=True)


class ChecklistCreate(BaseModel):
    name:        str
    shift:       Optional[str] = None
    zone:        Optional[str] = None
    assigned_to: Optional[str] = None
    item_count:  int = Field(default=1, ge=1)
    due_at:      Optional[datetime] = None


class ChecklistUpdate(BaseModel):
    items_done:  Optional[int] = None
    status:      Optional[ChecklistStatus] = None
    assigned_to: Optional[str] = None


class ChecklistResponse(BaseModel):
    id:           uuid.UUID
    name:         str
    shift:        Optional[str]
    zone:         Optional[str]
    progress_pct: int
    status:       str
    assigned_to:  Optional[str]
    item_count:   int
    items_done:   int
    due_at:       Optional[datetime]
    completed_at: Optional[datetime]
    created_at:   datetime
    model_config = ConfigDict(from_attributes=True)


class ExceptionCreate(BaseModel):
    exception_type: ExceptionType
    location:       Optional[str] = None
    zone:           Optional[str] = None
    root_cause:     Optional[str] = None
    description:    Optional[str] = None
    severity:       str = "medium"
    sla_minutes:    int = 60


class ExceptionUpdate(BaseModel):
    status:           Optional[ExceptionStatus] = None
    assigned_to:      Optional[str] = None
    resolution_notes: Optional[str] = None


class ExceptionResponse(BaseModel):
    id:               uuid.UUID
    exception_type:   str
    location:         Optional[str]
    zone:             Optional[str]
    root_cause:       Optional[str]
    description:      Optional[str]
    status:           str
    severity:         str
    assigned_to:      Optional[str]
    resolved_at:      Optional[datetime]
    resolution_notes: Optional[str]
    sla_minutes:      int
    detected_at:      datetime
    created_at:       datetime
    model_config = ConfigDict(from_attributes=True)


class OpsKPISummary(BaseModel):
    tasks_total:       int
    tasks_completed:   int
    tasks_in_progress: int
    tasks_pending:     int
    active_workers:    int
    sop_compliance_pct: float
    checklists_total:  int
    checklists_done:   int
    open_exceptions:   int
    exceptions_needing_escalation: int


# ---------------------------------------------------------------------------
# Task Endpoints
# ---------------------------------------------------------------------------

@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = OpsTask(**payload.model_dump(), created_by=str(current_user.id))
    db.add(task)
    await db.commit()
    await db.refresh(task)
    logger.info(f"Task created: {task.title} [{task.priority}]")
    return task


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    status:   Optional[str] = None,
    priority: Optional[str] = None,
    zone:     Optional[str] = None,
    limit:    int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(OpsTask)
    if status:   q = q.where(OpsTask.status == status)
    if priority: q = q.where(OpsTask.priority == priority)
    if zone:     q = q.where(OpsTask.zone == zone)
    result = await db.execute(q.order_by(OpsTask.created_at.desc()).limit(limit))
    return result.scalars().all()


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await db.get(OpsTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    if payload.status == TaskStatus.COMPLETED:
        task.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await db.get(OpsTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()


# ---------------------------------------------------------------------------
# SOP Checklist Endpoints
# ---------------------------------------------------------------------------

@router.post("/checklists", response_model=ChecklistResponse, status_code=201)
async def create_checklist(
    payload: ChecklistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checklist = SOPChecklist(**payload.model_dump())
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)
    return checklist


@router.get("/checklists", response_model=list[ChecklistResponse])
async def list_checklists(
    status: Optional[str] = None,
    zone:   Optional[str] = None,
    limit:  int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(SOPChecklist)
    if status: q = q.where(SOPChecklist.status == status)
    if zone:   q = q.where(SOPChecklist.zone == zone)
    result = await db.execute(q.order_by(SOPChecklist.created_at.desc()).limit(limit))
    return result.scalars().all()


@router.patch("/checklists/{checklist_id}", response_model=ChecklistResponse)
async def update_checklist(
    checklist_id: uuid.UUID,
    payload: ChecklistUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cl = await db.get(SOPChecklist, checklist_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Checklist not found")

    if payload.items_done is not None:
        cl.items_done = min(payload.items_done, cl.item_count)
        cl.progress_pct = int((cl.items_done / cl.item_count) * 100) if cl.item_count > 0 else 0
        if cl.items_done >= cl.item_count:
            cl.status = ChecklistStatus.COMPLETE
            cl.completed_at = datetime.now(timezone.utc)
        elif cl.items_done > 0:
            cl.status = ChecklistStatus.IN_PROGRESS

    if payload.status:
        cl.status = payload.status
    if payload.assigned_to:
        cl.assigned_to = payload.assigned_to

    await db.commit()
    await db.refresh(cl)
    return cl


# ---------------------------------------------------------------------------
# Exception Endpoints
# ---------------------------------------------------------------------------

@router.post("/exceptions", response_model=ExceptionResponse, status_code=201)
async def create_exception(
    payload: ExceptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exc = OpsException(**payload.model_dump())
    db.add(exc)
    await db.commit()
    await db.refresh(exc)
    logger.warning(f"Exception raised: {exc.exception_type} @ {exc.location}")
    return exc


@router.get("/exceptions", response_model=list[ExceptionResponse])
async def list_exceptions(
    status:         Optional[str] = None,
    exception_type: Optional[str] = None,
    limit:          int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(OpsException)
    if status:         q = q.where(OpsException.status == status)
    if exception_type: q = q.where(OpsException.exception_type == exception_type)
    result = await db.execute(q.order_by(OpsException.detected_at.desc()).limit(limit))
    return result.scalars().all()


@router.patch("/exceptions/{exc_id}", response_model=ExceptionResponse)
async def update_exception(
    exc_id: uuid.UUID,
    payload: ExceptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exc = await db.get(OpsException, exc_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(exc, field, value)
    if payload.status == ExceptionStatus.RESOLVED:
        exc.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(exc)
    return exc


# ---------------------------------------------------------------------------
# KPI Summary
# ---------------------------------------------------------------------------

@router.get("/kpis", response_model=OpsKPISummary)
async def get_ops_kpis(
    db: AsyncSession = Depends(get_db),
):
    """Aggregate KPI summary for the IntelliOps dashboard — single-pass queries."""
    from sqlalchemy import case

    # Single query: count tasks by status + distinct active workers
    task_agg = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((OpsTask.status == TaskStatus.COMPLETED, 1))).label("completed"),
            func.count(case((OpsTask.status == TaskStatus.IN_PROGRESS, 1))).label("in_progress"),
            func.count(case((OpsTask.status == TaskStatus.PENDING, 1))).label("pending"),
            func.count(
                case((
                    (OpsTask.status == TaskStatus.IN_PROGRESS) & OpsTask.worker_id.isnot(None),
                    OpsTask.worker_id
                ))
            ).label("active_workers"),
        ).select_from(OpsTask)
    )
    row = task_agg.one()
    tasks_total     = row.total or 0
    tasks_completed = row.completed or 0
    tasks_inprog    = row.in_progress or 0
    tasks_pending   = row.pending or 0
    active_workers  = row.active_workers or 0

    # Single query: count checklists + exceptions by status
    cl_exc_agg = await db.execute(
        select(
            func.count(case((SOPChecklist.id.isnot(None), 1))).label("cl_total"),
            func.count(case((SOPChecklist.status == ChecklistStatus.COMPLETE, 1))).label("cl_done"),
        ).select_from(SOPChecklist)
    )
    cl_row  = cl_exc_agg.one()
    cl_total = cl_row.cl_total or 0
    cl_done  = cl_row.cl_done or 0
    compliance = round((cl_done / cl_total) * 100, 1) if cl_total > 0 else 0.0

    exc_agg = await db.execute(
        select(
            func.count(case((OpsException.status.in_([ExceptionStatus.OPEN, ExceptionStatus.INVESTIGATING]), 1))).label("open_exc"),
            func.count(case((OpsException.status == ExceptionStatus.ESCALATED, 1))).label("escalated"),
        ).select_from(OpsException)
    )
    exc_row = exc_agg.one()

    return OpsKPISummary(
        tasks_total=tasks_total,
        tasks_completed=tasks_completed,
        tasks_in_progress=tasks_inprog,
        tasks_pending=tasks_pending,
        active_workers=active_workers,
        sop_compliance_pct=compliance,
        checklists_total=cl_total,
        checklists_done=cl_done,
        open_exceptions=exc_row.open_exc or 0,
        exceptions_needing_escalation=exc_row.escalated or 0,
    )
