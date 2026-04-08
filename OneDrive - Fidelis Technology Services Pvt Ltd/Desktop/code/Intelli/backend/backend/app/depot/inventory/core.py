"""
Intelli Depot — Inventory Management Core
Feature: DEPOT-INV1

SKU management, stock levels, location tracking, and barcode/QR support.

Dependency note: AUTH-6.2 (RBAC) is not yet BUILT.
Permission checks use a lightweight stub `require_permission()` that will be
replaced with the real RBAC engine once AUTH-6.2 is merged.
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
from sqlalchemy import select

from app.database import BaseModel as DBBaseModel, get_db
from app.core.auth.dependencies import get_current_user, require_permission
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.inventory")

router = APIRouter(prefix="/depot/inventory", tags=["Depot - Inventory"])




# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class StockStatus(str, Enum):
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    RESERVED = "reserved"
    DAMAGED = "damaged"


class BarcodeType(str, Enum):
    QR = "qr"
    EAN13 = "ean13"
    CODE128 = "code128"
    DATAMATRIX = "datamatrix"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class SKU(DBBaseModel):
    """Stock Keeping Unit — core product/item definition."""
    __tablename__ = "depot_skus"

    sku_code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    unit_of_measure = Column(String, default="unit")
    weight_kg = Column(Float, nullable=True)
    dimensions_cm = Column(String, nullable=True)
    barcode = Column(String, nullable=True, index=True)
    barcode_type = Column(String, default=BarcodeType.EAN13)
    is_active = Column(Boolean, default=True)


class InventoryItem(DBBaseModel):
    """Tracks stock levels and physical location of a SKU."""
    __tablename__ = "depot_inventory"

    sku_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    zone = Column(String, nullable=False)
    rack = Column(String, nullable=True)
    bin_location = Column(String, nullable=True)
    quantity = Column(Integer, default=0, nullable=False)
    reserved_quantity = Column(Integer, default=0)
    reorder_level = Column(Integer, default=10)
    max_capacity = Column(Integer, nullable=True)
    status = Column(String, default=StockStatus.IN_STOCK)
    last_counted_at = Column(DateTime(timezone=True), nullable=True)


class StockMovement(DBBaseModel):
    """Immutable log of every stock in/out event."""
    __tablename__ = "depot_stock_movements"

    sku_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    movement_type = Column(String, nullable=False)   # IN, OUT, ADJUST, TRANSFER
    quantity = Column(Integer, nullable=False)
    from_location = Column(String, nullable=True)
    to_location = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    performed_by = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class SKUCreate(BaseModel):
    sku_code: str = Field(..., json_schema_extra={"example": "SKU-10023"})
    name: str = Field(..., json_schema_extra={"example": "Industrial Gloves"})
    description: Optional[str] = None
    category: Optional[str] = Field(None, json_schema_extra={"example": "Safety Equipment"})
    unit_of_measure: str = Field("unit")
    weight_kg: Optional[float] = None
    dimensions_cm: Optional[str] = None
    barcode: Optional[str] = None
    barcode_type: BarcodeType = BarcodeType.EAN13


class SKUResponse(BaseModel):
    id: uuid.UUID
    sku_code: str
    name: str
    description: Optional[str]
    category: Optional[str]
    unit_of_measure: str
    weight_kg: Optional[float]
    barcode: Optional[str]
    barcode_type: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemCreate(BaseModel):
    sku_id: uuid.UUID
    zone: str = Field(..., json_schema_extra={"example": "Zone-A"})
    rack: Optional[str] = Field(None, json_schema_extra={"example": "R-12"})
    bin_location: Optional[str] = Field(None, json_schema_extra={"example": "B-04"})
    quantity: int = Field(0, ge=0)
    reorder_level: int = Field(10, ge=0)
    max_capacity: Optional[int] = None


class InventoryItemResponse(BaseModel):
    id: uuid.UUID
    sku_id: uuid.UUID
    zone: str
    rack: Optional[str]
    bin_location: Optional[str]
    quantity: int
    reserved_quantity: int
    reorder_level: int
    max_capacity: Optional[int]
    status: str
    last_counted_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockAdjustment(BaseModel):
    quantity_delta: int = Field(..., description="Positive = stock in, Negative = stock out")
    movement_type: str = Field("ADJUST", json_schema_extra={"example": "IN"})
    reference: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    sku_id: uuid.UUID
    movement_type: str
    quantity: int
    from_location: Optional[str]
    to_location: Optional[str]
    reference: Optional[str]
    performed_by: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_status(item: InventoryItem) -> str:
    available = item.quantity - (item.reserved_quantity or 0)
    if available <= 0:
        return StockStatus.OUT_OF_STOCK
    if available <= item.reorder_level:
        return StockStatus.LOW_STOCK
    return StockStatus.IN_STOCK


def _location_label(item: InventoryItem) -> str:
    parts = [item.zone]
    if item.rack:
        parts.append(item.rack)
    if item.bin_location:
        parts.append(item.bin_location)
    return " / ".join(parts)


# ---------------------------------------------------------------------------
# SKU Endpoints
# ---------------------------------------------------------------------------

@router.post("/skus", response_model=SKUResponse, status_code=201)
async def create_sku(
    payload: SKUCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new SKU."""
    existing = await db.execute(select(SKU).where(SKU.sku_code == payload.sku_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"SKU '{payload.sku_code}' already exists")
    sku = SKU(**payload.model_dump())
    db.add(sku)
    await db.commit()
    await db.refresh(sku)
    return sku


@router.get("/skus", response_model=list[SKUResponse])
async def list_skus(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active SKUs."""
    query = select(SKU).where(SKU.is_active == True)
    if category:
        query = query.where(SKU.category == category)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/skus/barcode/{barcode}", response_model=SKUResponse)
async def lookup_by_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Look up a SKU by barcode or QR code."""
    result = await db.execute(select(SKU).where(SKU.barcode == barcode, SKU.is_active == True))
    sku = result.scalar_one_or_none()
    if not sku:
        raise HTTPException(status_code=404, detail="No SKU found for this barcode")
    return sku


@router.get("/skus/{sku_id}", response_model=SKUResponse)
async def get_sku(
    sku_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sku = await db.get(SKU, sku_id)
    if not sku or not sku.is_active:
        raise HTTPException(status_code=404, detail="SKU not found")
    return sku


# ---------------------------------------------------------------------------
# Inventory Endpoints
# ---------------------------------------------------------------------------

@router.post("/items", response_model=InventoryItemResponse, status_code=201)
async def add_inventory_item(
    payload: InventoryItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a SKU to a warehouse location with initial stock."""
    sku = await db.get(SKU, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    item = InventoryItem(**payload.model_dump())
    item.status = _compute_status(item)
    db.add(item)
    if payload.quantity > 0:
        db.add(StockMovement(
            sku_id=payload.sku_id,
            movement_type="IN",
            quantity=payload.quantity,
            to_location=_location_label(item),
            performed_by=str(current_user.id),
        ))
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/items", response_model=list[InventoryItemResponse])
async def list_inventory(
    zone: Optional[str] = None,
    status: Optional[StockStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all inventory items."""
    query = select(InventoryItem)
    if zone:
        query = query.where(InventoryItem.zone == zone)
    if status:
        query = query.where(InventoryItem.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/{item_id}/adjust", response_model=InventoryItemResponse)
async def adjust_stock(
    item_id: uuid.UUID,
    payload: StockAdjustment,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adjust stock quantity (positive = in, negative = out)."""
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    new_qty = item.quantity + payload.quantity_delta
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Stock cannot go below zero")
    item.quantity = new_qty
    item.status = _compute_status(item)
    db.add(StockMovement(
        sku_id=item.sku_id,
        movement_type=payload.movement_type,
        quantity=abs(payload.quantity_delta),
        from_location=_location_label(item) if payload.quantity_delta < 0 else None,
        to_location=_location_label(item) if payload.quantity_delta > 0 else None,
        reference=payload.reference,
        performed_by=str(current_user.id),
    ))
    await db.commit()
    await db.refresh(item)
    if item.status in (StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK):
        logger.warning(f"Stock alert: SKU {item.sku_id} at {_location_label(item)} — {item.status}")
    return item


@router.get("/skus/{sku_id}/movements", response_model=list[StockMovementResponse])
async def get_movement_history(
    sku_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get stock movement history for a SKU."""
    result = await db.execute(
        select(StockMovement)
        .where(StockMovement.sku_id == sku_id)
        .order_by(StockMovement.created_at.desc())
    )
    return result.scalars().all()


@router.get("/reports/low-stock", response_model=list[InventoryItemResponse])
async def low_stock_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all items at or below reorder level."""
    result = await db.execute(
        select(InventoryItem).where(
            InventoryItem.status.in_([StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK])
        )
    )
    return result.scalars().all()
