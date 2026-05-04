"""
Tests for DEPOT-V7: Perimeter Monitoring
"""
import pytest

HEADERS = {"x-user-id": "test-user"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_zone(auth_client, name="Test Zone", zone_type="restricted"):
    resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={"name": name, "zone_type": zone_type, "alert_on_entry": True},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Zone tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_zone(auth_client):
    resp = await auth_client.post(
        "/depot/vision/perimeter/zones",
        json={
            "name": "Server Room",
            "zone_type": "restricted",
            "alert_on_entry": True,
            "alert_severity": "critical",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Server Room"
    assert data["zone_type"] == "restricted"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_zones(auth_client):
    await _create_zone(auth_client, "Zone-List-1")
    await _create_zone(auth_client, "Zone-List-2")
    resp = await auth_client.get("/depot/vision/perimeter/zones", headers=HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_list_zones_filter_by_type(auth_client):
    await _create_zone(auth_client, "Hazard Zone", "hazardous")
    resp = await auth_client.get(
        "/depot/vision/perimeter/zones?zone_type=hazardous",
        headers=HEADERS,
    )
    assert resp.status_code == 200
    for z in resp.json():
        assert z["zone_type"] == "hazardous"


@pytest.mark.asyncio
async def test_get_zone(auth_client):
    zone = await _create_zone(auth_client, "Get-Zone-Test")
    resp = await auth_client.get(f"/depot/vision/perimeter/zones/{zone['id']}", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["id"] == zone["id"]


@pytest.mark.asyncio
async def test_get_zone_not_found(auth_client):
    resp = await auth_client.get(
        "/depot/vision/perimeter/zones/00000000-0000-0000-0000-000000000000",
        headers=HEADERS,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_deactivate_zone(auth_client):
    zone = await _create_zone(auth_client, "Deactivate-Me")
    resp = await auth_client.patch(
        f"/depot/vision/perimeter/zones/{zone['id']}/deactivate",
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_create_zone_requires_auth(client):
    resp = await client.post(
        "/depot/vision/perimeter/zones",
        json={"name": "No Auth Zone", "zone_type": "general"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Breach tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_breach(auth_client):
    zone = await _create_zone(auth_client, "Breach-Zone")
    resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": zone["id"],
            "breach_type": "unauthorized_entry",
            "confidence": 0.92,
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["zone_id"] == zone["id"]
    assert data["breach_type"] == "unauthorized_entry"
    assert data["resolved_at"] is None


@pytest.mark.asyncio
async def test_simulate_breach(auth_client):
    zone = await _create_zone(auth_client, "Sim-Zone")
    resp = await auth_client.post(
        "/depot/vision/perimeter/breaches/simulate",
        json={"zone_id": zone["id"], "breach_type": "loitering", "confidence": 0.75},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["snapshot_ref"] == "simulated://frame-0"


@pytest.mark.asyncio
async def test_list_breaches(auth_client):
    zone = await _create_zone(auth_client, "List-Breach-Zone")
    await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={"zone_id": zone["id"], "confidence": 0.8},
        headers=HEADERS,
    )
    resp = await auth_client.get("/depot/vision/perimeter/breaches", headers=HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_active_breaches(auth_client):
    zone = await _create_zone(auth_client, "Active-Breach-Zone")
    await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={"zone_id": zone["id"], "confidence": 0.9},
        headers=HEADERS,
    )
    resp = await auth_client.get("/depot/vision/perimeter/breaches/active", headers=HEADERS)
    assert resp.status_code == 200
    for b in resp.json():
        assert b["resolved_at"] is None


@pytest.mark.asyncio
async def test_resolve_breach(auth_client):
    zone = await _create_zone(auth_client, "Resolve-Zone")
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={"zone_id": zone["id"], "confidence": 0.85},
        headers=HEADERS,
    )
    breach_id = breach_resp.json()["id"]
    resolve_resp = await auth_client.patch(
        f"/depot/vision/perimeter/breaches/{breach_id}/resolve",
        json={"resolution_notes": "False alarm — authorised staff"},
        headers=HEADERS,
    )
    assert resolve_resp.status_code == 200
    data = resolve_resp.json()
    assert data["resolved_at"] is not None
    assert data["resolved_by"] is not None  # UUID of the authenticated user


@pytest.mark.asyncio
async def test_resolve_already_resolved(auth_client):
    zone = await _create_zone(auth_client, "Double-Resolve-Zone")
    breach_resp = await auth_client.post(
        "/depot/vision/perimeter/breaches",
        json={"zone_id": zone["id"], "confidence": 0.7},
        headers=HEADERS,
    )
    breach_id = breach_resp.json()["id"]
    # resolve once
    await auth_client.patch(
        f"/depot/vision/perimeter/breaches/{breach_id}/resolve",
        json={},
        headers=HEADERS,
    )
    # resolve again — should 409
    resp = await auth_client.patch(
        f"/depot/vision/perimeter/breaches/{breach_id}/resolve",
        json={},
        headers=HEADERS,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_breach_requires_auth(client):
    resp = await client.post(
        "/depot/vision/perimeter/breaches",
        json={
            "zone_id": "00000000-0000-0000-0000-000000000000",
            "confidence": 0.9,
        },
    )
    assert resp.status_code == 401
