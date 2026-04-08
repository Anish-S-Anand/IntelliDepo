"""
Tests for Day 3 — DEPOT-INV1: Inventory Management Core
"""
import pytest

HEADERS = {"x-user-id": "test-user-123"}


# --- SKU Tests ---

@pytest.mark.asyncio
async def test_create_sku_success(auth_client):
    response = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-001",
        "name": "Industrial Gloves",
        "category": "Safety",
        "unit_of_measure": "unit"
    }, headers=HEADERS)
    assert response.status_code == 201
    data = response.json()
    assert data["sku_code"] == "SKU-001"
    assert data["name"] == "Industrial Gloves"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_sku_duplicate_rejected(auth_client):
    payload = {"sku_code": "SKU-DUP", "name": "Item"}
    await auth_client.post("/depot/inventory/skus", json=payload, headers=HEADERS)
    response = await auth_client.post("/depot/inventory/skus", json=payload, headers=HEADERS)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_sku_requires_auth(client):
    response = await client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-NOAUTH", "name": "Test"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_skus(auth_client):
    await auth_client.post("/depot/inventory/skus", json={"sku_code": "SKU-A", "name": "A"}, headers=HEADERS)
    await auth_client.post("/depot/inventory/skus", json={"sku_code": "SKU-B", "name": "B"}, headers=HEADERS)
    response = await auth_client.get("/depot/inventory/skus", headers=HEADERS)
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_list_skus_filter_by_category(auth_client):
    await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-S1", "name": "Safety Item", "category": "Safety"
    }, headers=HEADERS)
    await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-T1", "name": "Tool", "category": "Tools"
    }, headers=HEADERS)
    response = await auth_client.get("/depot/inventory/skus?category=Safety", headers=HEADERS)
    assert response.status_code == 200
    skus = response.json()
    assert len(skus) == 1
    assert skus[0]["category"] == "Safety"


@pytest.mark.asyncio
async def test_get_sku_by_id(auth_client):
    create = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-GET", "name": "Get Me"
    }, headers=HEADERS)
    sku_id = create.json()["id"]
    response = await auth_client.get(f"/depot/inventory/skus/{sku_id}", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["id"] == sku_id


@pytest.mark.asyncio
async def test_lookup_sku_by_barcode(auth_client):
    await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-BC", "name": "Barcode Item", "barcode": "1234567890123"
    }, headers=HEADERS)
    response = await auth_client.get("/depot/inventory/skus/barcode/1234567890123", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["barcode"] == "1234567890123"


@pytest.mark.asyncio
async def test_lookup_barcode_not_found(auth_client):
    response = await auth_client.get("/depot/inventory/skus/barcode/9999999999999", headers=HEADERS)
    assert response.status_code == 404


# --- Inventory Item Tests ---

@pytest.mark.asyncio
async def test_add_inventory_item(auth_client):
    sku = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-INV1", "name": "Inventory Test"
    }, headers=HEADERS)
    sku_id = sku.json()["id"]

    response = await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku_id,
        "zone": "Zone-A",
        "rack": "R-01",
        "bin_location": "B-01",
        "quantity": 100,
        "reorder_level": 10
    }, headers=HEADERS)
    assert response.status_code == 201
    data = response.json()
    assert data["quantity"] == 100
    assert data["zone"] == "Zone-A"
    assert data["status"] == "in_stock"


@pytest.mark.asyncio
async def test_inventory_status_low_stock(auth_client):
    sku = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-LOW", "name": "Low Stock Item"
    }, headers=HEADERS)
    sku_id = sku.json()["id"]

    response = await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku_id,
        "zone": "Zone-B",
        "quantity": 5,
        "reorder_level": 10
    }, headers=HEADERS)
    assert response.status_code == 201
    assert response.json()["status"] == "low_stock"


@pytest.mark.asyncio
async def test_inventory_status_out_of_stock(auth_client):
    sku = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-OOS", "name": "Out of Stock Item"
    }, headers=HEADERS)
    sku_id = sku.json()["id"]

    response = await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku_id, "zone": "Zone-C", "quantity": 0, "reorder_level": 10
    }, headers=HEADERS)
    assert response.status_code == 201
    assert response.json()["status"] == "out_of_stock"


# --- Stock Adjustment Tests ---

@pytest.mark.asyncio
async def test_stock_adjust_increase(auth_client):
    sku = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-ADJ", "name": "Adjust Me"
    }, headers=HEADERS)
    sku_id = sku.json()["id"]
    item = await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku_id, "zone": "Zone-A", "quantity": 50, "reorder_level": 5
    }, headers=HEADERS)
    item_id = item.json()["id"]

    response = await auth_client.patch(f"/depot/inventory/{item_id}/adjust", json={
        "quantity_delta": 20, "movement_type": "IN"
    }, headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["quantity"] == 70


@pytest.mark.asyncio
async def test_stock_adjust_decrease(auth_client):
    sku = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-DEC", "name": "Decrease Me"
    }, headers=HEADERS)
    sku_id = sku.json()["id"]
    item = await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku_id, "zone": "Zone-A", "quantity": 50, "reorder_level": 5
    }, headers=HEADERS)
    item_id = item.json()["id"]

    response = await auth_client.patch(f"/depot/inventory/{item_id}/adjust", json={
        "quantity_delta": -10, "movement_type": "OUT"
    }, headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["quantity"] == 40


@pytest.mark.asyncio
async def test_stock_cannot_go_below_zero(auth_client):
    sku = await auth_client.post("/depot/inventory/skus", json={
        "sku_code": "SKU-NEG", "name": "No Negative"
    }, headers=HEADERS)
    sku_id = sku.json()["id"]
    item = await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku_id, "zone": "Zone-A", "quantity": 5, "reorder_level": 2
    }, headers=HEADERS)
    item_id = item.json()["id"]

    response = await auth_client.patch(f"/depot/inventory/{item_id}/adjust", json={
        "quantity_delta": -10, "movement_type": "OUT"
    }, headers=HEADERS)
    assert response.status_code == 400


# --- Low Stock Report ---

@pytest.mark.asyncio
async def test_low_stock_report(auth_client):
    sku1 = await auth_client.post("/depot/inventory/skus", json={"sku_code": "SKU-R1", "name": "R1"}, headers=HEADERS)
    sku2 = await auth_client.post("/depot/inventory/skus", json={"sku_code": "SKU-R2", "name": "R2"}, headers=HEADERS)

    # low stock
    await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku1.json()["id"], "zone": "Zone-A", "quantity": 3, "reorder_level": 10
    }, headers=HEADERS)
    # healthy stock
    await auth_client.post("/depot/inventory/items", json={
        "sku_id": sku2.json()["id"], "zone": "Zone-A", "quantity": 100, "reorder_level": 10
    }, headers=HEADERS)

    response = await auth_client.get("/depot/inventory/reports/low-stock", headers=HEADERS)
    assert response.status_code == 200
    assert len(response.json()) == 1
