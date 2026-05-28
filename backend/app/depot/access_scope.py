"""Role and warehouse scoping for IntelliDepot demo command views."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from fastapi import HTTPException

from app.shared.models.user import User


@dataclass(frozen=True)
class WarehouseDef:
    id: str
    name: str
    city: str
    region_id: str
    region_name: str
    zones: tuple[str, ...]
    cameras: tuple[str, ...]
    capacity_sqft: int


WAREHOUSES: dict[str, WarehouseDef] = {
    "WH_HYD": WarehouseDef(
        id="WH_HYD",
        name="Hyderabad Depot",
        city="Hyderabad",
        region_id="REG_SOUTH",
        region_name="South Region",
        zones=("HYD-Z1", "HYD-Z2", "HYD-Z3", "HYD-Z4"),
        cameras=("CAM-H1", "CAM-H2", "CAM-H3", "CAM-H4", "CAM-H5", "CAM-H6"),
        capacity_sqft=120000,
    ),
    "WH_BLR": WarehouseDef(
        id="WH_BLR",
        name="Bangalore Depot",
        city="Bangalore",
        region_id="REG_SOUTH",
        region_name="South Region",
        zones=("BLR-Z1", "BLR-Z2", "BLR-Z3", "BLR-Z4"),
        cameras=("CAM-B1", "CAM-B2", "CAM-B3", "CAM-B4", "CAM-B5", "CAM-B6"),
        capacity_sqft=110000,
    ),
    "WH_MUM": WarehouseDef(
        id="WH_MUM",
        name="Mumbai Depot",
        city="Mumbai",
        region_id="REG_WEST",
        region_name="West Region",
        zones=("MUM-Z1", "MUM-Z2", "MUM-Z3", "MUM-Z4"),
        cameras=("CAM-M1", "CAM-M2", "CAM-M3", "CAM-M4", "CAM-M5", "CAM-M6"),
        capacity_sqft=130000,
    ),
}

REGIONS: dict[str, tuple[str, ...]] = {
    "REG_SOUTH": ("WH_HYD", "WH_BLR"),
    "REG_WEST": ("WH_MUM",),
}

REGION_NAMES = {
    "REG_SOUTH": "South Region",
    "REG_WEST": "West Region",
}

DEMO_ASSIGNMENTS = {
    "wm.hyd@fidelis-demo.com": ("warehouse_manager", "WH_HYD"),
    "wm.blr@fidelis-demo.com": ("warehouse_manager", "WH_BLR"),
    "wm.mum@fidelis-demo.com": ("warehouse_manager", "WH_MUM"),
    "regional@fidelis-demo.com": ("regional_manager", "REG_SOUTH"),
    "central@fidelis-demo.com": ("central_manager", "ALL"),
    "admin@fidelis-demo.com": ("admin", "ALL"),
}


@dataclass(frozen=True)
class AccessScope:
    role: str
    assignment_id: str
    warehouse_ids: tuple[str, ...]
    region_ids: tuple[str, ...]

    @property
    def is_platform(self) -> bool:
        return self.role in {"central_manager", "admin"}


def role_names(user: User) -> set[str]:
    email = (getattr(user, "email", "") or "").lower()
    names = {DEMO_ASSIGNMENTS[email][0]} if email in DEMO_ASSIGNMENTS else set()
    names.update(getattr(role, "name", "") for role in getattr(user, "roles", []) if getattr(role, "name", None))
    if getattr(user, "is_superuser", False):
        names.add("admin")
    return names


def resolve_access_scope(user: User) -> AccessScope:
    email = (getattr(user, "email", "") or "").lower()
    if email in DEMO_ASSIGNMENTS:
        role, assignment = DEMO_ASSIGNMENTS[email]
        if role == "warehouse_manager":
            wh = WAREHOUSES[assignment]
            return AccessScope(role, assignment, (assignment,), (wh.region_id,))
        if role == "regional_manager":
            return AccessScope(role, assignment, REGIONS[assignment], (assignment,))
        return AccessScope(role, assignment, tuple(WAREHOUSES), tuple(REGIONS))

    names = role_names(user)
    if "admin" in names:
        return AccessScope("admin", "ALL", tuple(WAREHOUSES), tuple(REGIONS))
    if "central_manager" in names:
        return AccessScope("central_manager", "ALL", tuple(WAREHOUSES), tuple(REGIONS))
    if "regional_manager" in names:
        return AccessScope("regional_manager", "REG_SOUTH", REGIONS["REG_SOUTH"], ("REG_SOUTH",))
    return AccessScope("warehouse_manager", "WH_BLR", ("WH_BLR",), ("REG_SOUTH",))


def ensure_scope_access(scope: AccessScope, *, warehouse_id: str | None = None, region_id: str | None = None) -> None:
    if region_id and scope.role == "warehouse_manager":
        raise HTTPException(status_code=403, detail="You do not have access to this warehouse/region.")
    if warehouse_id and warehouse_id not in scope.warehouse_ids:
        raise HTTPException(status_code=403, detail="You do not have access to this warehouse/region.")
    if region_id and region_id not in scope.region_ids:
        raise HTTPException(status_code=403, detail="You do not have access to this warehouse/region.")
    if not warehouse_id and not region_id and scope.role in {"warehouse_manager", "regional_manager"}:
        raise HTTPException(status_code=403, detail="You do not have access to this warehouse/region.")


def warehouse_for_zone(zone: str | None, fallback_index: int = 0) -> str:
    text = (zone or "").upper()
    for warehouse in WAREHOUSES.values():
        if any(zone_id in text for zone_id in warehouse.zones):
            return warehouse.id
        if warehouse.city.upper() in text or warehouse.id in text:
            return warehouse.id
    ids = tuple(WAREHOUSES)
    return ids[fallback_index % len(ids)]


def warehouse_for_camera(name: str | None, zone: str | None, fallback_index: int = 0) -> str:
    text = f"{name or ''} {zone or ''}".upper()
    for warehouse in WAREHOUSES.values():
        if any(cam in text for cam in warehouse.cameras):
            return warehouse.id
        if warehouse.city.upper() in text or warehouse.id in text:
            return warehouse.id
    ids = tuple(WAREHOUSES)
    return ids[fallback_index % len(ids)]


def scoped_warehouses(scope: AccessScope, warehouse_id: str | None = None, region_id: str | None = None) -> tuple[str, ...]:
    if warehouse_id:
        ensure_scope_access(scope, warehouse_id=warehouse_id)
        return (warehouse_id,)
    if region_id:
        ensure_scope_access(scope, region_id=region_id)
        return tuple(wh for wh in REGIONS[region_id] if wh in scope.warehouse_ids)
    return scope.warehouse_ids


def region_ids_for_warehouses(warehouse_ids: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted({WAREHOUSES[warehouse_id].region_id for warehouse_id in warehouse_ids}))
