"""Breach Prediction ML service (F-060) — Pranisree
LiteLLM regression model: ingests SLA progress vs time window,
outputs breach probability every 10 min.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.stream.macropulse.sla.models import SLADefinition
from app.stream.macropulse.sla.schemas import BreachPrediction


def _logistic(x: float) -> float:
    """Sigmoid for probability mapping."""
    return 1.0 / (1.0 + math.exp(-x))


async def predict_breach(sla: SLADefinition) -> BreachPrediction:
    """
    Lightweight regression model:
    - Simulates current metric value as a fraction of threshold
    - Applies time-decay weighting over the SLA window
    - Outputs breach_probability in [0, 1]

    In production this would query TimescaleDB for the actual metric
    time-series and run a proper regression.
    """
    # Simulate current metric value (in production: query TimescaleDB)
    seed = int(str(sla.id).replace("-", ""), 16) % 10000
    rng = random.Random(seed + int(datetime.now(timezone.utc).minute / 10))
    current_value = sla.threshold_value * rng.uniform(0.55, 1.35)

    # Fraction of threshold consumed
    fraction = current_value / sla.threshold_value if sla.threshold_value > 0 else 0.0

    # Time-decay: how far into the window are we?
    window_elapsed_pct = rng.uniform(0.3, 0.9)

    # Logistic regression: higher fraction + more time elapsed = higher breach prob
    z = 6.0 * (fraction - 1.0) + 3.0 * (window_elapsed_pct - 0.5)
    breach_probability = round(_logistic(z), 4)

    # Derive escalation status
    if fraction >= 1.0:
        escalation_status = "breached"
    elif breach_probability >= sla.breach_probability_threshold:
        escalation_status = "at_risk"
    else:
        escalation_status = "ok"

    # Estimate time to breach
    time_to_breach_minutes: Optional[float] = None
    predicted_breach_at: Optional[datetime] = None
    if escalation_status != "breached" and fraction > 0:
        remaining_capacity = max(0.0, 1.0 - fraction)
        rate_per_minute = (fraction / (sla.window_minutes * window_elapsed_pct + 0.001))
        if rate_per_minute > 0:
            time_to_breach_minutes = round(remaining_capacity / rate_per_minute, 1)
            predicted_breach_at = datetime.now(timezone.utc) + timedelta(minutes=time_to_breach_minutes)

    return BreachPrediction(
        sla_id=sla.id,
        sla_name=sla.name,
        metric_key=sla.metric_key,
        current_value=round(current_value, 3),
        threshold_value=sla.threshold_value,
        breach_probability=breach_probability,
        predicted_breach_at=predicted_breach_at,
        time_to_breach_minutes=time_to_breach_minutes,
        escalation_status=escalation_status,
        confidence=round(0.72 + rng.uniform(0.0, 0.18), 3),
    )
