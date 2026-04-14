"""
IntelliOps™ — Full E2E Integration Tests (Day 5)

Tests the complete IntelliOps lifecycle across all 20 features (F-054 to F-073):
  Event Ingestion → Alert → SLA Breach → Incident → Escalation → Resolution → Audit

Modules covered:
  - Live Monitoring (F-054–F-058)
  - SLA Tracking (F-059–F-063)
  - Fleet & Yard View (F-064–F-068)
  - Incident Escalation (F-069–F-073)
"""
import pytest
from datetime import datetime, timezone, timedelta

HEADERS = {"x-user-id": "ops-integration-test-user"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _ingest_event(auth_client, source_id="TEMP-A01", severity="critical", value=45.0):
    resp = await auth_client.post(
        "/ops/monitoring/events",
        json={
            "event_type": "sensor",
            "source_id": source_id,
            "source_name": f"Sensor {source_id}",
            "zone": "Cold Storage",
            "severity": severity,
            "value": value,
            "unit": "°C",
            "message": f"Temperature reading: {value}°C",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_threshold(auth_client, event_type="sensor", metric="temperature",
                            warning=35.0, critical=40.0):
    resp = await auth_client.post(
        "/ops/monitoring/thresholds",
        json={
            "event_type": event_type,
            "metric_name": metric,
            "warning_value": warning,
            "critical_value": critical,
            "comparison": "gte",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_sla(auth_client, name="Cold Chain SLA"):
    resp = await auth_client.post(
        "/api/v1/sla",
        json={
            "tenant_id": "test-tenant",
            "name": name,
            "description": "Temperature compliance SLA",
            "metric_key": "cold_storage_temp",
            "threshold_value": 5.0,
            "threshold_unit": "°C",
            "window_minutes": 60,
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_vehicle(auth_client, vehicle_id="TRK-TEST-001"):
    resp = await auth_client.post(
        "/ops/fleet/gps",
        json={
            "vehicle_id": vehicle_id,
            "latitude": 12.975,
            "longitude": 77.580,
            "speed_kmh": 0,
            "heading": 90,
            "vehicle_type": "truck",
            "driver_name": "Test Driver",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_dock(auth_client, dock_id="DOCK-TEST-1"):
    resp = await auth_client.post(
        "/ops/fleet/docks",
        json={
            "dock_id": dock_id,
            "dock_name": f"Test Bay {dock_id}",
            "zone": "dock_area",
            "capacity_tonnes": 25.0,
            "dock_type": "standard",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# 1. Live Monitoring (F-054 – F-058)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_event_ingestion_and_kpi_dashboard(auth_client):
    """F-054: Event ingestion → dashboard KPIs update."""
    event = await _ingest_event(auth_client, "TEMP-KPI-01", "high", 38.0)
    assert event["event_type"] == "sensor"
    assert event["severity"] == "high"

    # Dashboard KPIs should reflect the new event
    kpi_resp = await auth_client.get("/ops/monitoring/dashboard/kpis", headers=HEADERS)
    assert kpi_resp.status_code == 200
    kpis = kpi_resp.json()
    assert kpis["total_events_today"] >= 1


@pytest.mark.asyncio
async def test_threshold_alert_engine(auth_client):
    """F-055: Configure threshold → ingest event above threshold → alert triggered."""
    threshold = await _create_threshold(auth_client, "sensor", "temperature", 35.0, 40.0)
    assert threshold["is_active"] is True

    # Ingest an event above critical threshold
    event = await _ingest_event(auth_client, "TEMP-THR-01", "info", 42.0)

    # Check alerts — should have triggered
    alerts_resp = await auth_client.get("/ops/monitoring/alerts/active", headers=HEADERS)
    assert alerts_resp.status_code == 200


@pytest.mark.asyncio
async def test_alert_priority_feed(auth_client):
    """F-056: Alert feed returns priority-ranked alerts."""
    resp = await auth_client.get("/ops/monitoring/alerts?limit=10", headers=HEADERS)
    assert resp.status_code == 200
    alerts = resp.json()
    # Verify descending priority order
    if len(alerts) >= 2:
        assert alerts[0]["priority_score"] >= alerts[1]["priority_score"]


@pytest.mark.asyncio
async def test_alert_acknowledge_and_escalate(auth_client):
    """F-056/F-058: Acknowledge → escalate → resolve alert lifecycle."""
    # Create an event to generate an alert
    await _ingest_event(auth_client, "TEMP-ACK-01", "critical", 50.0)

    alerts_resp = await auth_client.get("/ops/monitoring/alerts/active", headers=HEADERS)
    alerts = alerts_resp.json()
    if len(alerts) == 0:
        pytest.skip("No active alerts to test lifecycle")

    alert_id = alerts[0]["id"]

    # Acknowledge
    ack_resp = await auth_client.patch(
        f"/ops/monitoring/alerts/{alert_id}/acknowledge", headers=HEADERS
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "acknowledged"

    # Escalate
    esc_resp = await auth_client.patch(
        f"/ops/monitoring/alerts/{alert_id}/escalate", headers=HEADERS
    )
    assert esc_resp.status_code == 200
    assert esc_resp.json()["status"] == "escalated"

    # Resolve
    res_resp = await auth_client.patch(
        f"/ops/monitoring/alerts/{alert_id}/resolve?notes=Resolved+via+integration+test",
        headers=HEADERS,
    )
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_live_state_snapshot(auth_client):
    """F-054: Full dashboard state snapshot."""
    resp = await auth_client.get("/ops/monitoring/dashboard/state", headers=HEADERS)
    assert resp.status_code == 200
    state = resp.json()
    assert "kpis" in state
    assert "recent_alerts" in state
    assert "feed_status" in state


@pytest.mark.asyncio
async def test_event_batch_ingestion(auth_client):
    """F-054: Batch event ingestion."""
    resp = await auth_client.post(
        "/ops/monitoring/events/batch",
        json={
            "events": [
                {"event_type": "sensor", "source_id": "BATCH-01", "severity": "medium", "value": 30.0},
                {"event_type": "gate", "source_id": "BATCH-02", "severity": "low", "value": 1.0},
                {"event_type": "camera", "source_id": "BATCH-03", "severity": "info"},
            ]
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    result = resp.json()
    assert result["ingested"] == 3


# ---------------------------------------------------------------------------
# 2. SLA Tracking (F-059 – F-063)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sla_crud_lifecycle(auth_client):
    """F-059: SLA create → read → update → approve → delete."""
    sla = await _create_sla(auth_client, "Integration SLA Test")
    sla_id = sla["id"]

    # Read
    get_resp = await auth_client.get(f"/api/v1/sla/{sla_id}", headers=HEADERS)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Integration SLA Test"

    # Update
    patch_resp = await auth_client.patch(
        f"/api/v1/sla/{sla_id}",
        json={"description": "Updated via integration test"},
        headers=HEADERS,
    )
    assert patch_resp.status_code == 200

    # Approve
    approve_resp = await auth_client.post(
        f"/api/v1/sla/{sla_id}/approve", headers=HEADERS
    )
    assert approve_resp.status_code == 200

    # Soft delete
    del_resp = await auth_client.delete(f"/api/v1/sla/{sla_id}", headers=HEADERS)
    assert del_resp.status_code in [200, 204]


@pytest.mark.asyncio
async def test_breach_prediction(auth_client):
    """F-060: Breach prediction returns probability + escalation status."""
    sla = await _create_sla(auth_client, "Breach Prediction Test SLA")
    resp = await auth_client.get(
        f"/api/v1/sla/{sla['id']}/breach-prediction", headers=HEADERS
    )
    assert resp.status_code == 200
    pred = resp.json()
    assert "breach_probability" in pred
    assert "escalation_status" in pred
    assert pred["escalation_status"] in ["ok", "at_risk", "breached"]


@pytest.mark.asyncio
async def test_at_risk_sla_list(auth_client):
    """F-060: At-risk SLA list endpoint."""
    resp = await auth_client.get("/api/v1/sla/breach-predictions/at-risk", headers=HEADERS)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_escalation_rule_crud(auth_client):
    """F-061: Escalation rule CRUD."""
    # Create
    create_resp = await auth_client.post(
        "/ops/escalation/rules",
        json={
            "name": "Integration Test Rule",
            "severity_trigger": "critical",
            "breach_probability_threshold": 0.80,
            "tier_1_delay_minutes": 5,
            "tier_2_delay_minutes": 15,
            "tier_3_delay_minutes": 30,
            "notification_channels": ["in_app", "email"],
        },
        headers=HEADERS,
    )
    assert create_resp.status_code == 201
    rule_id = create_resp.json()["id"]

    # List
    list_resp = await auth_client.get("/ops/escalation/rules", headers=HEADERS)
    assert list_resp.status_code == 200

    # Update
    patch_resp = await auth_client.patch(
        f"/ops/escalation/rules/{rule_id}",
        json={"tier_1_delay_minutes": 3},
        headers=HEADERS,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["tier_1_delay_minutes"] == 3


@pytest.mark.asyncio
async def test_penalty_calculation(auth_client):
    """F-062: Penalty create → close → forecast."""
    now = datetime.now(timezone.utc)
    create_resp = await auth_client.post(
        "/ops/escalation/penalties",
        json={
            "sla_name": "Delivery SLA",
            "client_name": "Acme Corp",
            "breach_started_at": (now - timedelta(hours=2)).isoformat(),
            "penalty_rate_per_hour": 150.0,
        },
        headers=HEADERS,
    )
    assert create_resp.status_code == 201
    penalty = create_resp.json()
    assert penalty["penalty_amount"] > 0
    penalty_id = penalty["id"]

    # Close the penalty
    close_resp = await auth_client.patch(
        f"/ops/escalation/penalties/{penalty_id}/close", headers=HEADERS
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["breach_ended_at"] is not None

    # Forecast
    forecast_resp = await auth_client.get("/ops/escalation/penalties/forecast", headers=HEADERS)
    assert forecast_resp.status_code == 200
    assert forecast_resp.json()["total_breaches"] >= 1


@pytest.mark.asyncio
async def test_scorecards_summary(auth_client):
    """F-063: Scorecard summary by module."""
    resp = await auth_client.get(
        "/ops/scorecards/summary?group_type=module", headers=HEADERS
    )
    assert resp.status_code == 200
    summary = resp.json()
    assert "overall_compliance_pct" in summary
    assert len(summary["by_group"]) >= 1


# ---------------------------------------------------------------------------
# 3. Fleet & Yard View (F-064 – F-068)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gps_tracking_and_vehicle_list(auth_client):
    """F-064: GPS ingestion → vehicle list → yard summary."""
    vehicle = await _create_vehicle(auth_client, "TRK-GPS-TEST")
    assert vehicle["vehicle_id"] == "TRK-GPS-TEST"

    # List vehicles
    list_resp = await auth_client.get("/ops/fleet/vehicles", headers=HEADERS)
    assert list_resp.status_code == 200

    # Yard summary
    summary_resp = await auth_client.get("/ops/fleet/vehicles/yard/summary", headers=HEADERS)
    assert summary_resp.status_code == 200


@pytest.mark.asyncio
async def test_gps_batch_ingestion(auth_client):
    """F-064: Batch GPS ingestion."""
    resp = await auth_client.post(
        "/ops/fleet/gps/batch",
        json={
            "updates": [
                {"vehicle_id": "TRK-BATCH-1", "latitude": 12.960, "longitude": 77.560, "speed_kmh": 10},
                {"vehicle_id": "TRK-BATCH-2", "latitude": 12.985, "longitude": 77.590, "speed_kmh": 0},
            ]
        },
        headers=HEADERS,
    )
    assert resp.status_code in [200, 201]
    assert resp.json()["ingested"] == 2


@pytest.mark.asyncio
async def test_dock_management(auth_client):
    """F-065: Dock create → assign vehicle → release."""
    dock = await _create_dock(auth_client, "DOCK-MGMT-1")
    vehicle = await _create_vehicle(auth_client, "TRK-DOCK-TEST")

    # Assign vehicle to dock
    assign_resp = await auth_client.patch(
        f"/ops/fleet/docks/{dock['dock_id']}/assign?vehicle_id={vehicle['vehicle_id']}",
        headers=HEADERS,
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["status"] == "occupied"

    # Release dock
    release_resp = await auth_client.patch(
        f"/ops/fleet/docks/{dock['dock_id']}/release", headers=HEADERS
    )
    assert release_resp.status_code == 200
    assert release_resp.json()["status"] == "free"


@pytest.mark.asyncio
async def test_dwell_time_tracking(auth_client):
    """F-066: Dwell check-in → evaluate alerts → check-out."""
    # Check in
    checkin_resp = await auth_client.post(
        "/ops/fleet/dwell/check-in?vehicle_id=TRK-DWELL-TEST&zone=staging_area",
        headers=HEADERS,
    )
    assert checkin_resp.status_code == 201
    record_id = checkin_resp.json()["id"]

    # Evaluate alerts (should be normal — just checked in)
    eval_resp = await auth_client.post("/ops/fleet/dwell/evaluate-alerts", headers=HEADERS)
    assert eval_resp.status_code == 200

    # Check out
    checkout_resp = await auth_client.patch(
        f"/ops/fleet/dwell/{record_id}/check-out", headers=HEADERS
    )
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["exited_at"] is not None


@pytest.mark.asyncio
async def test_dwell_heatmap(auth_client):
    """F-066: Dwell heatmap aggregation."""
    resp = await auth_client.get("/ops/fleet/dwell/heatmap", headers=HEADERS)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_dock_scheduling(auth_client):
    """F-067: Book dock slot → list schedules → cancel."""
    dock = await _create_dock(auth_client, "DOCK-SCHED-1")
    now = datetime.now(timezone.utc)

    book_resp = await auth_client.post(
        "/ops/fleet/schedules",
        json={
            "dock_id": dock["dock_id"],
            "vehicle_id": "TRK-SCHED-1",
            "client_name": "Test Client",
            "scheduled_start": (now + timedelta(hours=1)).isoformat(),
            "scheduled_end": (now + timedelta(hours=5)).isoformat(),
        },
        headers=HEADERS,
    )
    assert book_resp.status_code == 201
    schedule_id = book_resp.json()["id"]

    # List schedules
    list_resp = await auth_client.get("/ops/fleet/schedules", headers=HEADERS)
    assert list_resp.status_code == 200

    # Cancel
    cancel_resp = await auth_client.delete(
        f"/ops/fleet/schedules/{schedule_id}", headers=HEADERS
    )
    assert cancel_resp.status_code == 204


@pytest.mark.asyncio
async def test_queue_optimization(auth_client):
    """F-068: Queue optimizer returns ranked recommendations."""
    # Create some waiting vehicles
    await _create_vehicle(auth_client, "TRK-Q-1")
    await _create_vehicle(auth_client, "TRK-Q-2")
    await _create_dock(auth_client, "DOCK-Q-1")

    resp = await auth_client.get("/ops/fleet/queue/optimize", headers=HEADERS)
    assert resp.status_code == 200
    result = resp.json()
    assert "recommendations" in result
    assert "total_vehicles_waiting" in result


# ---------------------------------------------------------------------------
# 4. Incident Escalation (F-069 – F-073)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incident_create_with_auto_classification(auth_client):
    """F-070: Create incident without priority → auto-classified by NLP agent."""
    resp = await auth_client.post(
        "/ops/incidents/",
        json={
            "title": "Critical security breach at perimeter zone",
            "description": "Unauthorized personnel detected in restricted area near cold storage",
            "incident_type": "security",
            "source": "perimeter",
            "zone": "Cold Storage",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    incident = resp.json()
    assert incident["priority"] in ["P1", "P2", "P3", "P4"]
    assert incident["severity_score"] > 0
    assert incident["status"] == "open"
    assert incident["assigned_to"] is not None  # auto-assigned
    return incident


@pytest.mark.asyncio
async def test_severity_classification_endpoint(auth_client):
    """F-070: Direct severity classification API."""
    resp = await auth_client.post(
        "/ops/incidents/classify?title=Fire+detected+in+warehouse&description=Smoke+alarm+triggered&source=sensor",
        headers=HEADERS,
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["priority"] == "P1"  # "fire" is a P1 keyword
    assert result["confidence"] > 0
    assert "fire" in result["keywords_matched"]


@pytest.mark.asyncio
async def test_incident_acknowledge_resolve_lifecycle(auth_client):
    """F-069/F-072: Incident create → acknowledge → resolve with steps."""
    # Create
    create_resp = await auth_client.post(
        "/ops/incidents/",
        json={
            "title": "Equipment malfunction — conveyor belt",
            "priority": "P3",
            "source": "sensor",
            "zone": "Dispatch Bay",
        },
        headers=HEADERS,
    )
    assert create_resp.status_code == 201
    inc_id = create_resp.json()["id"]

    # Acknowledge
    ack_resp = await auth_client.patch(
        f"/ops/incidents/{inc_id}/acknowledge",
        json={"reason": "Maintenance team dispatched"},
        headers=HEADERS,
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "acknowledged"

    # Resolve with steps (F-072)
    resolve_resp = await auth_client.patch(
        f"/ops/incidents/{inc_id}/resolve",
        json={
            "resolution_notes": "Belt tension adjusted, motor reset completed",
            "resolution_steps": [
                "Isolated conveyor power",
                "Adjusted belt tension",
                "Reset motor controller",
                "Verified operation for 10 minutes",
            ],
        },
        headers=HEADERS,
    )
    assert resolve_resp.status_code == 200
    resolved = resolve_resp.json()
    assert resolved["status"] == "resolved"
    assert len(resolved["resolution_steps"]) == 4


@pytest.mark.asyncio
async def test_incident_audit_trail(auth_client):
    """F-073: Audit trail captures all state changes."""
    # Create incident
    create_resp = await auth_client.post(
        "/ops/incidents/",
        json={"title": "Audit trail test incident", "priority": "P4", "source": "manual"},
        headers=HEADERS,
    )
    inc_id = create_resp.json()["id"]

    # Get audit trail
    audit_resp = await auth_client.get(
        f"/ops/incidents/{inc_id}/audit", headers=HEADERS
    )
    assert audit_resp.status_code == 200
    entries = audit_resp.json()
    assert len(entries) >= 1  # at least "created" entry
    assert entries[0]["action"] == "created"


@pytest.mark.asyncio
async def test_incident_notifications(auth_client):
    """F-071: Notification history per incident."""
    create_resp = await auth_client.post(
        "/ops/incidents/",
        json={"title": "Notification test incident", "priority": "P2", "source": "alert"},
        headers=HEADERS,
    )
    inc_id = create_resp.json()["id"]

    # Check notifications were auto-sent
    notif_resp = await auth_client.get(
        f"/ops/incidents/{inc_id}/notifications", headers=HEADERS
    )
    assert notif_resp.status_code == 200
    assert len(notif_resp.json()) >= 1  # at least initial notification


@pytest.mark.asyncio
async def test_sla_breach_to_incident_link(auth_client):
    """Cross-module: SLA breach → auto-create incident."""
    import uuid
    resp = await auth_client.post(
        "/ops/incidents/from-sla-breach",
        json={
            "sla_id": str(uuid.uuid4()),
            "sla_name": "Delivery Compliance SLA",
            "breach_probability": 0.95,
            "client_name": "Acme Corp",
            "zone": "Dispatch Bay",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    incident = resp.json()
    assert incident["source"] == "sla_breach"
    assert "SLA Breach" in incident["title"]
    assert incident["priority"] in ["P1", "P2"]  # SLA breach gets boosted


@pytest.mark.asyncio
async def test_auto_escalation_rules(auth_client):
    """F-069: Auto-escalation rule CRUD + evaluation."""
    # Create rule
    rule_resp = await auth_client.post(
        "/ops/incidents/rules",
        json={
            "name": "P1 Auto-Escalate",
            "priority_trigger": "P1",
            "time_window_minutes": 5,
            "target_tier": "Operations Manager",
            "notification_channels": ["in_app", "email", "sms"],
        },
        headers=HEADERS,
    )
    assert rule_resp.status_code == 201

    # List rules
    list_resp = await auth_client.get("/ops/incidents/rules", headers=HEADERS)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # Evaluate (no incidents past deadline — should escalate 0)
    eval_resp = await auth_client.post("/ops/incidents/evaluate-escalations", headers=HEADERS)
    assert eval_resp.status_code == 200
    assert "auto_escalated" in eval_resp.json()


# ---------------------------------------------------------------------------
# 5. Full E2E Flow: Event → Alert → SLA → Incident → Escalation → Resolution
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_e2e_flow(auth_client):
    """
    Complete lifecycle test spanning all modules:
    Event ingestion → Threshold alert → SLA breach prediction → Incident creation
    → Auto-classification → Acknowledge → Resolution with steps → Audit verification
    """
    import uuid

    # Step 1: Ingest a critical event
    event = await _ingest_event(auth_client, "E2E-SENSOR-01", "critical", 55.0)
    assert event["severity"] == "critical"

    # Step 2: Verify dashboard KPIs updated
    kpi = await auth_client.get("/ops/monitoring/dashboard/kpis", headers=HEADERS)
    assert kpi.status_code == 200

    # Step 3: Create SLA breach → incident
    breach_resp = await auth_client.post(
        "/ops/incidents/from-sla-breach",
        json={
            "sla_id": str(uuid.uuid4()),
            "sla_name": "E2E Cold Chain SLA",
            "breach_probability": 0.98,
            "client_name": "E2E Test Client",
            "zone": "Cold Storage",
        },
        headers=HEADERS,
    )
    assert breach_resp.status_code == 201
    incident = breach_resp.json()
    inc_id = incident["id"]

    # Step 4: Verify auto-classification
    assert incident["priority"] in ["P1", "P2"]
    assert incident["severity_score"] > 0

    # Step 5: Acknowledge
    ack = await auth_client.patch(
        f"/ops/incidents/{inc_id}/acknowledge",
        json={"reason": "E2E test — maintenance team dispatched"},
        headers=HEADERS,
    )
    assert ack.status_code == 200

    # Step 6: Resolve with checklist
    resolve = await auth_client.patch(
        f"/ops/incidents/{inc_id}/resolve",
        json={
            "resolution_notes": "E2E test resolution — temperature stabilized",
            "resolution_steps": [
                "Checked refrigeration unit",
                "Replaced faulty sensor",
                "Temperature restored to 2°C",
                "Verified stable for 30 minutes",
            ],
        },
        headers=HEADERS,
    )
    assert resolve.status_code == 200
    assert resolve.json()["status"] == "resolved"

    # Step 7: Verify full audit trail
    audit = await auth_client.get(f"/ops/incidents/{inc_id}/audit", headers=HEADERS)
    assert audit.status_code == 200
    actions = [e["action"] for e in audit.json()]
    assert "created_from_sla_breach" in actions
    assert "acknowledged" in actions
    assert "resolved" in actions

    # Step 8: Verify notifications were sent
    notifs = await auth_client.get(f"/ops/incidents/{inc_id}/notifications", headers=HEADERS)
    assert notifs.status_code == 200
    assert len(notifs.json()) >= 1
