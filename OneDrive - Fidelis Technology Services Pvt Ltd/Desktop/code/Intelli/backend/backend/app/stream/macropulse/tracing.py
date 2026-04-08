"""
MacroPulse agent tracing & metrics helpers.
"""
from __future__ import annotations

from typing import Any


def get_metrics_summary() -> dict[str, Any]:
    """Return stub p50/p95/p99 latency and confidence metrics."""
    return {
        "latency": {"p50_ms": 0, "p95_ms": 0, "p99_ms": 0},
        "confidence": {"mean": 0.0, "min": 0.0, "max": 0.0},
        "total_queries": 0,
    }
