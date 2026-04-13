"""Prometheus metrics integration — Day 2 Keerthi
Exposes alert volume, event ingestion rate, queue depth metrics.
Grafana-ready endpoints.
"""
from __future__ import annotations

from fastapi import APIRouter, Response

router = APIRouter(prefix="/metrics", tags=["metrics"])

# ── In-memory counters (production: use prometheus_client registry) ───────────
_alert_volume: dict[str, int] = {}
_ingestion_events: list[float] = []
_hitl_queue_depth: int = 0


def record_alert(tenant_id: str) -> None:
    _alert_volume[tenant_id] = _alert_volume.get(tenant_id, 0) + 1


def record_ingestion_event(timestamp: float) -> None:
    _ingestion_events.append(timestamp)
    # Keep last 1000
    if len(_ingestion_events) > 1000:
        _ingestion_events.pop(0)


def set_hitl_queue_depth(depth: int) -> None:
    global _hitl_queue_depth
    _hitl_queue_depth = depth


def _ingestion_rate_per_minute() -> float:
    import time
    now = time.time()
    recent = [t for t in _ingestion_events if now - t <= 60]
    return float(len(recent))


@router.get("/prometheus", response_class=Response)
async def prometheus_metrics() -> Response:
    """Grafana-ready Prometheus text format endpoint."""
    import time
    lines = [
        "# HELP macropulse_alert_volume_total Total alerts classified per tenant",
        "# TYPE macropulse_alert_volume_total counter",
    ]
    for tenant, count in _alert_volume.items():
        lines.append(f'macropulse_alert_volume_total{{tenant="{tenant}"}} {count}')

    rate = _ingestion_rate_per_minute()
    lines += [
        "",
        "# HELP macropulse_ingestion_rate_per_minute Event ingestion rate (last 60s)",
        "# TYPE macropulse_ingestion_rate_per_minute gauge",
        f"macropulse_ingestion_rate_per_minute {rate:.2f}",
        "",
        "# HELP macropulse_hitl_queue_depth Current HITL queue depth",
        "# TYPE macropulse_hitl_queue_depth gauge",
        f"macropulse_hitl_queue_depth {_hitl_queue_depth}",
        "",
        f"# generated_at {time.time():.0f}",
    ]
    return Response(content="\n".join(lines), media_type="text/plain; version=0.0.4")


@router.get("/summary")
async def metrics_summary() -> dict:
    """JSON summary for internal dashboards."""
    return {
        "alert_volume": _alert_volume,
        "ingestion_rate_per_minute": _ingestion_rate_per_minute(),
        "hitl_queue_depth": _hitl_queue_depth,
        "total_ingestion_events": len(_ingestion_events),
    }
