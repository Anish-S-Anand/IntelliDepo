"""
Intelli Depot — LPR & Gate Control
Feature: DEPOT-V6

OCR plate recognition, gate open/close trigger API, vehicle registry sync,
and blacklist matching service.
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
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User

logger = logging.getLogger("intelli.depot.gate")

router = APIRouter(prefix="/depot/gate", tags=["Depot - Gate & LPR"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class GateStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class AccessDecision(str, Enum):
    GRANTED = "granted"
    DENIED = "denied"
    PENDING = "pending"
    BLACKLISTED = "blacklisted"


class VehicleStatus(str, Enum):
    REGISTERED = "registered"
    BLACKLISTED = "blacklisted"
    TEMPORARY = "temporary"
    EXPIRED = "expired"


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class Gate(DBBaseModel):
    """Physical gate at the depot."""
    __tablename__ = "depot_gates"

    gate_code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    gate_type = Column(String, default="entry")  # entry, exit, both
    camera_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String, default=GateStatus.CLOSED)
    is_active = Column(Boolean, default=True)
    last_opened = Column(DateTime(timezone=True), nullable=True)
    last_closed = Column(DateTime(timezone=True), nullable=True)
    total_entries_today = Column(Integer, default=0)


class VehicleRegistry(DBBaseModel):
    """Registry of known vehicles."""
    __tablename__ = "depot_vehicle_registry"

    plate_number = Column(String, unique=True, nullable=False, index=True)
    vehicle_type = Column(String, nullable=True)  # truck, van, car, forklift
    owner_name = Column(String, nullable=True)
    company = Column(String, nullable=True)
    status = Column(String, default=VehicleStatus.REGISTERED)
    blacklist_reason = Column(Text, nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)


class GateAccessLog(DBBaseModel):
    """Immutable log of gate access events."""
    __tablename__ = "depot_gate_access_logs"

    gate_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    gate_code = Column(String, nullable=True)
    plate_number = Column(String, nullable=False, index=True)
    plate_confidence = Column(Float, default=0.0)
    vehicle_id = Column(UUID(as_uuid=True), nullable=True)
    decision = Column(String, default=AccessDecision.PENDING)
    direction = Column(String, default="entry")  # entry / exit
    snapshot_ref = Column(String, nullable=True)
    ocr_raw = Column(String, nullable=True)  # raw OCR output before normalization
    denied_reason = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class GateCreate(BaseModel):
    gate_code: str = Field(..., json_schema_extra={"example": "GATE-01"})
    name: str = Field(..., json_schema_extra={"example": "Main Entry Gate"})
    gate_type: str = Field("entry")
    camera_id: Optional[uuid.UUID] = None


class GateResponse(BaseModel):
    id: uuid.UUID
    gate_code: str
    name: str
    gate_type: str
    camera_id: Optional[uuid.UUID]
    status: str
    is_active: bool
    last_opened: Optional[datetime]
    last_closed: Optional[datetime]
    total_entries_today: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VehicleCreate(BaseModel):
    plate_number: str = Field(..., json_schema_extra={"example": "KA-12-AB-3456"})
    vehicle_type: Optional[str] = None
    owner_name: Optional[str] = None
    company: Optional[str] = None
    status: str = Field(VehicleStatus.REGISTERED)
    valid_until: Optional[datetime] = None


class VehicleResponse(BaseModel):
    id: uuid.UUID
    plate_number: str
    vehicle_type: Optional[str]
    owner_name: Optional[str]
    company: Optional[str]
    status: str
    blacklist_reason: Optional[str]
    valid_until: Optional[datetime]
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LPRScanRequest(BaseModel):
    """Simulates an OCR scan of a license plate at a gate."""
    gate_id: uuid.UUID
    plate_number: str = Field(..., json_schema_extra={"example": "KA-12-AB-3456"})
    confidence: float = Field(0.95, ge=0.0, le=1.0)
    direction: str = Field("entry")
    snapshot_ref: Optional[str] = None


class AccessLogResponse(BaseModel):
    id: uuid.UUID
    gate_id: uuid.UUID
    gate_code: Optional[str]
    plate_number: str
    plate_confidence: float
    vehicle_id: Optional[uuid.UUID]
    decision: str
    direction: str
    denied_reason: Optional[str]
    processed_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GateActionRequest(BaseModel):
    action: str = Field(..., description="open or close")


# ---------------------------------------------------------------------------
# Gate Endpoints
# ---------------------------------------------------------------------------

@router.post("/gates", response_model=GateResponse, status_code=201)
async def create_gate(
    payload: GateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(Gate).where(Gate.gate_code == payload.gate_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Gate code already exists")

    gate = Gate(**payload.model_dump())
    db.add(gate)
    await db.commit()
    await db.refresh(gate)
    logger.info(f"Gate created: {gate.gate_code}")
    return gate


@router.get("/gates", response_model=list[GateResponse])
async def list_gates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Gate).where(Gate.is_active == True).order_by(Gate.gate_code)
    )
    return result.scalars().all()


@router.post("/gates/{gate_id}/action", response_model=GateResponse)
async def gate_action(
    gate_id: uuid.UUID,
    payload: GateActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Open or close a gate."""
    gate = await db.get(Gate, gate_id)
    if not gate or not gate.is_active:
        raise HTTPException(status_code=404, detail="Gate not found")

    if payload.action == "open":
        gate.status = GateStatus.OPEN
        gate.last_opened = datetime.now(timezone.utc)
    elif payload.action == "close":
        gate.status = GateStatus.CLOSED
        gate.last_closed = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="Action must be 'open' or 'close'")

    await db.commit()
    await db.refresh(gate)
    logger.info(f"Gate {gate.gate_code}: {payload.action}")
    return gate


# ---------------------------------------------------------------------------
# Vehicle Registry Endpoints
# ---------------------------------------------------------------------------

@router.post("/vehicles", response_model=VehicleResponse, status_code=201)
async def register_vehicle(
    payload: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(VehicleRegistry).where(VehicleRegistry.plate_number == payload.plate_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Vehicle already registered")

    vehicle = VehicleRegistry(**payload.model_dump())
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


@router.get("/vehicles", response_model=list[VehicleResponse])
async def list_vehicles(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(VehicleRegistry).where(VehicleRegistry.is_active == True)
    if status:
        query = query.where(VehicleRegistry.status == status)
    result = await db.execute(query.order_by(VehicleRegistry.plate_number))
    return result.scalars().all()


@router.patch("/vehicles/{vehicle_id}/blacklist", response_model=VehicleResponse)
async def blacklist_vehicle(
    vehicle_id: uuid.UUID,
    reason: str = "Security concern",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = await db.get(VehicleRegistry, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.status = VehicleStatus.BLACKLISTED
    vehicle.blacklist_reason = reason
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


# ---------------------------------------------------------------------------
# LPR Scan & Access Control
# ---------------------------------------------------------------------------

@router.post("/lpr/scan", response_model=AccessLogResponse, status_code=201)
async def process_lpr_scan(
    payload: LPRScanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Process an LPR (License Plate Recognition) scan event.
    Checks the vehicle registry, applies blacklist matching, and triggers
    gate open/close based on the access decision.
    """
    gate = await db.get(Gate, payload.gate_id)
    if not gate or not gate.is_active:
        raise HTTPException(status_code=404, detail="Gate not found")

    # Lookup vehicle in registry
    veh_result = await db.execute(
        select(VehicleRegistry).where(VehicleRegistry.plate_number == payload.plate_number)
    )
    vehicle = veh_result.scalar_one_or_none()

    decision = AccessDecision.GRANTED
    denied_reason = None
    vehicle_id = None

    if vehicle:
        vehicle_id = vehicle.id
        if vehicle.status == VehicleStatus.BLACKLISTED:
            decision = AccessDecision.BLACKLISTED
            denied_reason = f"Blacklisted: {vehicle.blacklist_reason}"
        elif vehicle.status == VehicleStatus.EXPIRED:
            decision = AccessDecision.DENIED
            denied_reason = "Vehicle registration expired"
    else:
        # Unknown vehicle — deny by default (can be configured)
        decision = AccessDecision.DENIED
        denied_reason = "Vehicle not registered"

    # Low-confidence OCR — flag for manual review
    if payload.confidence < 0.85:
        decision = AccessDecision.PENDING
        denied_reason = f"Low OCR confidence: {payload.confidence}"

    # Log the access event
    log = GateAccessLog(
        gate_id=gate.id,
        gate_code=gate.gate_code,
        plate_number=payload.plate_number,
        plate_confidence=payload.confidence,
        vehicle_id=vehicle_id,
        decision=decision,
        direction=payload.direction,
        snapshot_ref=payload.snapshot_ref,
        denied_reason=denied_reason,
    )
    db.add(log)

    # Auto-open gate if granted
    if decision == AccessDecision.GRANTED:
        gate.status = GateStatus.OPEN
        gate.last_opened = datetime.now(timezone.utc)
        gate.total_entries_today += 1

    await db.commit()
    await db.refresh(log)
    logger.info(f"LPR scan at {gate.gate_code}: {payload.plate_number} -> {decision}")
    return log


@router.get("/access-logs", response_model=list[AccessLogResponse])
async def list_access_logs(
    gate_id: Optional[uuid.UUID] = None,
    decision: Optional[str] = None,
    plate_number: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(GateAccessLog)
    if gate_id:
        query = query.where(GateAccessLog.gate_id == gate_id)
    if decision:
        query = query.where(GateAccessLog.decision == decision)
    if plate_number:
        query = query.where(GateAccessLog.plate_number == plate_number)
    result = await db.execute(query.order_by(GateAccessLog.processed_at.desc()).limit(limit))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Visitor Registration & Management (F-025)
# ---------------------------------------------------------------------------

class VisitorStatus(str, Enum):
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    EXPIRED = "expired"


class Visitor(DBBaseModel):
    """Visitor registration record."""
    __tablename__ = "depot_visitors"

    name = Column(String, nullable=False)
    company = Column(String, nullable=True)
    purpose = Column(String, nullable=True)
    contact_number = Column(String, nullable=True)
    id_proof_type = Column(String, nullable=True)
    id_proof_number = Column(String, nullable=True)
    vehicle_plate = Column(String, nullable=True, index=True)
    host_name = Column(String, nullable=True)
    gate_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    checked_in_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    pass_valid_until = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default=VisitorStatus.CHECKED_IN)
    registered_by = Column(String, nullable=True)


class VisitorCreate(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Rajesh Kumar"})
    company: Optional[str] = Field(None, json_schema_extra={"example": "ABC Logistics"})
    purpose: Optional[str] = Field(None, json_schema_extra={"example": "Delivery pickup"})
    contact_number: Optional[str] = None
    id_proof_type: Optional[str] = Field(None, json_schema_extra={"example": "Aadhar"})
    id_proof_number: Optional[str] = None
    vehicle_plate: Optional[str] = Field(None, json_schema_extra={"example": "KA-01-CD-5678"})
    host_name: Optional[str] = None
    gate_id: Optional[uuid.UUID] = None
    pass_valid_hours: int = Field(8, ge=1, le=72, description="Pass validity in hours")


class VisitorResponse(BaseModel):
    id: uuid.UUID
    name: str
    company: Optional[str]
    purpose: Optional[str]
    contact_number: Optional[str]
    id_proof_type: Optional[str]
    id_proof_number: Optional[str]
    vehicle_plate: Optional[str]
    host_name: Optional[str]
    gate_id: Optional[uuid.UUID]
    checked_in_at: datetime
    checked_out_at: Optional[datetime]
    pass_valid_until: Optional[datetime]
    status: str
    registered_by: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post("/visitors", response_model=VisitorResponse, status_code=201)
async def register_visitor(
    payload: VisitorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a visitor and issue a temporary pass.
    If a vehicle plate is provided, auto-registers it as a temporary vehicle.
    """
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    visitor = Visitor(
        name=payload.name,
        company=payload.company,
        purpose=payload.purpose,
        contact_number=payload.contact_number,
        id_proof_type=payload.id_proof_type,
        id_proof_number=payload.id_proof_number,
        vehicle_plate=payload.vehicle_plate,
        host_name=payload.host_name,
        gate_id=payload.gate_id,
        checked_in_at=now,
        pass_valid_until=now + timedelta(hours=payload.pass_valid_hours),
        status=VisitorStatus.CHECKED_IN,
        registered_by=str(current_user.id),
    )
    db.add(visitor)

    # Auto-register vehicle as temporary if plate provided
    if payload.vehicle_plate:
        existing = await db.execute(
            select(VehicleRegistry).where(VehicleRegistry.plate_number == payload.vehicle_plate)
        )
        if not existing.scalar_one_or_none():
            temp_vehicle = VehicleRegistry(
                plate_number=payload.vehicle_plate,
                vehicle_type="visitor",
                owner_name=payload.name,
                company=payload.company,
                status=VehicleStatus.TEMPORARY,
                valid_until=now + timedelta(hours=payload.pass_valid_hours),
            )
            db.add(temp_vehicle)

    await db.commit()
    await db.refresh(visitor)
    logger.info(f"Visitor registered: {visitor.name} ({visitor.company})")
    return visitor


@router.get("/visitors", response_model=list[VisitorResponse])
async def list_visitors(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List visitors with optional status filter."""
    query = select(Visitor)
    if status:
        query = query.where(Visitor.status == status)
    result = await db.execute(query.order_by(Visitor.checked_in_at.desc()))
    return result.scalars().all()


@router.get("/visitors/active", response_model=list[VisitorResponse])
async def get_active_visitors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all currently checked-in visitors."""
    result = await db.execute(
        select(Visitor)
        .where(Visitor.status == VisitorStatus.CHECKED_IN)
        .order_by(Visitor.checked_in_at.desc())
    )
    return result.scalars().all()


@router.patch("/visitors/{visitor_id}/checkout", response_model=VisitorResponse)
async def checkout_visitor(
    visitor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check out a visitor and expire their temporary vehicle pass."""
    visitor = await db.get(Visitor, visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    if visitor.status == VisitorStatus.CHECKED_OUT:
        raise HTTPException(status_code=409, detail="Visitor already checked out")

    visitor.status = VisitorStatus.CHECKED_OUT
    visitor.checked_out_at = datetime.now(timezone.utc)

    # Expire temporary vehicle
    if visitor.vehicle_plate:
        veh_result = await db.execute(
            select(VehicleRegistry).where(
                VehicleRegistry.plate_number == visitor.vehicle_plate,
                VehicleRegistry.status == VehicleStatus.TEMPORARY,
            )
        )
        temp_vehicle = veh_result.scalar_one_or_none()
        if temp_vehicle:
            temp_vehicle.status = VehicleStatus.EXPIRED

    await db.commit()
    await db.refresh(visitor)
    logger.info(f"Visitor checked out: {visitor.name}")
    return visitor
