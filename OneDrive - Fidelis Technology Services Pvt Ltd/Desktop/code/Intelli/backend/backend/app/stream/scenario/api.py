"""
Intelli Stream — Scenario Engine API
Feature: STR-API-2

Thin persistence layer for What-if scenarios and sensitivity configurations.
The frontend does all financial calculations — this API just saves/loads them.

Endpoints:
  Scenarios:   CRUD + clone + list-by-user
  Sensitivity: CRUD nested under scenarios
  Baseline:    seed a default baseline financial model
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBase, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.stream.scenario.models import Scenario, SensitivityConfig

router = APIRouter(prefix="/api/v1/stream/scenarios", tags=["Stream — Scenarios"])


# ══════════════════════════════════════════════════════════════════════
# Schemas
# ══════════════════════════════════════════════════════════════════════

class SensitivityConfigCreate(PydanticBase):
    variable_name: str
    display_label: str
    min_pct: float = -20.0
    max_pct: float = 20.0
    step_pct: float = 5.0
    results: list | None = None


class SensitivityConfigResponse(PydanticBase):
    id: uuid.UUID
    scenario_id: uuid.UUID
    variable_name: str
    display_label: str
    min_pct: float
    max_pct: float
    step_pct: float
    results: list | None = None
    model_config = {"from_attributes": True}


class SensitivityConfigUpdate(PydanticBase):
    variable_name: str | None = None
    display_label: str | None = None
    min_pct: float | None = None
    max_pct: float | None = None
    step_pct: float | None = None
    results: list | None = None


class ScenarioCreate(PydanticBase):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    is_baseline: bool = False
    base_inputs: dict = Field(default_factory=dict)
    adjusted_inputs: dict = Field(default_factory=dict)
    computed_results: dict | None = None
    tags: list[str] | None = None
    sensitivity_configs: list[SensitivityConfigCreate] = []


class ScenarioUpdate(PydanticBase):
    name: str | None = None
    description: str | None = None
    adjusted_inputs: dict | None = None
    computed_results: dict | None = None
    tags: list[str] | None = None


class ScenarioResponse(PydanticBase):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None = None
    is_baseline: bool
    base_inputs: dict
    adjusted_inputs: dict
    computed_results: dict | None = None
    tags: list[str] | None = None
    sensitivity_configs: list[SensitivityConfigResponse] = []
    created_at: str | None = None
    updated_at: str | None = None
    model_config = {"from_attributes": True}


class ScenarioListResponse(PydanticBase):
    scenarios: list[ScenarioResponse]
    total: int


# ══════════════════════════════════════════════════════════════════════
# Default baseline financial model
# ══════════════════════════════════════════════════════════════════════

DEFAULT_BASELINE = {
    "revenue": 10_000_000,
    "cogs": 4_000_000,
    "gross_profit": 6_000_000,
    "opex": 3_500_000,
    "ebitda": 2_500_000,
    "depreciation": 500_000,
    "ebit": 2_000_000,
    "interest_expense": 300_000,
    "tax_rate_pct": 25.0,
    "net_income": 1_275_000,
    "gross_margin_pct": 60.0,
    "ebitda_margin_pct": 25.0,
    "net_margin_pct": 12.75,
}

DEFAULT_SENSITIVITY_VARS = [
    ("revenue", "Revenue", -30.0, 30.0, 5.0),
    ("cogs", "Cost of Goods Sold", -20.0, 20.0, 5.0),
    ("opex", "Operating Expenses", -20.0, 20.0, 5.0),
    ("interest_expense", "Interest Expense", -50.0, 50.0, 10.0),
    ("tax_rate_pct", "Tax Rate", -10.0, 10.0, 2.5),
]


# ══════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════

async def _get_scenario(
    db: AsyncSession, scenario_id: uuid.UUID, user_id: uuid.UUID
) -> Scenario:
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.sensitivity_configs))
        .where(Scenario.id == scenario_id, Scenario.user_id == user_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    return scenario


# ══════════════════════════════════════════════════════════════════════
# Scenario CRUD
# ══════════════════════════════════════════════════════════════════════

@router.get("", response_model=ScenarioListResponse)
async def list_scenarios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all scenarios for the current user."""
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.sensitivity_configs))
        .where(Scenario.user_id == current_user.id)
        .order_by(Scenario.updated_at.desc())
    )
    scenarios = list(result.scalars().all())
    return ScenarioListResponse(scenarios=scenarios, total=len(scenarios))


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(
    scenario_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single scenario with its sensitivity configs."""
    return await _get_scenario(db, scenario_id, current_user.id)


@router.post("", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    body: ScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new scenario with optional sensitivity configs."""
    scenario = Scenario(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        is_baseline=body.is_baseline,
        base_inputs=body.base_inputs,
        adjusted_inputs=body.adjusted_inputs,
        computed_results=body.computed_results,
        tags=body.tags,
    )
    for cfg in body.sensitivity_configs:
        scenario.sensitivity_configs.append(SensitivityConfig(
            variable_name=cfg.variable_name,
            display_label=cfg.display_label,
            min_pct=cfg.min_pct,
            max_pct=cfg.max_pct,
            step_pct=cfg.step_pct,
            results=cfg.results,
        ))
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.patch("/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: uuid.UUID,
    body: ScenarioUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a scenario's adjustments, results, or metadata."""
    scenario = await _get_scenario(db, scenario_id, current_user.id)
    if body.name is not None:
        scenario.name = body.name
    if body.description is not None:
        scenario.description = body.description
    if body.adjusted_inputs is not None:
        scenario.adjusted_inputs = body.adjusted_inputs
    if body.computed_results is not None:
        scenario.computed_results = body.computed_results
    if body.tags is not None:
        scenario.tags = body.tags
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(
    scenario_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a scenario and all its sensitivity configs."""
    scenario = await _get_scenario(db, scenario_id, current_user.id)
    await db.delete(scenario)
    await db.commit()


@router.post("/{scenario_id}/clone", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def clone_scenario(
    scenario_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone an existing scenario (deep copy including sensitivity configs)."""
    source = await _get_scenario(db, scenario_id, current_user.id)
    clone = Scenario(
        user_id=current_user.id,
        name=f"{source.name} (copy)",
        description=source.description,
        is_baseline=False,
        base_inputs=dict(source.base_inputs),
        adjusted_inputs=dict(source.adjusted_inputs),
        computed_results=dict(source.computed_results) if source.computed_results else None,
        tags=list(source.tags) if source.tags else None,
    )
    for cfg in source.sensitivity_configs:
        clone.sensitivity_configs.append(SensitivityConfig(
            variable_name=cfg.variable_name,
            display_label=cfg.display_label,
            min_pct=cfg.min_pct,
            max_pct=cfg.max_pct,
            step_pct=cfg.step_pct,
            results=list(cfg.results) if cfg.results else None,
        ))
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    return clone


# ══════════════════════════════════════════════════════════════════════
# Baseline seeder
# ══════════════════════════════════════════════════════════════════════

@router.post("/seed-baseline", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def seed_baseline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a default baseline scenario with standard sensitivity variables.

    Idempotent: if a baseline already exists for this user, returns it.
    """
    # Check for existing baseline
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.sensitivity_configs))
        .where(Scenario.user_id == current_user.id, Scenario.is_baseline == True)  # noqa: E712
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    scenario = Scenario(
        user_id=current_user.id,
        name="Baseline Financial Model",
        description="Default baseline — adjust variables to create What-if scenarios",
        is_baseline=True,
        base_inputs=dict(DEFAULT_BASELINE),
        adjusted_inputs=dict(DEFAULT_BASELINE),
    )
    for var_name, label, lo, hi, step in DEFAULT_SENSITIVITY_VARS:
        scenario.sensitivity_configs.append(SensitivityConfig(
            variable_name=var_name,
            display_label=label,
            min_pct=lo,
            max_pct=hi,
            step_pct=step,
        ))
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


# ══════════════════════════════════════════════════════════════════════
# Sensitivity Config CRUD (nested under scenario)
# ══════════════════════════════════════════════════════════════════════

@router.post(
    "/{scenario_id}/sensitivity",
    response_model=SensitivityConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_sensitivity_config(
    scenario_id: uuid.UUID,
    body: SensitivityConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a sensitivity config to a scenario."""
    scenario = await _get_scenario(db, scenario_id, current_user.id)
    config = SensitivityConfig(
        scenario_id=scenario.id,
        variable_name=body.variable_name,
        display_label=body.display_label,
        min_pct=body.min_pct,
        max_pct=body.max_pct,
        step_pct=body.step_pct,
        results=body.results,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.patch(
    "/{scenario_id}/sensitivity/{config_id}",
    response_model=SensitivityConfigResponse,
)
async def update_sensitivity_config(
    scenario_id: uuid.UUID,
    config_id: uuid.UUID,
    body: SensitivityConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a sensitivity config (e.g. save tornado chart results)."""
    # Verify ownership
    await _get_scenario(db, scenario_id, current_user.id)
    result = await db.execute(
        select(SensitivityConfig).where(
            SensitivityConfig.id == config_id,
            SensitivityConfig.scenario_id == scenario_id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensitivity config not found")

    for field in ("variable_name", "display_label", "min_pct", "max_pct", "step_pct", "results"):
        value = getattr(body, field)
        if value is not None:
            setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    return config


@router.delete(
    "/{scenario_id}/sensitivity/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_sensitivity_config(
    scenario_id: uuid.UUID,
    config_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a sensitivity config."""
    await _get_scenario(db, scenario_id, current_user.id)
    result = await db.execute(
        select(SensitivityConfig).where(
            SensitivityConfig.id == config_id,
            SensitivityConfig.scenario_id == scenario_id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensitivity config not found")
    await db.delete(config)
    await db.commit()
