"""Warehouse storage metrics loaded from the frontend-owned JSON source of truth."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


_STORAGE_PATH = Path(__file__).resolve().parents[3] / "frontend" / "src" / "data" / "depotWarehouseStorage.json"


@lru_cache(maxsize=1)
def storage_config() -> dict[str, Any]:
    return json.loads(_STORAGE_PATH.read_text(encoding="utf-8"))


def warehouse_zones(warehouse_id: str) -> list[dict[str, Any]]:
    return list(storage_config()["warehouses"][warehouse_id])


def warehouse_storage_totals(warehouse_ids: tuple[str, ...]) -> tuple[int, int]:
    capacity = 0
    occupied = 0
    for warehouse_id in warehouse_ids:
        for zone in warehouse_zones(warehouse_id):
            capacity += int(zone["maxCapacity"])
            occupied += int(zone["occupancy"])
    return capacity, occupied


def utilization_pct(occupied: int, capacity: int) -> float:
    return round((occupied / capacity) * 100, 1) if capacity > 0 else 0.0


def zone_status(utilization: float) -> str:
    if utilization >= 95:
        return "critical"
    if utilization >= 80:
        return "warning"
    return "normal"


def cluster_zones_for_seed(warehouse_id: str = "WH_BLR") -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for zone in warehouse_zones(warehouse_id):
        capacity = int(zone["maxCapacity"])
        occupancy = int(zone["occupancy"])
        rows.append({
            "zone_code": zone.get("seedZoneCode", zone["code"]),
            "name": zone.get("name", zone["code"]),
            "zone_type": zone.get("zoneType", "storage"),
            "floor": zone.get("floor", "ground"),
            "area_sqm": int(zone.get("areaSqm", 0)),
            "max_capacity_units": capacity,
            "current_occupancy": occupancy,
            "utilization_pct": utilization_pct(occupancy, capacity),
            "status": zone_status(utilization_pct(occupancy, capacity)),
        })
    return rows
