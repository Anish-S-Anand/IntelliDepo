"""
Depot hierarchy API.

Provides the business hierarchy used by the Command Center while the full
persistent hierarchy model is being introduced.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_user
from app.database import get_db
from app.depot.access_scope import REGIONS, WAREHOUSES, resolve_access_scope, scoped_warehouses
from app.shared.models.user import User

router = APIRouter(prefix="/depot/hierarchy", tags=["Depot - Hierarchy"])


class HierarchyCamera(BaseModel):
    id: str
    name: str
    status: str
    zone: str
    gate_id: Optional[str] = None


class HierarchyGate(BaseModel):
    id: str
    name: str
    gate_code: str
    status: str
    cameras: list[HierarchyCamera] = Field(default_factory=list)


class HierarchyZone(BaseModel):
    id: str
    name: str
    gates: list[HierarchyGate] = Field(default_factory=list)
    cameras: list[HierarchyCamera] = Field(default_factory=list)


class HierarchyWarehouse(BaseModel):
    id: str
    name: str
    zones: list[HierarchyZone]


class HierarchyRegion(BaseModel):
    id: str
    name: str
    warehouses: list[HierarchyWarehouse]


class DepotHierarchy(BaseModel):
    organization: str
    regions: list[HierarchyRegion]


def _warehouse(warehouse_id: str) -> HierarchyWarehouse:
    warehouse = WAREHOUSES[warehouse_id]
    zones: list[HierarchyZone] = []
    for index, zone_id in enumerate(warehouse.zones):
        cameras = [
            HierarchyCamera(
                id=camera_id,
                name=camera_id,
                status="live",
                zone=zone_id,
                gate_id=f"{warehouse_id}-G{(cam_index % 3) + 1}",
            )
            for cam_index, camera_id in enumerate(warehouse.cameras[index * 2:(index + 1) * 2])
        ]
        gate = HierarchyGate(
            id=f"{warehouse_id}-G{index + 1}",
            name=f"Gate {index + 1}",
            gate_code=f"Gate {index + 1}",
            status="closed" if index else "open",
            cameras=cameras,
        )
        zones.append(HierarchyZone(
            id=zone_id,
            name=f"{zone_id} (Cluster {index + 1})",
            gates=[gate],
            cameras=cameras,
        ))
    return HierarchyWarehouse(id=warehouse.id, name=warehouse.name, zones=zones)


@router.get("", response_model=DepotHierarchy)
async def get_depot_hierarchy(
    warehouse_id: Optional[str] = None,
    region_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = resolve_access_scope(current_user)
    warehouse_ids = scoped_warehouses(scope, warehouse_id=warehouse_id, region_id=region_id)
    regions: list[HierarchyRegion] = []
    for reg_id, reg_warehouse_ids in REGIONS.items():
        visible = [warehouse_id for warehouse_id in reg_warehouse_ids if warehouse_id in warehouse_ids]
        if visible:
            regions.append(HierarchyRegion(
                id=reg_id,
                name=WAREHOUSES[visible[0]].region_name,
                warehouses=[_warehouse(warehouse_id) for warehouse_id in visible],
            ))

    return DepotHierarchy(organization="Fidelis", regions=regions)
