"""
Human-in-the-Loop (HITL) routing for MacroPulse agent queries.

Low-confidence or held outputs are queued here for analyst review
before being published to the live dashboard.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

# ---------------------------------------------------------------------------
# In-memory HITL queue (swap for DB-backed store in production)
# ---------------------------------------------------------------------------
_hitl_queue: list[dict[str, Any]] = []

router = APIRouter(prefix="/hitl/agent", tags=["hitl-agent"])

# ---------------------------------------------------------------------------
# Confidence threshold
# ---------------------------------------------------------------------------
HITL_CONFIDENCE_THRESHOLD = 0.6


def should_route_to_hitl(confidence: float | None, publish_status: str | None) -> bool:
    """Return True when the output should be reviewed by a human."""
    if publish_status and publish_status.lower() in ("held", "review"):
        return True
    if confidence is not None and confidence < HITL_CONFIDENCE_THRESHOLD:
        return True
    return False


def enqueue_for_hitl(
    *,
    query: str,
    query_type: str | None = None,
    impact: Any = None,
    confidence: float | None = None,
    publish_status: str | None = None,
    region: str | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any]:
    """Add an agent query result to the HITL review queue."""
    entry = {
        "id": str(uuid.uuid4()),
        "query": query,
        "query_type": query_type,
        "impact": impact,
        "confidence": confidence,
        "publish_status": publish_status,
        "region": region,
        "tenant_id": tenant_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _hitl_queue.append(entry)
    return entry


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------
@router.get("/queue", summary="List pending agent HITL items")
async def list_hitl_queue(tenant_id: str | None = None) -> list[dict[str, Any]]:
    if tenant_id:
        return [e for e in _hitl_queue if e.get("tenant_id") == tenant_id and e["status"] == "pending"]
    return [e for e in _hitl_queue if e["status"] == "pending"]


@router.post("/{item_id}/approve", summary="Approve an agent HITL item")
async def approve_hitl_item(item_id: str) -> dict[str, Any]:
    for entry in _hitl_queue:
        if entry["id"] == item_id:
            entry["status"] = "approved"
            entry["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            return entry
    return {"error": "Item not found"}


@router.post("/{item_id}/reject", summary="Reject an agent HITL item")
async def reject_hitl_item(item_id: str) -> dict[str, Any]:
    for entry in _hitl_queue:
        if entry["id"] == item_id:
            entry["status"] = "rejected"
            entry["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            return entry
    return {"error": "Item not found"}
