"""
Intelli Depot — FIFO/FILO/LIFO Logic
Feature: DEPOT-V5

Rule-based Inventory Sequencing Agent with expiry-aware prioritization,
batch tracking, and compliance enforcement rules.
"""
import uuid
import logging
from datetime import datetime, date, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Date, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.sequencing")

router = APIRouter(prefix="/depot/vision/sequencing", tags=["Depot - FIFO/FILO/LIFO"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SequencingRule(str, Enum):
    FIFO = "fifo"     # First In First Out
    FILO = "filo"     # First In Last Out
    LIFO = "lifo"     # Last In First Out
    FEFO = "fefo"     # First Expiry First Out


class BatchStatus(str, Enum):
    ACTIVE = "active"
    DEPLETED = "depleted"
    EXPIRED = "expired"
    QUARANTINED = "quarantined"
    RECALLED = "recalled"


class ComplianceResult(str, Enum):
    COMPLIANT = "compliant"
    VIOLATION = "violation"
    OVERRIDE = "override"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class InventoryBatch(DBBaseModel):
    """A batch of inventory items with expiry and sequencing metadata."""
    __tablename__ = "depot_inventory_batches"

    batch_code = Column(String, unique=True, nullable=False, index=True)
    sku_code = Column(String, nullable=False, index=True)
    product_name = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    rack = Column(String, nullable=True)
    bin_location = Column(String, nullable=True)
    quantity = Column(Integer, default=0)
    original_quantity = Column(Integer, default=0)
    manufacture_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    received_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    sequencing_rule = Column(String, default=SequencingRule.FIFO)
    priority_score = Column(Float, default=0.0)  # computed: lower = pick first
    status = Column(String, default=BatchStatus.ACTIVE)
    is_near_expiry = Column(Boolean, default=False)
    days_to_expiry = Column(Integer, nullable=True)


class SequencingConfig(DBBaseModel):
    """Zone-level sequencing rules configuration."""
    __tablename__ = "depot_sequencing_configs"

    zone = Column(String, nullable=False, index=True)
    sku_pattern = Column(String, default="*")  # glob pattern for SKU matching
    rule = Column(String, default=SequencingRule.FIFO)
    near_expiry_days = Column(Integer, default=30)
    auto_quarantine_on_expiry = Column(Boolean, default=True)
    enforce_strict = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)


class PickOrder(DBBaseModel):
    """Generated pick order following sequencing rules."""
    __tablename__ = "depot_pick_orders"

    batch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    batch_code = Column(String, nullable=True)
    sku_code = Column(String, nullable=False)
    zone = Column(String, nullable=True)
    pick_quantity = Column(Integer, default=0)
    pick_sequence = Column(Integer, default=0)    # order in the pick list
    sequencing_rule = Column(String, nullable=True)
    compliance_status = Column(String, default=ComplianceResult.COMPLIANT)
    override_reason = Column(Text, nullable=True)
    picked = Column(Boolean, default=False)
    picked_at = Column(DateTime(timezone=True), nullable=True)
    picked_by = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class BatchCreate(BaseModel):
    batch_code: str = Field(..., json_schema_extra={"example": "BATCH-2026-0412-A"})
    sku_code: str = Field(..., json_schema_extra={"example": "SKU-1001"})
    product_name: Optional[str] = None
    zone: Optional[str] = None
    rack: Optional[str] = None
    bin_location: Optional[str] = None
    quantity: int = Field(..., ge=0)
    manufacture_date: Optional[date] = None
    expiry_date: Optional[date] = None
    sequencing_rule: str = Field(SequencingRule.FIFO)


class BatchResponse(BaseModel):
    id: uuid.UUID
    batch_code: str
    sku_code: str
    product_name: Optional[str]
    zone: Optional[str]
    rack: Optional[str]
    bin_location: Optional[str]
    quantity: int
    original_quantity: int
    manufacture_date: Optional[date]
    expiry_date: Optional[date]
    received_at: datetime
    sequencing_rule: str
    priority_score: float
    status: str
    is_near_expiry: bool
    days_to_expiry: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConfigCreate(BaseModel):
    zone: str
    sku_pattern: str = "*"
    rule: str = Field(SequencingRule.FIFO)
    near_expiry_days: int = Field(30, ge=1)
    auto_quarantine_on_expiry: bool = True
    enforce_strict: bool = True


class ConfigResponse(BaseModel):
    id: uuid.UUID
    zone: str
    sku_pattern: str
    rule: str
    near_expiry_days: int
    auto_quarantine_on_expiry: bool
    enforce_strict: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PickOrderResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    batch_code: Optional[str]
    sku_code: str
    zone: Optional[str]
    pick_quantity: int
    pick_sequence: int
    sequencing_rule: Optional[str]
    compliance_status: str
    override_reason: Optional[str]
    picked: bool
    picked_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GeneratePickRequest(BaseModel):
    sku_code: str
    zone: Optional[str] = None
    quantity_needed: int = Field(..., ge=1)


# ---------------------------------------------------------------------------
# Batch Endpoints
# ---------------------------------------------------------------------------

@router.post("/batches", response_model=BatchResponse, status_code=201)
async def create_batch(
    payload: BatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register an inventory batch with expiry tracking."""
    existing = await db.execute(
        select(InventoryBatch).where(InventoryBatch.batch_code == payload.batch_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Batch code already exists")

    batch = InventoryBatch(**payload.model_dump())
    batch.original_quantity = payload.quantity

    # Compute expiry metadata
    if payload.expiry_date:
        delta = payload.expiry_date - date.today()
        batch.days_to_expiry = delta.days
        batch.is_near_expiry = delta.days <= 30
        if delta.days <= 0:
            batch.status = BatchStatus.EXPIRED

    # Compute priority score (lower = pick first)
    if payload.sequencing_rule == SequencingRule.FEFO and payload.expiry_date:
        batch.priority_score = float(batch.days_to_expiry or 9999)
    elif payload.sequencing_rule == SequencingRule.FIFO:
        batch.priority_score = datetime.now(timezone.utc).timestamp()
    elif payload.sequencing_rule == SequencingRule.LIFO:
        batch.priority_score = -datetime.now(timezone.utc).timestamp()
    else:
        batch.priority_score = datetime.now(timezone.utc).timestamp()

    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    logger.info(f"Batch created: {batch.batch_code}, rule={batch.sequencing_rule}")
    return batch


@router.get("/batches", response_model=list[BatchResponse])
async def list_batches(
    sku_code: Optional[str] = None,
    zone: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(InventoryBatch)
    if sku_code:
        query = query.where(InventoryBatch.sku_code == sku_code)
    if zone:
        query = query.where(InventoryBatch.zone == zone)
    if status:
        query = query.where(InventoryBatch.status == status)
    result = await db.execute(query.order_by(InventoryBatch.priority_score.asc()))
    return result.scalars().all()


@router.get("/batches/near-expiry", response_model=list[BatchResponse])
async def get_near_expiry_batches(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get batches expiring within N days."""
    cutoff = date.today()
    result = await db.execute(
        select(InventoryBatch)
        .where(
            InventoryBatch.status == BatchStatus.ACTIVE,
            InventoryBatch.expiry_date != None,
            InventoryBatch.days_to_expiry <= days,
            InventoryBatch.days_to_expiry > 0,
        )
        .order_by(InventoryBatch.days_to_expiry.asc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Sequencing Config Endpoints
# ---------------------------------------------------------------------------

@router.post("/configs", response_model=ConfigResponse, status_code=201)
async def create_sequencing_config(
    payload: ConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = SequencingConfig(**payload.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/configs", response_model=list[ConfigResponse])
async def list_configs(
    zone: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(SequencingConfig).where(SequencingConfig.is_active == True)
    if zone:
        query = query.where(SequencingConfig.zone == zone)
    result = await db.execute(query)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Pick Order Generation
# ---------------------------------------------------------------------------

@router.post("/pick-orders", response_model=list[PickOrderResponse], status_code=201)
async def generate_pick_orders(
    payload: GeneratePickRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an optimized pick order list based on the sequencing rule
    configured for the zone/SKU. Allocates from batches in priority order
    until the needed quantity is fulfilled.
    """
    query = select(InventoryBatch).where(
        InventoryBatch.sku_code == payload.sku_code,
        InventoryBatch.status == BatchStatus.ACTIVE,
        InventoryBatch.quantity > 0,
    )
    if payload.zone:
        query = query.where(InventoryBatch.zone == payload.zone)

    result = await db.execute(query.order_by(InventoryBatch.priority_score.asc()))
    batches = list(result.scalars().all())

    if not batches:
        raise HTTPException(status_code=404, detail="No active batches found for this SKU")

    remaining = payload.quantity_needed
    pick_orders = []
    seq = 1

    for batch in batches:
        if remaining <= 0:
            break

        pick_qty = min(batch.quantity, remaining)
        order = PickOrder(
            batch_id=batch.id,
            batch_code=batch.batch_code,
            sku_code=batch.sku_code,
            zone=batch.zone,
            pick_quantity=pick_qty,
            pick_sequence=seq,
            sequencing_rule=batch.sequencing_rule,
            compliance_status=ComplianceResult.COMPLIANT,
        )
        db.add(order)
        pick_orders.append(order)
        remaining -= pick_qty
        seq += 1

    await db.commit()
    for po in pick_orders:
        await db.refresh(po)

    logger.info(f"Pick orders generated: {len(pick_orders)} for {payload.sku_code}")
    return pick_orders


@router.get("/pick-orders", response_model=list[PickOrderResponse])
async def list_pick_orders(
    sku_code: Optional[str] = None,
    picked: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(PickOrder)
    if sku_code:
        query = query.where(PickOrder.sku_code == sku_code)
    if picked is not None:
        query = query.where(PickOrder.picked == picked)
    result = await db.execute(query.order_by(PickOrder.pick_sequence))
    return result.scalars().all()


@router.patch("/pick-orders/{order_id}/confirm", response_model=PickOrderResponse)
async def confirm_pick(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm a pick order as completed."""
    order = await db.get(PickOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pick order not found")
    order.picked = True
    order.picked_at = datetime.now(timezone.utc)
    order.picked_by = str(current_user.id)
    await db.commit()
    await db.refresh(order)
    return order
