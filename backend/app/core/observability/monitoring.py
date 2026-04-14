"""
Intelli Platform — Application Monitoring
Feature: OBS-6.19

Health checks, structured logging, metrics collection, and basic alerting.
"""
import time
import logging
import platform
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.config import settings
from app.database import check_db_health

logger = logging.getLogger("intelli_platform")
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

router = APIRouter(prefix="/health", tags=["Monitoring"])


# ── In-Memory Metrics Store ──────────────────────────────────

class MetricsCollector:
    """Simple in-memory metrics collector for request tracking."""

    def __init__(self):
        self._start_time = time.monotonic()
        self._request_count: int = 0
        self._error_count: int = 0
        self._endpoint_counts: dict[str, int] = defaultdict(int)
        self._status_counts: dict[int, int] = defaultdict(int)
        self._total_latency_ms: float = 0.0

    def record_request(self, method: str, path: str, status_code: int, latency_ms: float):
        self._request_count += 1
        self._endpoint_counts[f"{method} {path}"] += 1
        self._status_counts[status_code] += 1
        self._total_latency_ms += latency_ms
        if status_code >= 500:
            self._error_count += 1

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self._start_time

    def snapshot(self) -> dict:
        avg_latency = (
            round(self._total_latency_ms / self._request_count, 2)
            if self._request_count > 0
            else 0.0
        )
        return {
            "uptime_seconds": round(self.uptime_seconds, 1),
            "total_requests": self._request_count,
            "total_errors": self._error_count,
            "error_rate": round(self._error_count / max(self._request_count, 1), 4),
            "avg_latency_ms": avg_latency,
            "status_codes": dict(self._status_counts),
            "top_endpoints": dict(
                sorted(self._endpoint_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            ),
        }

    def reset(self):
        self._request_count = 0
        self._error_count = 0
        self._endpoint_counts.clear()
        self._status_counts.clear()
        self._total_latency_ms = 0.0


# Singleton
metrics = MetricsCollector()

# IntelliOps metrics store — updated by the ops module endpoints
_ops_metrics: dict[str, float] = {
    "active_alerts": 0,
    "critical_alerts": 0,
    "high_alerts": 0,
    "events_per_hour": 0,
    "queue_depth": 0,
}


def update_ops_metrics(**kwargs: float) -> None:
    """Called by IntelliOps endpoints to push live metrics for Prometheus scrape."""
    _ops_metrics.update(kwargs)


# ── Health Check Endpoints ───────────────────────────────────

@router.get("/")
async def liveness():
    """Liveness probe — confirms the service process is running."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "intelli-platform-core",
        "version": settings.VERSION,
    }


@router.get("/ready")
async def readiness():
    """Readiness probe — confirms the service can handle requests (DB reachable)."""
    db_status = await check_db_health()
    is_ready = db_status.get("status") == "healthy"
    return {
        "status": "ready" if is_ready else "not_ready",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/metrics")
async def get_metrics():
    """Return collected application metrics."""
    return {
        "service": "intelli-platform-core",
        "version": settings.VERSION,
        "python_version": platform.python_version(),
        "metrics": metrics.snapshot(),
    }


@router.get("/metrics/prometheus", response_class=PlainTextResponse)
async def prometheus_metrics():
    """Prometheus-compatible scrape endpoint for alert volume, ingestion rate, queue depth."""
    snap = metrics.snapshot()
    lines = [
        "# HELP intelli_http_requests_total Total HTTP requests",
        "# TYPE intelli_http_requests_total counter",
        f'intelli_http_requests_total {snap["total_requests"]}',
        "",
        "# HELP intelli_http_errors_total Total HTTP 5xx errors",
        "# TYPE intelli_http_errors_total counter",
        f'intelli_http_errors_total {snap["total_errors"]}',
        "",
        "# HELP intelli_http_avg_latency_ms Average request latency in milliseconds",
        "# TYPE intelli_http_avg_latency_ms gauge",
        f'intelli_http_avg_latency_ms {snap["avg_latency_ms"]}',
        "",
        "# HELP intelli_uptime_seconds Service uptime in seconds",
        "# TYPE intelli_uptime_seconds gauge",
        f'intelli_uptime_seconds {snap["uptime_seconds"]}',
        "",
        "# HELP intelli_ops_alert_volume Active alert count by severity",
        "# TYPE intelli_ops_alert_volume gauge",
        f'intelli_ops_alert_volume{{severity="total"}} {_ops_metrics.get("active_alerts", 0)}',
        f'intelli_ops_alert_volume{{severity="critical"}} {_ops_metrics.get("critical_alerts", 0)}',
        f'intelli_ops_alert_volume{{severity="high"}} {_ops_metrics.get("high_alerts", 0)}',
        "",
        "# HELP intelli_ops_event_ingestion_rate Events ingested per hour",
        "# TYPE intelli_ops_event_ingestion_rate gauge",
        f'intelli_ops_event_ingestion_rate {_ops_metrics.get("events_per_hour", 0)}',
        "",
        "# HELP intelli_ops_queue_depth Number of items in alert queue",
        "# TYPE intelli_ops_queue_depth gauge",
        f'intelli_ops_queue_depth {_ops_metrics.get("queue_depth", 0)}',
        "",
    ]
    return "\n".join(lines) + "\n"


@router.get("/observability")
async def observability_overview():
    """Combined observability overview — health + metrics."""
    db_status = await check_db_health()
    return {
        "status": "healthy" if db_status.get("status") == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "intelli-platform-core",
        "version": settings.VERSION,
        "database": db_status,
        "metrics": metrics.snapshot(),
    }
