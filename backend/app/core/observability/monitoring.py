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
