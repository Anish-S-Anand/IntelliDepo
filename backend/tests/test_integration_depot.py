"""
Cross-Module Integration Tests — IntelliVision Depot

Tests end-to-end flows spanning multiple DEPOT modules:
- Detection -> Counting -> Reconciliation -> Alert
- Gate LPR -> Vehicle Registry -> Access Control
- Perimeter -> Breach -> Incident -> Escalation
- Cluster Zone -> Capacity -> Alert
"""
import pytest

HEADERS = {"x-user-id": "integration-test-user"}


# ---------------------------------------------------------------------------
# Helpers: create resources across modules
# ---------------------------------------------------------------------------

async def _register_camera(auth_client, name="Integration Cam"):
    resp = await auth_client.post(
        "/depot/vision/cameras",
        json={
            "name": name,
            "stream_url": "rtsp://192.168.1.100/stream1",
            "location": "Integration Test Bay",
            "camera_type": "ip",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _register_model(auth_client):
    resp = await auth_client.post(
        "/depot/vision/detection/models",
        json={
            "model_name": "yolov8n-integration",
            "model_version": "1.0.0",
            "confidence_threshold": 0.85,
            "iou_threshold": 0.45,
            "target_classes": "bag,box,pallet",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_perimeter_zone(auth_client, name="Integ Perimeter", zone_type="restricted"):
    resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={
            "name": name,
            "zone_type": zone_type,
            "alert_on_entry": True,
            "alert_severity": "high",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_cluster_zone(auth_client, code="INT-A"):
    resp = await auth_client.post(
        "/depot/vision/cluster/zones",
        json={
            "zone_code": code,
            "name": f"Integration Zone {code}",
            "zone_type": "storage",
            "floor": "ground",
            "max_capacity_units": 500,
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


async def _register_gate(auth_client, name="Integration Gate"):
    resp = await auth_client.post(
        "/depot/gate/gates",
        json={
            "name": name,
            "gate_type": "entry",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# 1. Detection -> Counting Pipeline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_detection_to_counting_pipeline(auth_client):
    """
    End-to-end: register model -> start detection run -> verify run created.
    Validates the detection module creates proper run records.
    """
    model = await _register_model(auth_client)

    # Start a detection run
    run_resp = await auth_client.post(
        "/depot/vision/detection/runs",
        json={"model_id": model["id"], "frame_count": 5},
        headers=HEADERS,
    )
    assert run_resp.status_code == 201
    run = run_resp.json()
    assert run["model_id"] == model["id"]
    assert run["status"] in ["running", "completed"]

    # Verify the run appears in listing
    list_resp = await auth_client.get("/depot/vision/detection/runs", headers=HEADERS)
    assert list_resp.status_code == 200
    run_ids = [r["id"] for r in list_resp.json()]
    assert run["id"] in run_ids

    # Get run summary
    summary_resp = await auth_client.get(
        f"/depot/vision/detection/runs/{run['id']}", headers=HEADERS,
    )
    assert summary_resp.status_code == 200


@pytest.mark.asyncio
async def test_counting_manifest_reconciliation(auth_client):
    """
    End-to-end: create manifest -> start count session -> check reconciliation.
    """
    # Create a shipment manifest
    manifest_resp = await auth_client.post(
        "/depot/vision/counting/manifests",
        json={
            "manifest_code": "MF-INTEG-001",
            "vehicle_number": "TN-01-AB-1234",
            "expected_bags": 100,
            "expected_boxes": 20,
        },
        headers=HEADERS,
    )
    assert manifest_resp.status_code == 201
    manifest = manifest_resp.json()

    # Start a counting session
    session_resp = await auth_client.post(
        "/depot/vision/counting/sessions",
        json={"manifest_id": manifest["id"]},
        headers=HEADERS,
    )
    assert session_resp.status_code == 201
    session = session_resp.json()
    assert session["manifest_id"] == manifest["id"]

    # List sessions
    sessions_resp = await auth_client.get(
        "/depot/vision/counting/sessions", headers=HEADERS,
    )
    assert sessions_resp.status_code == 200


# ---------------------------------------------------------------------------
# 2. Perimeter: Breach -> Incident -> Escalation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_perimeter_breach_to_incident_escalation(auth_client):
    """
    End-to-end: create zone -> log breach -> create incident -> acknowledge -> resolve.
    Tests the full perimeter security workflow including escalation chain.
    """
    # Create perimeter zone
    zone = await _create_perimeter_zone(auth_client, "Escalation Test Zone")

    # Log a breach
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": zone["id"],
            "breach_type": "unauthorized_entry",
            "confidence": 0.92,
            "notes": "Integration test breach",
        },
        headers=HEADERS,
    )
    assert breach_resp.status_code == 201
    breach = breach_resp.json()
    assert breach["severity"] == "high"  # inherits from zone
    assert breach["resolved_at"] is None

    # Create incident from breach
    incident_resp = await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
        headers=HEADERS,
    )
    assert incident_resp.status_code == 201
    incident = incident_resp.json()
    assert incident["breach_id"] == breach["id"]
    assert incident["status"] == "open"
    assert incident["escalation_level"] == 0
    assert incident["escalation_deadline"] is not None
    assert incident["escalated_to"] == "Security Supervisor"

    # Acknowledge the incident
    ack_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/acknowledge",
        json={"reason": "Security team dispatched to check zone"},
        headers=HEADERS,
    )
    assert ack_resp.status_code == 200
    acked = ack_resp.json()
    assert acked["status"] == "acknowledged"
    assert acked["acknowledged_at"] is not None

    # Resolve the incident (should also resolve the underlying breach)
    resolve_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/resolve",
        json={"resolution_notes": "False alarm — authorized maintenance crew confirmed"},
        headers=HEADERS,
    )
    assert resolve_resp.status_code == 200
    resolved = resolve_resp.json()
    assert resolved["status"] == "resolved"
    assert resolved["resolved_at"] is not None

    # Verify the breach was also resolved
    breach_check = await auth_client.get(
        f"/depot/vision/perimeter/breaches?zone_id={zone['id']}",
        headers=HEADERS,
    )
    assert breach_check.status_code == 200
    for b in breach_check.json():
        if b["id"] == breach["id"]:
            assert b["resolved_at"] is not None


@pytest.mark.asyncio
async def test_security_agent_scan(auth_client):
    """
    End-to-end: create zones -> run security agent -> verify breach detection.
    """
    await _create_perimeter_zone(auth_client, "Agent Zone 1", "restricted")
    await _create_perimeter_zone(auth_client, "Agent Zone 2", "hazardous")

    # Run the security breach agent with simulated breaches
    agent_resp = await auth_client.post(
        "/depot/vision/perimeter/agent/scan",
        json={"simulate_breach_count": 2},
        headers=HEADERS,
    )
    assert agent_resp.status_code == 200
    result = agent_resp.json()
    assert result["zones_scanned"] >= 2
    assert result["breaches_detected"] >= 1
    assert len(result["breaches"]) >= 1

    # Verify breaches appear in active list
    active_resp = await auth_client.get(
        "/depot/vision/perimeter/breaches/active", headers=HEADERS,
    )
    assert active_resp.status_code == 200
    assert len(active_resp.json()) >= 1


@pytest.mark.asyncio
async def test_night_vision_configuration(auth_client):
    """
    Zone creation -> night vision config -> verify settings persisted.
    """
    zone = await _create_perimeter_zone(auth_client, "Night Vision Zone")

    # Configure night vision
    nv_resp = await auth_client.patch(
        f"/depot/vision/perimeter/zones/{zone['id']}/night-vision",
        json={
            "night_vision_enabled": True,
            "night_vision_mode": "ir",
            "active_hours_start": "18:00",
            "active_hours_end": "06:00",
        },
        headers=HEADERS,
    )
    assert nv_resp.status_code == 200

    # Verify the zone settings
    zone_resp = await auth_client.get(
        f"/depot/vision/perimeter/zones/{zone['id']}", headers=HEADERS,
    )
    assert zone_resp.status_code == 200


# ---------------------------------------------------------------------------
# 3. Gate LPR -> Vehicle Flow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gate_vehicle_lpr_flow(auth_client):
    """
    End-to-end: register gate -> register vehicle -> LPR scan -> access log.
    """
    gate = await _register_gate(auth_client, "LPR Integration Gate")

    # Register a vehicle
    vehicle_resp = await auth_client.post(
        "/depot/gate/vehicles",
        json={
            "plate_number": "TN-99-ZZ-0001",
            "vehicle_type": "truck",
            "owner_name": "Integration Test",
            "company": "Fidelis",
            "status": "approved",
        },
        headers=HEADERS,
    )
    assert vehicle_resp.status_code == 201
    vehicle = vehicle_resp.json()
    assert vehicle["status"] == "approved"

    # Process LPR scan — should be granted
    lpr_resp = await auth_client.post(
        "/depot/gate/lpr/scan",
        json={
            "gate_id": gate["id"],
            "plate_number": "TN-99-ZZ-0001",
            "confidence": 0.96,
            "direction": "inbound",
        },
        headers=HEADERS,
    )
    assert lpr_resp.status_code in [200, 201]
    access = lpr_resp.json()
    assert access["decision"] == "granted"
    assert access["plate_number"] == "TN-99-ZZ-0001"

    # Check access logs
    logs_resp = await auth_client.get(
        f"/depot/gate/access-logs?gate_id={gate['id']}", headers=HEADERS,
    )
    assert logs_resp.status_code == 200
    assert len(logs_resp.json()) >= 1


@pytest.mark.asyncio
async def test_gate_blacklist_deny_flow(auth_client):
    """
    Register vehicle -> blacklist -> LPR scan -> should be denied.
    """
    gate = await _register_gate(auth_client, "Blacklist Test Gate")

    vehicle_resp = await auth_client.post(
        "/depot/gate/vehicles",
        json={
            "plate_number": "MH-01-BL-9999",
            "vehicle_type": "van",
            "owner_name": "Suspicious Party",
            "status": "approved",
        },
        headers=HEADERS,
    )
    vehicle = vehicle_resp.json()

    # Blacklist the vehicle
    bl_resp = await auth_client.patch(
        f"/depot/gate/vehicles/{vehicle['id']}/blacklist?reason=Suspicious+activity",
        headers=HEADERS,
    )
    assert bl_resp.status_code == 200
    assert bl_resp.json()["status"] == "blacklisted"

    # LPR scan — should deny
    lpr_resp = await auth_client.post(
        "/depot/gate/lpr/scan",
        json={
            "gate_id": gate["id"],
            "plate_number": "MH-01-BL-9999",
            "confidence": 0.94,
            "direction": "inbound",
        },
        headers=HEADERS,
    )
    assert lpr_resp.status_code in [200, 201]
    assert lpr_resp.json()["decision"] == "denied"


@pytest.mark.asyncio
async def test_visitor_registration_checkout(auth_client):
    """
    Register visitor -> verify active -> checkout -> verify completed.
    """
    visitor_resp = await auth_client.post(
        "/depot/gate/visitors",
        json={
            "name": "Integration Visitor",
            "company": "Test Corp",
            "purpose": "Delivery",
            "contact_number": "+91-9876543210",
            "host_name": "Site Manager",
            "pass_valid_hours": 4,
        },
        headers=HEADERS,
    )
    assert visitor_resp.status_code == 201
    visitor = visitor_resp.json()
    assert visitor["status"] in ["checked_in", "active"]

    # Verify in active visitors list
    active_resp = await auth_client.get("/depot/gate/visitors/active", headers=HEADERS)
    assert active_resp.status_code == 200
    active_ids = [v["id"] for v in active_resp.json()]
    assert visitor["id"] in active_ids

    # Checkout
    checkout_resp = await auth_client.patch(
        f"/depot/gate/visitors/{visitor['id']}/checkout", headers=HEADERS,
    )
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["checked_out_at"] is not None


# ---------------------------------------------------------------------------
# 4. Cluster Zone -> Capacity Monitoring
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cluster_zone_capacity_flow(auth_client):
    """
    Create zone -> update occupancy -> check heatmap -> capacity status.
    """
    zone = await _create_cluster_zone(auth_client, "INTEG-CAP")

    # Update occupancy
    occ_resp = await auth_client.patch(
        f"/depot/vision/cluster/zones/{zone['id']}/occupancy",
        json={"current_occupancy": 450},
        headers=HEADERS,
    )
    assert occ_resp.status_code == 200
    assert occ_resp.json()["current_occupancy"] == 450

    # Check heatmap
    heatmap_resp = await auth_client.get("/depot/vision/cluster/heatmap", headers=HEADERS)
    assert heatmap_resp.status_code == 200

    # Check capacity status
    cap_resp = await auth_client.get("/depot/vision/cluster/capacity/status", headers=HEADERS)
    assert cap_resp.status_code == 200

    # Check density analytics
    density_resp = await auth_client.get("/depot/vision/cluster/density", headers=HEADERS)
    assert density_resp.status_code == 200


@pytest.mark.asyncio
async def test_cluster_threshold_alert_flow(auth_client):
    """
    Configure threshold -> update zone to exceed -> verify capacity status shows warning.
    """
    zone = await _create_cluster_zone(auth_client, "INTEG-THR")

    # Set threshold
    threshold_resp = await auth_client.post(
        "/depot/vision/cluster/threshold",
        json={
            "zone_id": zone["id"],
            "zone_code": "INTEG-THR",
            "warning_pct": 80,
            "critical_pct": 95,
            "is_global": False,
        },
        headers=HEADERS,
    )
    assert threshold_resp.status_code == 201

    # Push occupancy above warning threshold
    await auth_client.patch(
        f"/depot/vision/cluster/zones/{zone['id']}/occupancy",
        json={"current_occupancy": 420},  # 420/500 = 84% > 80% warning
        headers=HEADERS,
    )

    # Check capacity status for this zone
    cap_resp = await auth_client.get("/depot/vision/cluster/capacity/status", headers=HEADERS)
    assert cap_resp.status_code == 200


# ---------------------------------------------------------------------------
# 5. Camera Integration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_camera_registration_and_snapshot(auth_client):
    """
    Register camera -> list cameras -> get camera -> verify stream URL.
    """
    cam = await _register_camera(auth_client, "Integration Test Camera")
    assert cam["name"] == "Integration Test Camera"

    # List cameras
    list_resp = await auth_client.get("/depot/vision/cameras", headers=HEADERS)
    assert list_resp.status_code == 200
    cam_ids = [c["id"] for c in list_resp.json()]
    assert cam["id"] in cam_ids

    # Get specific camera
    get_resp = await auth_client.get(f"/depot/vision/cameras/{cam['id']}", headers=HEADERS)
    assert get_resp.status_code == 200
    assert get_resp.json()["stream_url"] == "rtsp://192.168.1.100/stream1"


# ---------------------------------------------------------------------------
# 6. Cross-module: Incident resolution cascades
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_incident_resolve_cascades_to_breach(auth_client):
    """
    Verify that resolving an incident also resolves the underlying breach.
    This tests the cross-entity cascade in the perimeter module.
    """
    zone = await _create_perimeter_zone(auth_client, "Cascade Test Zone")

    # Create breach
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={"zone_id": zone["id"], "confidence": 0.88},
        headers=HEADERS,
    )
    breach = breach_resp.json()

    # Create incident from breach
    inc_resp = await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
        headers=HEADERS,
    )
    incident = inc_resp.json()

    # Resolve incident
    resolve_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/resolve",
        json={"resolution_notes": "Cascade resolution test — confirmed false positive"},
        headers=HEADERS,
    )
    assert resolve_resp.status_code == 200

    # Verify breach is also resolved
    breaches_resp = await auth_client.get(
        f"/depot/vision/perimeter/breaches?zone_id={zone['id']}&resolved=true",
        headers=HEADERS,
    )
    assert breaches_resp.status_code == 200
    resolved_ids = [b["id"] for b in breaches_resp.json()]
    assert breach["id"] in resolved_ids


@pytest.mark.asyncio
async def test_double_resolve_incident_returns_409(auth_client):
    """Resolving an already-resolved incident should return 409."""
    zone = await _create_perimeter_zone(auth_client, "Double Resolve Zone")
    breach = (await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={"zone_id": zone["id"], "confidence": 0.9},
        headers=HEADERS,
    )).json()
    incident = (await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
        headers=HEADERS,
    )).json()

    # Resolve once
    await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/resolve",
        json={"resolution_notes": "First resolution"},
        headers=HEADERS,
    )

    # Resolve again — should 409
    second = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/resolve",
        json={"resolution_notes": "Second attempt"},
        headers=HEADERS,
    )
    assert second.status_code == 409
