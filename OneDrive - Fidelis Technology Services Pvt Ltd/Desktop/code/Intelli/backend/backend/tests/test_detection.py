"""
Tests for DEPOT-V2: Bag/Box Detection
"""
import pytest

HEADERS = {"x-user-id": "test-user"}


# ---------------------------------------------------------------------------
# Detection Model tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_detection_model(auth_client):
    resp = await auth_client.post(
        "/depot/vision/detection/models",
        json={
            "model_name": "depot-yolov8n",
            "model_version": "v8n",
            "confidence_threshold": 0.45,
            "iou_threshold": 0.50,
            "target_classes": "bag,box",
        },
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["model_name"] == "depot-yolov8n"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_list_detection_models(auth_client):
    # register one first
    await auth_client.post(
        "/depot/vision/detection/models",
        json={"model_name": "model-list-test", "target_classes": "bag"},
        headers=HEADERS,
    )
    resp = await auth_client.get("/depot/vision/detection/models", headers=HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_detection_model(auth_client):
    create = await auth_client.post(
        "/depot/vision/detection/models",
        json={"model_name": "model-get-test", "target_classes": "box"},
        headers=HEADERS,
    )
    model_id = create.json()["id"]
    resp = await auth_client.get(f"/depot/vision/detection/models/{model_id}", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["id"] == model_id


@pytest.mark.asyncio
async def test_get_model_not_found(auth_client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await auth_client.get(f"/depot/vision/detection/models/{fake_id}", headers=HEADERS)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_register_model_requires_auth(client):
    resp = await client.post(
        "/depot/vision/detection/models",
        json={"model_name": "no-auth", "target_classes": "bag"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Detection Run tests
# ---------------------------------------------------------------------------

async def _create_model(auth_client, name="run-test-model"):
    r = await auth_client.post(
        "/depot/vision/detection/models",
        json={"model_name": name, "target_classes": "bag,box"},
        headers=HEADERS,
    )
    return r.json()["id"]


@pytest.mark.asyncio
async def test_start_detection_run(auth_client):
    model_id = await _create_model(auth_client)
    resp = await auth_client.post(
        "/depot/vision/detection/runs",
        json={"model_id": model_id, "frame_count": 5},
        headers=HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "completed"
    assert data["frame_count"] == 5
    assert data["total_detections"] >= 0


@pytest.mark.asyncio
async def test_run_creates_objects(auth_client):
    model_id = await _create_model(auth_client, "objects-test-model")
    run_resp = await auth_client.post(
        "/depot/vision/detection/runs",
        json={"model_id": model_id, "frame_count": 10},
        headers=HEADERS,
    )
    run_id = run_resp.json()["id"]
    resp = await auth_client.get(f"/depot/vision/detection/runs/{run_id}/objects", headers=HEADERS)
    assert resp.status_code == 200
    # total_detections on the run should match number of objects returned
    total = run_resp.json()["total_detections"]
    assert len(resp.json()) == total


@pytest.mark.asyncio
async def test_run_summary(auth_client):
    model_id = await _create_model(auth_client, "summary-test-model")
    run_resp = await auth_client.post(
        "/depot/vision/detection/runs",
        json={"model_id": model_id, "frame_count": 3},
        headers=HEADERS,
    )
    run_id = run_resp.json()["id"]
    resp = await auth_client.get(f"/depot/vision/detection/runs/{run_id}", headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "run" in data
    assert "detections_by_class" in data
    assert "average_confidence" in data


@pytest.mark.asyncio
async def test_list_runs(auth_client):
    model_id = await _create_model(auth_client, "list-runs-model")
    await auth_client.post(
        "/depot/vision/detection/runs",
        json={"model_id": model_id, "frame_count": 2},
        headers=HEADERS,
    )
    resp = await auth_client.get("/depot/vision/detection/runs", headers=HEADERS)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_run_invalid_model(auth_client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await auth_client.post(
        "/depot/vision/detection/runs",
        json={"model_id": fake_id, "frame_count": 1},
        headers=HEADERS,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_requires_auth(client):
    fake_id = "00000000-0000-0000-0000-000000000001"
    resp = await client.post(
        "/depot/vision/detection/runs",
        json={"model_id": fake_id, "frame_count": 1},
    )
    assert resp.status_code == 401
