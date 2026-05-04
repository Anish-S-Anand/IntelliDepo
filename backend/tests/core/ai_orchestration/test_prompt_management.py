"""
Tests for AI-7.4: Prompt Management System
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/prompts"


# ── Helpers ──────────────────────────────────────────────

async def _create_template(client: AsyncClient, **overrides) -> dict:
    payload = {
        "name": overrides.get("name", f"test-template-{uuid.uuid4().hex[:8]}"),
        "description": "A test prompt",
        "category": "testing",
        "tags": ["test"],
        "system_prompt": "You are a helpful assistant for {{domain}}.",
        "user_prompt": "Summarise the following: {{text}}",
        "variables": ["domain", "text"],
        "model_params": {"temperature": 0.5},
        "change_note": "Initial version",
    }
    payload.update(overrides)
    resp = await client.post(BASE + "/", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Template CRUD ────────────────────────────────────────

async def test_create_template(client: AsyncClient):
    data = await _create_template(client)
    assert data["name"].startswith("test-template-")
    assert data["is_active"] is True
    assert len(data["versions"]) == 1
    assert data["active_version_id"] == data["versions"][0]["id"]


async def test_list_templates(client: AsyncClient):
    await _create_template(client, name="list-1", category="cat-a")
    await _create_template(client, name="list-2", category="cat-b")
    resp = await client.get(BASE + "/")
    assert resp.status_code == 200
    names = {t["name"] for t in resp.json()}
    assert "list-1" in names
    assert "list-2" in names

    # Filter by category
    resp2 = await client.get(BASE + "/", params={"category": "cat-a"})
    assert resp2.status_code == 200
    assert all(t["category"] == "cat-a" for t in resp2.json())


async def test_get_template(client: AsyncClient):
    created = await _create_template(client)
    resp = await client.get(f"{BASE}/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


async def test_get_template_not_found(client: AsyncClient):
    resp = await client.get(f"{BASE}/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_update_template(client: AsyncClient):
    created = await _create_template(client)
    resp = await client.patch(
        f"{BASE}/{created['id']}", json={"description": "Updated", "is_active": False}
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated"
    assert resp.json()["is_active"] is False


async def test_delete_template(client: AsyncClient):
    created = await _create_template(client)
    resp = await client.delete(f"{BASE}/{created['id']}")
    assert resp.status_code == 204
    resp2 = await client.get(f"{BASE}/{created['id']}")
    assert resp2.status_code == 404


# ── Versioning ───────────────────────────────────────────

async def test_create_version(client: AsyncClient):
    created = await _create_template(client)
    tid = created["id"]
    resp = await client.post(
        f"{BASE}/{tid}/versions",
        json={
            "user_prompt": "New prompt: {{text}}",
            "variables": ["text"],
            "change_note": "v2 improvement",
        },
    )
    assert resp.status_code == 201
    v2 = resp.json()
    assert v2["version_number"] == 2
    assert v2["change_note"] == "v2 improvement"

    # Active version should now be v2
    template = (await client.get(f"{BASE}/{tid}")).json()
    assert template["active_version_id"] == v2["id"]


async def test_set_active_version(client: AsyncClient):
    created = await _create_template(client)
    tid = created["id"]
    v1_id = created["versions"][0]["id"]

    # Create v2
    v2_resp = await client.post(
        f"{BASE}/{tid}/versions",
        json={"user_prompt": "v2: {{text}}", "variables": ["text"]},
    )
    v2_id = v2_resp.json()["id"]

    # Revert to v1
    resp = await client.put(f"{BASE}/{tid}/versions/{v1_id}/activate")
    assert resp.status_code == 200

    template = (await client.get(f"{BASE}/{tid}")).json()
    assert template["active_version_id"] == v1_id


# ── Rendering ────────────────────────────────────────────

async def test_render_prompt(client: AsyncClient):
    created = await _create_template(client)
    tid = created["id"]
    resp = await client.post(
        f"{BASE}/{tid}/render",
        json={"variables": {"domain": "finance", "text": "Quarterly earnings report"}},
    )
    assert resp.status_code == 200
    rendered = resp.json()
    assert "finance" in rendered["system_prompt"]
    assert "Quarterly earnings report" in rendered["user_prompt"]
    assert rendered["version_number"] == 1


async def test_render_with_specific_version(client: AsyncClient):
    created = await _create_template(client)
    tid = created["id"]
    v1_id = created["versions"][0]["id"]

    # Create v2
    await client.post(
        f"{BASE}/{tid}/versions",
        json={"user_prompt": "V2: {{text}}", "variables": ["text"]},
    )

    # Render with v1 explicitly
    resp = await client.post(
        f"{BASE}/{tid}/render",
        json={"variables": {"text": "hello"}, "version_id": v1_id},
    )
    assert resp.status_code == 200
    assert resp.json()["version_number"] == 1


async def test_render_unresolved_variables_kept(client: AsyncClient):
    created = await _create_template(client)
    tid = created["id"]
    resp = await client.post(
        f"{BASE}/{tid}/render",
        json={"variables": {"domain": "tech"}},  # 'text' not provided
    )
    assert resp.status_code == 200
    assert "{{text}}" in resp.json()["user_prompt"]


# ── A/B Experiments ──────────────────────────────────────

async def _setup_experiment(client: AsyncClient):
    """Create a template with 2 versions and an experiment."""
    created = await _create_template(client)
    tid = created["id"]
    v1_id = created["versions"][0]["id"]

    v2_resp = await client.post(
        f"{BASE}/{tid}/versions",
        json={"user_prompt": "V2: {{text}}", "variables": ["text"]},
    )
    v2_id = v2_resp.json()["id"]

    exp_resp = await client.post(
        f"{BASE}/{tid}/experiments",
        json={
            "name": "v1-vs-v2",
            "variant_a_id": v1_id,
            "variant_b_id": v2_id,
            "traffic_split": 0.5,
        },
    )
    assert exp_resp.status_code == 201
    return tid, v1_id, v2_id, exp_resp.json()


async def test_create_experiment(client: AsyncClient):
    _, v1_id, v2_id, exp = await _setup_experiment(client)
    assert exp["variant_a_id"] == v1_id
    assert exp["variant_b_id"] == v2_id
    assert exp["is_active"] is True
    assert exp["traffic_split"] == 0.5


async def test_list_experiments(client: AsyncClient):
    tid, *_ = await _setup_experiment(client)
    resp = await client.get(f"{BASE}/{tid}/experiments")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_render_with_experiment(client: AsyncClient):
    tid, v1_id, v2_id, exp = await _setup_experiment(client)
    # Render multiple times — the experiment should serve either variant
    variants_seen = set()
    for _ in range(20):
        resp = await client.post(
            f"{BASE}/{tid}/render",
            json={"variables": {"domain": "test", "text": "data"}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["experiment_id"] == exp["id"]
        assert data["variant"] in ("a", "b")
        variants_seen.add(data["variant"])

    # With 50/50 split over 20 trials, extremely unlikely to not see both
    assert len(variants_seen) == 2


async def test_record_score(client: AsyncClient):
    _, _, _, exp = await _setup_experiment(client)
    resp = await client.post(
        f"{BASE}/experiments/{exp['id']}/score",
        json={"variant": "a", "score": 0.8},
    )
    assert resp.status_code == 200
    assert resp.json()["variant_a_score"] > 0


async def test_conclude_experiment(client: AsyncClient):
    tid, v1_id, _, exp = await _setup_experiment(client)
    resp = await client.post(
        f"{BASE}/experiments/{exp['id']}/conclude",
        json={"winner": "a", "promote": True},
    )
    assert resp.status_code == 200
    concluded = resp.json()
    assert concluded["is_active"] is False
    assert concluded["winner_id"] == v1_id
    assert concluded["concluded_at"] is not None

    # Check that the template's active version was promoted
    template = (await client.get(f"{BASE}/{tid}")).json()
    assert template["active_version_id"] == v1_id
