"""SLA CRUD API + Operator acknowledge + audit log — Day 2 (F-059) Keerthi / Pranisree"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.stream.macropulse.ingestion.db.session import AsyncSessionLocal
from app.stream.macropulse.sla.models import SLADefinition, SLAEvent
from app.stream.macropulse.sla.schemas import (
    BreachPrediction,
    SLAApprove,
    SLACreate,
    SLAEventCreate,
    SLAEventResponse,
    SLAResponse,
    SLAUpdate,
)
from app.stream.macropulse.sla.breach_predictor import predict_breach

router = APIRouter(prefix="/sla", tags=["sla"])


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("", response_model=SLAResponse, status_code=201)
async def create_sla(body: SLACreate) -> SLAResponse:
    async with AsyncSessionLocal() as session:
        sla = SLADefinition(**body.model_dump())
        session.add(sla)
        await session.commit()
        await session.refresh(sla)
        return SLAResponse.model_validate(sla)


@router.get("", response_model=List[SLAResponse])
async def list_slas(tenant_id: str, active_only: bool = False) -> List[SLAResponse]:
    async with AsyncSessionLocal() as session:
        q = select(SLADefinition).where(
            SLADefinition.tenant_id == tenant_id,
            SLADefinition.is_deleted.is_(False),
        )
        if active_only:
            q = q.where(SLADefinition.is_active.is_(True))
        result = await session.execute(q)
        rows = result.scalars().all()
        return [SLAResponse.model_validate(r) for r in rows]


@router.get("/{sla_id}", response_model=SLAResponse)
async def get_sla(sla_id: str) -> SLAResponse:
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        return SLAResponse.model_validate(sla)


@router.patch("/{sla_id}", response_model=SLAResponse)
async def update_sla(sla_id: str, body: SLAUpdate) -> SLAResponse:
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(sla, field, value)
        sla.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(sla)
        return SLAResponse.model_validate(sla)


@router.delete("/{sla_id}", status_code=204, response_model=None)
async def delete_sla(sla_id: str) -> None:
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        sla.is_deleted = True
        sla.updated_at = datetime.now(timezone.utc)
        await session.commit()


@router.post("/{sla_id}/approve", response_model=SLAResponse)
async def approve_sla(sla_id: str, body: SLAApprove) -> SLAResponse:
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        sla.approved_by = body.approved_by
        sla.approved_at = datetime.now(timezone.utc)
        sla.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(sla)
        return SLAResponse.model_validate(sla)


# ── Operator acknowledge + audit log (Pranisree) ──────────────────────────────

@router.post("/{sla_id}/events/acknowledge", response_model=SLAEventResponse, status_code=201)
async def acknowledge_sla_event(sla_id: str, body: SLAEventCreate) -> SLAEventResponse:
    """POST /events/:id/acknowledge — persists operator ID, timestamp, notes to TimescaleDB."""
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        event = SLAEvent(
            sla_id=sla.id,
            tenant_id=sla.tenant_id,
            event_type="acknowledged",
            operator_id=body.operator_id,
            notes=body.notes,
            alert_id=body.alert_id,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        return SLAEventResponse.model_validate(event)


@router.post("/{sla_id}/events/escalate", response_model=SLAEventResponse, status_code=201)
async def escalate_sla_event(sla_id: str, body: SLAEventCreate) -> SLAEventResponse:
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        event = SLAEvent(
            sla_id=sla.id,
            tenant_id=sla.tenant_id,
            event_type="escalated",
            operator_id=body.operator_id,
            notes=body.notes,
            alert_id=body.alert_id,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        return SLAEventResponse.model_validate(event)


@router.get("/{sla_id}/events", response_model=List[SLAEventResponse])
async def get_sla_audit_log(sla_id: str) -> List[SLAEventResponse]:
    async with AsyncSessionLocal() as session:
        q = select(SLAEvent).where(SLAEvent.sla_id == uuid.UUID(sla_id)).order_by(SLAEvent.created_at.desc())
        result = await session.execute(q)
        rows = result.scalars().all()
        return [SLAEventResponse.model_validate(r) for r in rows]


# ── Breach prediction (F-060) ─────────────────────────────────────────────────

@router.get("/{sla_id}/breach-prediction", response_model=BreachPrediction)
async def get_breach_prediction(sla_id: str) -> BreachPrediction:
    async with AsyncSessionLocal() as session:
        sla = await session.get(SLADefinition, uuid.UUID(sla_id))
        if not sla or sla.is_deleted:
            raise HTTPException(status_code=404, detail="SLA not found")
        return await predict_breach(sla)


@router.get("/breach-predictions/at-risk", response_model=List[BreachPrediction])
async def get_at_risk_slas(tenant_id: str) -> List[BreachPrediction]:
    """Returns all active SLAs with breach_probability >= threshold — powers the at-risk list UI."""
    async with AsyncSessionLocal() as session:
        q = select(SLADefinition).where(
            SLADefinition.tenant_id == tenant_id,
            SLADefinition.is_active.is_(True),
            SLADefinition.is_deleted.is_(False),
        )
        result = await session.execute(q)
        slas = result.scalars().all()
        predictions = [await predict_breach(s) for s in slas]
        return [p for p in predictions if p.escalation_status != "ok"]
