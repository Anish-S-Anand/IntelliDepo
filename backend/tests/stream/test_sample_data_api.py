"""
Tests for STR-API-1: Stream Sample Data API
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/stream/data"


# ── Seed ─────────────────────────────────────────────────

async def test_seed_sample_data(client: AsyncClient):
    resp = await client.post(f"{BASE}/seed")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["seeded"]["companies"] == 8
    assert data["seeded"]["clients"] == 15


async def test_seed_idempotent(client: AsyncClient):
    """Calling seed twice should not duplicate data."""
    await client.post(f"{BASE}/seed")
    resp = await client.post(f"{BASE}/seed")
    assert resp.status_code == 200
    assert resp.json()["seeded"]["companies"] == 0
    assert resp.json()["seeded"]["clients"] == 0


# ── Peer Benchmarking ────────────────────────────────────

async def test_list_all_companies(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/companies")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 8
    assert len(data["companies"]) == 8
    assert len(data["sectors"]) > 0
    assert len(data["fiscal_years"]) > 0


async def test_filter_by_sector(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/companies", params={"sector": "Technology"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3
    assert all(c["sector"] == "Technology" for c in data["companies"])


async def test_filter_by_tickers(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/companies", params={"tickers": "TNOV,FEDG"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    tickers = {c["ticker"] for c in data["companies"]}
    assert tickers == {"TNOV", "FEDG"}


async def test_get_single_company(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/companies/TNOV")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "TNOV"
    assert data["company_name"] == "TechNova Inc."
    assert data["revenue"] == 4200


async def test_get_company_not_found(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/companies/ZZZZ")
    assert resp.status_code == 404


async def test_companies_ordered_by_revenue_desc(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/companies")
    companies = resp.json()["companies"]
    revenues = [c["revenue"] for c in companies]
    assert revenues == sorted(revenues, reverse=True)


# ── Revenue Concentration ────────────────────────────────

async def test_list_all_clients(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/clients")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 15
    assert data["total_revenue"] > 0
    assert 0 < data["herfindahl_index"] < 1
    assert 0 < data["top_client_share"] <= 1
    assert data["top_3_share"] >= data["top_client_share"]
    assert data["top_5_share"] >= data["top_3_share"]


async def test_filter_clients_by_region(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/clients", params={"region": "Europe"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(c["region"] == "Europe" for c in data["clients"])
    assert data["count"] > 0


async def test_filter_clients_by_risk_tier(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/clients", params={"risk_tier": "high"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(c["risk_tier"] == "high" for c in data["clients"])


async def test_clients_ordered_by_revenue_desc(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/clients")
    clients = resp.json()["clients"]
    revenues = [c["annual_revenue"] for c in clients]
    assert revenues == sorted(revenues, reverse=True)


async def test_herfindahl_index_reasonable(client: AsyncClient):
    """HHI for 15 clients should be in moderate/diversified range."""
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/clients")
    hhi = resp.json()["herfindahl_index"]
    # With 15 clients where largest is ~20%, HHI should be < 0.25
    assert 0.05 < hhi < 0.25
