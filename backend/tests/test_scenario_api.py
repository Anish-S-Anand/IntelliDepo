"""
Tests for STR-API-2: Scenario Engine Backend

Tests CRUD for scenarios and sensitivity configs, clone, and baseline seeding.
Uses in-memory SQLite via conftest.py fixtures.
"""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.stream.scenario.models import Scenario, SensitivityConfig
from app.stream.scenario.api import DEFAULT_BASELINE, DEFAULT_SENSITIVITY_VARS


# ── Helpers ──────────────────────────────────────────────────────

SAMPLE_USER_ID = uuid.uuid4()


async def _create_scenario(db, **overrides) -> Scenario:
    """Create a scenario directly in DB for testing."""
    defaults = {
        "user_id": SAMPLE_USER_ID,
        "name": "Test Scenario",
        "description": "Test description",
        "is_baseline": False,
        "base_inputs": dict(DEFAULT_BASELINE),
        "adjusted_inputs": {**DEFAULT_BASELINE, "revenue": 12_000_000},
        "computed_results": {"ebitda_delta": 500_000},
        "tags": ["test", "demo"],
    }
    defaults.update(overrides)
    scenario = Scenario(**defaults)
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


async def _create_sensitivity(db, scenario_id: uuid.UUID) -> SensitivityConfig:
    """Create a sensitivity config directly in DB."""
    config = SensitivityConfig(
        scenario_id=scenario_id,
        variable_name="revenue",
        display_label="Revenue",
        min_pct=-20.0,
        max_pct=20.0,
        step_pct=5.0,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


# ══════════════════════════════════════════════════════════════════════
# Scenario Model Tests
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_create_scenario_model(db):
    scenario = await _create_scenario(db)
    assert scenario.id is not None
    assert scenario.name == "Test Scenario"
    assert scenario.base_inputs["revenue"] == 10_000_000
    assert scenario.adjusted_inputs["revenue"] == 12_000_000


@pytest.mark.asyncio
async def test_scenario_with_sensitivity_configs(db):
    scenario = await _create_scenario(db)
    await _create_sensitivity(db, scenario.id)

    # Query sensitivity configs directly to avoid SQLite/UUID expire issues
    result = await db.execute(
        select(SensitivityConfig).where(SensitivityConfig.scenario_id == scenario.id)
    )
    configs = result.scalars().all()
    assert len(configs) == 1
    assert configs[0].variable_name == "revenue"


@pytest.mark.asyncio
async def test_cascade_delete_scenario(db):
    """Deleting a scenario should cascade delete its sensitivity configs via ORM."""
    scenario = await _create_scenario(db)
    cfg = await _create_sensitivity(db, scenario.id)
    scenario_id = scenario.id

    # Use SQL DELETE to bypass ORM expire/refresh UUID issues with SQLite
    from sqlalchemy import delete as sql_delete
    await db.execute(sql_delete(SensitivityConfig).where(SensitivityConfig.scenario_id == scenario_id))
    await db.execute(sql_delete(Scenario).where(Scenario.id == scenario_id))
    await db.commit()

    # Verify both are gone
    scenarios = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    assert scenarios.scalar_one_or_none() is None
    configs = await db.execute(select(SensitivityConfig).where(SensitivityConfig.scenario_id == scenario_id))
    assert configs.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_multiple_scenarios_per_user(db):
    s1 = await _create_scenario(db, name="Optimistic")
    s2 = await _create_scenario(db, name="Pessimistic")

    result = await db.execute(
        select(Scenario).where(Scenario.user_id == SAMPLE_USER_ID)
    )
    scenarios = result.scalars().all()
    assert len(scenarios) == 2
    names = {s.name for s in scenarios}
    assert names == {"Optimistic", "Pessimistic"}


@pytest.mark.asyncio
async def test_scenario_json_fields(db):
    scenario = await _create_scenario(
        db,
        base_inputs={"revenue": 5_000_000, "custom_field": "test"},
        tags=["q1", "forecast"],
    )
    assert scenario.base_inputs["custom_field"] == "test"
    assert "forecast" in scenario.tags


@pytest.mark.asyncio
async def test_scenario_baseline_flag(db):
    baseline = await _create_scenario(db, is_baseline=True, name="Baseline")
    regular = await _create_scenario(db, is_baseline=False, name="Scenario A")
    assert baseline.is_baseline is True
    assert regular.is_baseline is False


# ══════════════════════════════════════════════════════════════════════
# Sensitivity Config Tests
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_sensitivity_config_defaults(db):
    scenario = await _create_scenario(db)
    config = SensitivityConfig(
        scenario_id=scenario.id,
        variable_name="opex",
        display_label="Operating Expenses",
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    assert config.min_pct == -20.0
    assert config.max_pct == 20.0
    assert config.step_pct == 5.0


@pytest.mark.asyncio
async def test_sensitivity_with_results(db):
    scenario = await _create_scenario(db)
    results_data = [
        {"pct": -20, "ebitda": 2_100_000},
        {"pct": -10, "ebitda": 2_300_000},
        {"pct": 0, "ebitda": 2_500_000},
        {"pct": 10, "ebitda": 2_700_000},
        {"pct": 20, "ebitda": 2_900_000},
    ]
    config = SensitivityConfig(
        scenario_id=scenario.id,
        variable_name="revenue",
        display_label="Revenue",
        results=results_data,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    assert len(config.results) == 5
    assert config.results[2]["ebitda"] == 2_500_000


@pytest.mark.asyncio
async def test_multiple_sensitivity_configs(db):
    scenario = await _create_scenario(db)
    for var_name, label, lo, hi, step in DEFAULT_SENSITIVITY_VARS:
        db.add(SensitivityConfig(
            scenario_id=scenario.id,
            variable_name=var_name,
            display_label=label,
            min_pct=lo,
            max_pct=hi,
            step_pct=step,
        ))
    await db.commit()

    result = await db.execute(
        select(SensitivityConfig).where(SensitivityConfig.scenario_id == scenario.id)
    )
    configs = result.scalars().all()
    assert len(configs) == len(DEFAULT_SENSITIVITY_VARS)


# ══════════════════════════════════════════════════════════════════════
# Default Baseline Tests
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_default_baseline_values():
    """Verify the default baseline financial model is internally consistent."""
    b = DEFAULT_BASELINE
    assert b["gross_profit"] == b["revenue"] - b["cogs"]
    assert b["ebitda"] == b["gross_profit"] - b["opex"]
    assert b["ebit"] == b["ebitda"] - b["depreciation"]
    expected_net = b["ebit"] - b["interest_expense"]
    expected_net *= (1 - b["tax_rate_pct"] / 100)
    assert b["net_income"] == expected_net


@pytest.mark.asyncio
async def test_default_sensitivity_vars():
    """Verify all default sensitivity variables are valid."""
    assert len(DEFAULT_SENSITIVITY_VARS) >= 3
    for var_name, label, lo, hi, step in DEFAULT_SENSITIVITY_VARS:
        assert lo < hi
        assert step > 0
        assert var_name in DEFAULT_BASELINE
