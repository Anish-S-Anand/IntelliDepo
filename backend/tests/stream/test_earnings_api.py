"""
Tests for STR-API-3: Earnings Transcript Backend
"""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.auth.dependencies import get_current_user
from app.main import app
from app.shared.models.user import User

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/stream/earnings"


# ── Auth override ────────────────────────────────────────

_fake_user = None


@pytest_asyncio.fixture(autouse=True)
async def override_auth(db):
    """Create a fake user and override auth dependency."""
    global _fake_user
    user = User(
        id=uuid.uuid4(),
        email="test-earnings@example.com",
        hashed_password="fakehash",
        full_name="Test User",
        is_active=True,
        is_superuser=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    _fake_user = user

    async def _override():
        return _fake_user

    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.pop(get_current_user, None)


# ── Seed ─────────────────────────────────────────────────

async def test_seed_transcripts(client: AsyncClient):
    resp = await client.post(f"{BASE}/seed")
    assert resp.status_code == 201
    data = resp.json()
    assert data["seeded"] == 5
    assert len(data["transcripts"]) == 5


async def test_seed_idempotent(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.post(f"{BASE}/seed")
    assert resp.status_code == 201
    assert resp.json()["seeded"] == 0


# ── List ─────────────────────────────────────────────────

async def test_list_transcripts(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/transcripts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    # Check structure
    first = data[0]
    assert "ticker" in first
    assert "overall_sentiment" in first
    assert "management_tone" in first


async def test_list_filter_by_ticker(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/transcripts", params={"ticker": "TNOV"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["ticker"] == "TNOV"


# ── Get Detail ───────────────────────────────────────────

async def test_get_transcript_detail(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    # Get list to find an ID
    list_resp = await client.get(f"{BASE}/transcripts")
    transcript_id = list_resp.json()[0]["id"]

    resp = await client.get(f"{BASE}/transcripts/{transcript_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == transcript_id
    assert "key_themes" in data
    assert "sentiment_timeline" in data
    assert "key_metrics_mentioned" in data
    assert "risk_flags" in data
    assert "summary" in data


async def test_get_transcript_not_found(client: AsyncClient):
    resp = await client.get(f"{BASE}/transcripts/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Upload & Analyze ─────────────────────────────────────

async def test_upload_transcript(client: AsyncClient):
    resp = await client.post(f"{BASE}/transcripts", json={
        "company_name": "TestCo",
        "ticker": "TST",
        "fiscal_quarter": "Q1 2026",
        "fiscal_year": 2026,
        "transcript_text": """
Welcome to TestCo's Q1 2026 earnings call.

Revenue grew 20% year-over-year to $500 million, driven by strong demand in our core platform.
Gross margins expanded to 65%, reflecting improved scale. Operating margin was 18%.

We're seeing some headwinds from currency fluctuations impacting international revenue.
However, our pipeline remains strong with $1.2 billion in contracted backlog.

For Q2, we expect revenue of $520-540 million with continued margin expansion.
""",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["ticker"] == "TST"
    assert data["company_name"] == "TestCo"
    assert data["overall_sentiment"] is not None
    assert data["management_tone"] is not None
    assert data["key_metrics_mentioned"] is not None


# ── Compare ──────────────────────────────────────────────

async def test_compare_transcripts(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/compare", params={"tickers": "TNOV,FEDG"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["companies"]) == 2
    tickers = {c["ticker"] for c in data["companies"]}
    assert tickers == {"TNOV", "FEDG"}
    assert "sentiment_comparison" in data


async def test_compare_not_found(client: AsyncClient):
    resp = await client.get(f"{BASE}/compare", params={"tickers": "ZZZZ"})
    assert resp.status_code == 404


# ── Sentiment Analysis ───────────────────────────────────

async def test_sentiment_values_reasonable(client: AsyncClient):
    await client.post(f"{BASE}/seed")
    resp = await client.get(f"{BASE}/transcripts")
    for t in resp.json():
        # Sentiment should be between -1 and 1
        assert -1 <= t["overall_sentiment"] <= 1
        # Management tone should be a known classification
        assert t["management_tone"] in (
            "optimistic", "cautiously optimistic", "neutral", "cautious", "concerned", None
        )