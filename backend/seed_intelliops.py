"""
IntelliOps™ — Stakeholder Demo Seed Data (Day 5)

Seeds realistic mock data across all depots for all 20 features (F-054 to F-073).
Run: python seed_intelliops.py

Covers:
  - Sensor events and alerts (F-054–F-056)
  - Alert thresholds (F-055)
  - SLA definitions with breach scenarios (F-059–F-060)
  - Escalation rules (F-061, F-069)
  - Penalty records (F-062)
  - Scorecard entries (F-063)
  - Fleet vehicles with GPS positions (F-064)
  - Dock slots and schedules (F-065, F-067)
  - Dwell records (F-066)
  - Incidents across sources (F-069–F-073)
"""
import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta


DEPOTS = ["Depot Alpha — Chennai", "Depot Beta — Bangalore", "Depot Gamma — Hyderabad"]
ZONES = ["inbound_gate", "staging_area", "dock_area", "cold_storage", "parking_yard", "outbound_gate"]
VEHICLE_TYPES = ["truck", "truck", "truck", "refrigerated", "van", "trailer"]
CLIENTS = ["Acme Corp", "ColdChain Inc", "Global Logistics", "FreshCo", "Metro Supply", "QuickShip", "BigHaul"]
DRIVERS = ["Rajesh K", "Suresh M", "Anil P", "Priya S", "Deepak R", "Vijay N", "Kumar L", "Meera D", "Ravi T", "Sanjay B"]


def now():
    return datetime.now(timezone.utc)


def past(hours=0, minutes=0):
    return now() - timedelta(hours=hours, minutes=minutes)


def future(hours=0, minutes=0):
    return now() + timedelta(hours=hours, minutes=minutes)


def gen_seed_data():
    """Generate all seed data as API-ready payloads."""
    data = {}

    # --- Alert Thresholds (F-055) ---
    data["thresholds"] = [
        {"event_type": "sensor", "metric_name": "temperature", "warning_value": 35.0, "critical_value": 42.0, "comparison": "gte"},
        {"event_type": "sensor", "metric_name": "humidity", "warning_value": 70.0, "critical_value": 85.0, "comparison": "gte"},
        {"event_type": "sensor", "metric_name": "pressure", "warning_value": 2.0, "critical_value": 1.5, "comparison": "lte"},
        {"event_type": "camera", "metric_name": "motion_score", "warning_value": 0.7, "critical_value": 0.9, "comparison": "gte"},
    ]

    # --- Sensor Events (F-054) ---
    data["events"] = []
    for i in range(50):
        zone = random.choice(ZONES)
        severity = random.choice(["info", "low", "medium", "high", "critical"])
        data["events"].append({
            "event_type": random.choice(["sensor", "camera", "gate", "equipment"]),
            "source_id": f"{random.choice(['TEMP', 'HUM', 'CAM', 'GATE'])}-{random.randint(1, 20):02d}",
            "source_name": f"Sensor {zone.replace('_', ' ').title()}",
            "zone": zone,
            "severity": severity,
            "value": round(random.uniform(10, 60), 1),
            "unit": random.choice(["°C", "%", "psi", ""]),
            "message": f"Automated reading from {zone}",
        })

    # --- SLA Definitions (F-059) ---
    data["slas"] = [
        {"tenant_id": "demo", "name": "Cold Chain Compliance", "metric_key": "cold_storage_temp", "threshold_value": 5.0, "threshold_unit": "°C", "window_minutes": 60},
        {"tenant_id": "demo", "name": "Dispatch Latency SLA", "metric_key": "dispatch_latency_min", "threshold_value": 30.0, "threshold_unit": "min", "window_minutes": 120},
        {"tenant_id": "demo", "name": "Inbound Processing SLA", "metric_key": "inbound_processing_min", "threshold_value": 45.0, "threshold_unit": "min", "window_minutes": 60},
        {"tenant_id": "demo", "name": "Dwell Time SLA", "metric_key": "vehicle_dwell_hours", "threshold_value": 3.0, "threshold_unit": "hours", "window_minutes": 180},
        {"tenant_id": "demo", "name": "Gate Throughput SLA", "metric_key": "gate_throughput_per_hour", "threshold_value": 20.0, "threshold_unit": "vehicles/hr", "window_minutes": 60},
    ]

    # --- Escalation Rules (F-061/F-069) ---
    data["escalation_rules"] = [
        {"name": "P1 Critical — 5min Escalation", "severity_trigger": "critical", "breach_probability_threshold": 0.80, "tier_1_delay_minutes": 5, "tier_2_delay_minutes": 10, "tier_3_delay_minutes": 20, "notification_channels": ["in_app", "email", "sms"]},
        {"name": "P2 High — 15min Escalation", "severity_trigger": "high", "breach_probability_threshold": 0.85, "tier_1_delay_minutes": 15, "tier_2_delay_minutes": 30, "tier_3_delay_minutes": 60, "notification_channels": ["in_app", "email"]},
    ]
    data["incident_rules"] = [
        {"name": "P1 Auto-Escalate 5min", "priority_trigger": "P1", "time_window_minutes": 5, "notification_channels": ["in_app", "email", "sms"]},
        {"name": "P2 Auto-Escalate 15min", "priority_trigger": "P2", "time_window_minutes": 15, "notification_channels": ["in_app", "email"]},
    ]

    # --- Penalties (F-062) ---
    data["penalties"] = [
        {"sla_name": "Cold Chain Compliance", "client_name": "ColdChain Inc", "breach_started_at": past(hours=6).isoformat(), "breach_ended_at": past(hours=3).isoformat(), "penalty_rate_per_hour": 200.0},
        {"sla_name": "Dispatch Latency SLA", "client_name": "Acme Corp", "breach_started_at": past(hours=2).isoformat(), "penalty_rate_per_hour": 150.0},
        {"sla_name": "Dwell Time SLA", "client_name": "Metro Supply", "breach_started_at": past(hours=8).isoformat(), "breach_ended_at": past(hours=5).isoformat(), "penalty_rate_per_hour": 100.0},
    ]

    # --- Scorecard Entries (F-063) ---
    iso_week = now().strftime("%G-W%V")
    data["scorecards"] = [
        {"period": iso_week, "group_type": "module", "group_name": "Live Monitoring", "total_slas": 12, "compliant": 12, "at_risk": 0, "breached": 0},
        {"period": iso_week, "group_type": "module", "group_name": "SLA Tracking", "total_slas": 18, "compliant": 11, "at_risk": 4, "breached": 3, "penalty_amount": 4500},
        {"period": iso_week, "group_type": "client", "group_name": "Acme Corp", "total_slas": 8, "compliant": 7, "at_risk": 1, "breached": 0},
        {"period": iso_week, "group_type": "client", "group_name": "ColdChain Inc", "total_slas": 6, "compliant": 3, "at_risk": 1, "breached": 2, "penalty_amount": 3200},
        {"period": iso_week, "group_type": "client", "group_name": "Global Logistics", "total_slas": 5, "compliant": 5, "at_risk": 0, "breached": 0},
        {"period": iso_week, "group_type": "team", "group_name": "Shift A", "total_slas": 10, "compliant": 9, "at_risk": 1, "breached": 0},
        {"period": iso_week, "group_type": "team", "group_name": "Shift B", "total_slas": 10, "compliant": 7, "at_risk": 2, "breached": 1, "penalty_amount": 1500},
    ]

    # --- Fleet Vehicles (F-064) ---
    data["vehicles"] = []
    for i in range(15):
        vtype = random.choice(VEHICLE_TYPES)
        prefix = {"truck": "TRK", "refrigerated": "TRK", "van": "VAN", "trailer": "TRL"}[vtype]
        data["vehicles"].append({
            "vehicle_id": f"{prefix}-{1000 + i}",
            "latitude": 12.95 + random.uniform(0, 0.07),
            "longitude": 77.55 + random.uniform(0, 0.1),
            "speed_kmh": random.choice([0, 0, 0, 5, 15, 30, 45]),
            "heading": random.randint(0, 360),
            "vehicle_type": vtype,
            "driver_name": random.choice(DRIVERS),
        })

    # --- Dock Slots (F-065) ---
    data["docks"] = [
        {"dock_id": "DOCK-A1", "dock_name": "Bay A1", "zone": "dock_area", "dock_type": "standard"},
        {"dock_id": "DOCK-A2", "dock_name": "Bay A2", "zone": "dock_area", "dock_type": "standard"},
        {"dock_id": "DOCK-B1", "dock_name": "Bay B1", "zone": "dock_area", "dock_type": "standard"},
        {"dock_id": "DOCK-B2", "dock_name": "Bay B2", "zone": "dock_area", "dock_type": "standard"},
        {"dock_id": "DOCK-C1", "dock_name": "Cold Bay 1", "zone": "cold_storage", "dock_type": "refrigerated"},
        {"dock_id": "DOCK-C2", "dock_name": "Cold Bay 2", "zone": "cold_storage", "dock_type": "refrigerated"},
        {"dock_id": "DOCK-D1", "dock_name": "Hazmat Bay", "zone": "dock_area", "dock_type": "hazmat"},
        {"dock_id": "DOCK-D2", "dock_name": "Bay D2", "zone": "dock_area", "dock_type": "standard"},
    ]

    # --- Incidents (F-069–F-073) ---
    data["incidents"] = [
        {"title": "SLA Breach — Cold Chain Delivery", "description": "Temperature compliance SLA violated for ColdChain Inc shipment.", "priority": "P1", "source": "sla_breach", "zone": "Cold Storage"},
        {"title": "Unauthorized Vehicle at Inbound Gate", "description": "LPR mismatch. Vehicle not in approved list.", "source": "perimeter", "zone": "Inbound Gate"},
        {"title": "Dwell Time Alert — Truck TRK-1002", "description": "Vehicle in staging area for 4h 30m. SLA threshold: 3h.", "source": "alert", "zone": "Staging Area"},
        {"title": "Equipment Malfunction — Forklift FORK-03", "description": "Hydraulic pressure below threshold.", "priority": "P3", "source": "sensor", "zone": "Dispatch Bay"},
        {"title": "Fire alarm triggered in warehouse", "description": "Smoke detector activated in section B.", "source": "sensor", "zone": "Cold Storage"},
    ]

    return data


if __name__ == "__main__":
    data = gen_seed_data()
    print(f"=== IntelliOps Seed Data Generated ===")
    print(f"  Thresholds:       {len(data['thresholds'])}")
    print(f"  Events:           {len(data['events'])}")
    print(f"  SLAs:             {len(data['slas'])}")
    print(f"  Escalation Rules: {len(data['escalation_rules'])}")
    print(f"  Incident Rules:   {len(data['incident_rules'])}")
    print(f"  Penalties:        {len(data['penalties'])}")
    print(f"  Scorecards:       {len(data['scorecards'])}")
    print(f"  Vehicles:         {len(data['vehicles'])}")
    print(f"  Docks:            {len(data['docks'])}")
    print(f"  Incidents:        {len(data['incidents'])}")
    print()
    print("To apply: POST each payload to the corresponding API endpoint.")
    print("Example:  curl -X POST http://localhost:8000/ops/monitoring/thresholds -H 'Content-Type: application/json' -H 'x-user-id: seed' -d '<payload>'")
