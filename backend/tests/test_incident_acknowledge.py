"""
Test suite for PATCH /depot/vision/perimeter/incidents/{incident_id}/acknowledge endpoint.

This test verifies Requirements 6.2 and 6.3 from the incidents-data-restoration spec.
"""
import pytest
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_acknowledge_incident_endpoint(auth_client):
    """
    Test that the acknowledge endpoint:
    - Accepts 'reason' in request body
    - Updates status to 'acknowledged'
    - Sets acknowledged_at to current timestamp
    - Sets acknowledged_by to current user
    - Returns the updated incident
    
    Requirements: 6.2, 6.3
    """
    # Setup: Create a zone
    zone_resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={
            "name": "Test Acknowledge Zone",
            "zone_type": "controlled",
            "alert_on_entry": True,
            "alert_severity": "high",
        },
    )
    assert zone_resp.status_code == 201
    zone = zone_resp.json()
    
    # Setup: Create a breach
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": zone["id"],
            "breach_type": "unauthorized_entry",
            "severity": "high",
            "confidence": 0.95,
            "alert_sent": True,
        },
    )
    assert breach_resp.status_code == 201
    breach = breach_resp.json()
    
    # Setup: Create an incident from the breach
    incident_resp = await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
    )
    assert incident_resp.status_code == 201
    incident = incident_resp.json()
    
    # Verify initial state
    assert incident["status"] == "open"
    assert incident["acknowledged_at"] is None
    assert incident["acknowledged_by"] is None
    
    # Record time before acknowledgement
    time_before = datetime.now(timezone.utc)
    
    # Test: Acknowledge the incident with a reason
    ack_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/acknowledge",
        json={"reason": "Security team dispatched to investigate"},
    )
    
    # Verify response status
    assert ack_resp.status_code == 200
    
    # Verify the response contains the updated incident
    acked_incident = ack_resp.json()
    
    # Requirement 6.2: Verify status is updated to "acknowledged"
    assert acked_incident["status"] == "acknowledged", "Status should be 'acknowledged'"
    
    # Requirement 6.3: Verify acknowledged_at is set to current timestamp
    assert acked_incident["acknowledged_at"] is not None, "acknowledged_at should be set"
    ack_time = datetime.fromisoformat(acked_incident["acknowledged_at"].replace("Z", "+00:00"))
    time_after = datetime.now(timezone.utc)
    assert time_before <= ack_time <= time_after, "acknowledged_at should be current timestamp"
    
    # Requirement 6.3: Verify acknowledged_by is set to current user
    assert acked_incident["acknowledged_by"] is not None, "acknowledged_by should be set"
    # The user ID should be a valid UUID string
    assert len(acked_incident["acknowledged_by"]) > 0, "acknowledged_by should contain user ID"
    
    # Requirement 6.2: Verify the reason is stored (appended to description)
    assert "Security team dispatched to investigate" in acked_incident.get("description", ""), \
        "Reason should be appended to description"
    
    # Requirement 6.3: Verify it returns the updated incident (same ID)
    assert acked_incident["id"] == incident["id"], "Should return the same incident"


@pytest.mark.asyncio
async def test_acknowledge_incident_with_minimal_reason(auth_client):
    """
    Test that the acknowledge endpoint accepts a reason with minimum length (5 characters).
    
    Requirements: 6.2
    """
    # Setup: Create zone, breach, and incident
    zone_resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={
            "name": "Test Min Reason Zone",
            "zone_type": "controlled",
            "alert_on_entry": True,
            "alert_severity": "medium",
        },
    )
    zone = zone_resp.json()
    
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": zone["id"],
            "breach_type": "loitering",
            "severity": "medium",
            "alert_sent": True,
        },
    )
    breach = breach_resp.json()
    
    incident_resp = await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
    )
    incident = incident_resp.json()
    
    # Test: Acknowledge with minimal reason (5 characters)
    ack_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/acknowledge",
        json={"reason": "Check"},  # Exactly 5 characters
    )
    
    assert ack_resp.status_code == 200
    acked = ack_resp.json()
    assert acked["status"] == "acknowledged"


@pytest.mark.asyncio
async def test_acknowledge_incident_rejects_short_reason(auth_client):
    """
    Test that the acknowledge endpoint rejects a reason shorter than 5 characters.
    
    Requirements: 6.2
    """
    # Setup: Create zone, breach, and incident
    zone_resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={
            "name": "Test Short Reason Zone",
            "zone_type": "controlled",
            "alert_on_entry": True,
            "alert_severity": "low",
        },
    )
    zone = zone_resp.json()
    
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": zone["id"],
            "breach_type": "object_left",
            "severity": "low",
            "alert_sent": False,
        },
    )
    breach = breach_resp.json()
    
    incident_resp = await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
    )
    incident = incident_resp.json()
    
    # Test: Acknowledge with too short reason (4 characters)
    ack_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/acknowledge",
        json={"reason": "Test"},  # Only 4 characters
    )
    
    # Should return 422 Unprocessable Entity due to validation error
    assert ack_resp.status_code == 422


@pytest.mark.asyncio
async def test_acknowledge_nonexistent_incident(auth_client):
    """
    Test that acknowledging a non-existent incident returns 404.
    
    Requirements: 6.2
    """
    # Test: Try to acknowledge a non-existent incident
    fake_id = "00000000-0000-0000-0000-000000000000"
    ack_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{fake_id}/acknowledge",
        json={"reason": "This should fail"},
    )
    
    assert ack_resp.status_code == 404
    assert "not found" in ack_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_acknowledge_already_resolved_incident(auth_client):
    """
    Test that acknowledging an already resolved incident returns 409.
    
    Requirements: 6.2
    """
    # Setup: Create zone, breach, and incident
    zone_resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={
            "name": "Test Resolved Zone",
            "zone_type": "controlled",
            "alert_on_entry": True,
            "alert_severity": "high",
        },
    )
    zone = zone_resp.json()
    
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": zone["id"],
            "breach_type": "forced_entry",
            "severity": "critical",
            "alert_sent": True,
        },
    )
    breach = breach_resp.json()
    
    incident_resp = await auth_client.post(
        f"/depot/vision/perimeter/incidents/from-breach/{breach['id']}",
    )
    incident = incident_resp.json()
    
    # First, resolve the incident
    resolve_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/resolve",
        json={"resolution_notes": "False alarm - maintenance crew"},
    )
    assert resolve_resp.status_code == 200
    
    # Test: Try to acknowledge the already resolved incident
    ack_resp = await auth_client.patch(
        f"/depot/vision/perimeter/incidents/{incident['id']}/acknowledge",
        json={"reason": "This should fail"},
    )
    
    assert ack_resp.status_code == 409
    assert "already resolved" in ack_resp.json()["detail"].lower()
