"""
Tests for Day 3 — DEPOT-V1: Camera Feed Integration
"""
import pytest


# --- Register a camera ---

@pytest.mark.asyncio
async def test_register_camera_success(client):
    response = await client.post("/depot/vision/cameras/register", json={
        "name": "Gate-A Camera 1",
        "stream_url": "rtsp://192.168.1.10:554/stream1",
        "protocol": "rtsp",
        "zone": "Zone-A",
        "frame_rate": 25,
        "resolution": "1920x1080"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Gate-A Camera 1"
    assert data["zone"] == "Zone-A"
    assert data["status"] == "active"
    assert "id" in data


@pytest.mark.asyncio
async def test_register_camera_defaults(client):
    response = await client.post("/depot/vision/cameras/register", json={
        "name": "Entry Camera",
        "stream_url": "rtsp://10.0.0.1:554/stream"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["frame_rate"] == 25
    assert data["resolution"] == "1920x1080"
    assert data["protocol"] == "rtsp"


# --- List cameras ---

@pytest.mark.asyncio
async def test_list_cameras_empty(client):
    response = await client.get("/depot/vision/cameras/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_cameras_after_register(client):
    await client.post("/depot/vision/cameras/register", json={
        "name": "Camera 1", "stream_url": "rtsp://1.1.1.1/s1", "zone": "Zone-A"
    })
    await client.post("/depot/vision/cameras/register", json={
        "name": "Camera 2", "stream_url": "rtsp://1.1.1.2/s2", "zone": "Zone-B"
    })
    response = await client.get("/depot/vision/cameras/")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_list_cameras_filter_by_zone(client):
    await client.post("/depot/vision/cameras/register", json={
        "name": "Camera A", "stream_url": "rtsp://1.1.1.1/s1", "zone": "Zone-A"
    })
    await client.post("/depot/vision/cameras/register", json={
        "name": "Camera B", "stream_url": "rtsp://1.1.1.2/s2", "zone": "Zone-B"
    })
    response = await client.get("/depot/vision/cameras/?zone=Zone-A")
    assert response.status_code == 200
    cameras = response.json()
    assert len(cameras) == 1
    assert cameras[0]["zone"] == "Zone-A"


# --- Get single camera ---

@pytest.mark.asyncio
async def test_get_camera_by_id(client):
    create = await client.post("/depot/vision/cameras/register", json={
        "name": "Test Cam", "stream_url": "rtsp://1.1.1.1/s1"
    })
    camera_id = create.json()["id"]
    response = await client.get(f"/depot/vision/cameras/{camera_id}")
    assert response.status_code == 200
    assert response.json()["id"] == camera_id


@pytest.mark.asyncio
async def test_get_camera_not_found(client):
    response = await client.get("/depot/vision/cameras/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


# --- Extract frame ---

@pytest.mark.asyncio
async def test_get_frame_from_active_camera(client):
    create = await client.post("/depot/vision/cameras/register", json={
        "name": "Frame Cam", "stream_url": "rtsp://1.1.1.1/s1"
    })
    camera_id = create.json()["id"]
    response = await client.get(f"/depot/vision/cameras/{camera_id}/frame")
    assert response.status_code == 200
    frame = response.json()
    assert frame["camera_id"] == camera_id
    assert frame["width"] == 1920
    assert frame["height"] == 1080
    assert frame["format"] == "JPEG"


# --- Deactivate camera ---

@pytest.mark.asyncio
async def test_deactivate_camera(client):
    create = await client.post("/depot/vision/cameras/register", json={
        "name": "Del Cam", "stream_url": "rtsp://1.1.1.1/s1"
    })
    camera_id = create.json()["id"]
    response = await client.delete(f"/depot/vision/cameras/{camera_id}")
    assert response.status_code == 204

    get = await client.get(f"/depot/vision/cameras/{camera_id}")
    assert get.status_code == 404


# --- Active streams ---

@pytest.mark.asyncio
async def test_active_streams_endpoint(client):
    response = await client.get("/depot/vision/cameras/streams/active")
    assert response.status_code == 200
    assert "active_count" in response.json()
    assert "streams" in response.json()
