"""
Intelli Platform — Prompt Management API Router
Feature: AI-7.4

REST endpoints for prompt templates, versions, rendering, and A/B experiments.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.ai_orchestration.prompts.schemas import (
    ExperimentConclude,
    ExperimentCreate,
    ExperimentOut,
    ExperimentScoreRequest,
    PromptRenderOut,
    PromptRenderRequest,
    PromptTemplateCreate,
    PromptTemplateOut,
    PromptTemplateSummary,
    PromptTemplateUpdate,
    PromptVersionCreate,
    PromptVersionOut,
)
from app.core.ai_orchestration.prompts.service import PromptManager

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


def _manager(db: AsyncSession = Depends(get_db)) -> PromptManager:
    return PromptManager(db)


# ── Templates ────────────────────────────────────────────

@router.post("/", response_model=PromptTemplateOut, status_code=201)
async def create_template(
    data: PromptTemplateCreate, mgr: PromptManager = Depends(_manager)
):
    return await mgr.create_template(data)


@router.get("/", response_model=list[PromptTemplateSummary])
async def list_templates(
    category: str | None = None,
    is_active: bool | None = None,
    mgr: PromptManager = Depends(_manager),
):
    templates = await mgr.list_templates(category=category, is_active=is_active)
    results = []
    for t in templates:
        results.append(PromptTemplateSummary(
            id=t.id,
            name=t.name,
            description=t.description,
            category=t.category,
            is_active=t.is_active,
            active_version_id=t.active_version_id,
            version_count=len(t.versions) if hasattr(t, "versions") and t.versions else 0,
        ))
    return results


@router.get("/{template_id}", response_model=PromptTemplateOut)
async def get_template(
    template_id: uuid.UUID, mgr: PromptManager = Depends(_manager)
):
    template = await mgr.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.patch("/{template_id}", response_model=PromptTemplateOut)
async def update_template(
    template_id: uuid.UUID,
    data: PromptTemplateUpdate,
    mgr: PromptManager = Depends(_manager),
):
    template = await mgr.update_template(template_id, data)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID, mgr: PromptManager = Depends(_manager)
):
    deleted = await mgr.delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")


# ── Versions ─────────────────────────────────────────────

@router.post("/{template_id}/versions", response_model=PromptVersionOut, status_code=201)
async def create_version(
    template_id: uuid.UUID,
    data: PromptVersionCreate,
    mgr: PromptManager = Depends(_manager),
):
    version = await mgr.create_version(template_id, data)
    if version is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return version


@router.put("/{template_id}/versions/{version_id}/activate", status_code=200)
async def set_active_version(
    template_id: uuid.UUID,
    version_id: uuid.UUID,
    mgr: PromptManager = Depends(_manager),
):
    ok = await mgr.set_active_version(template_id, version_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template or version not found")
    return {"status": "ok"}


# ── Rendering ────────────────────────────────────────────

@router.post("/{template_id}/render", response_model=PromptRenderOut)
async def render_prompt(
    template_id: uuid.UUID,
    data: PromptRenderRequest,
    mgr: PromptManager = Depends(_manager),
):
    result = await mgr.render(template_id, data)
    if result is None:
        raise HTTPException(status_code=404, detail="Template or version not found")
    return result


# ── Experiments ──────────────────────────────────────────

@router.post("/{template_id}/experiments", response_model=ExperimentOut, status_code=201)
async def create_experiment(
    template_id: uuid.UUID,
    data: ExperimentCreate,
    mgr: PromptManager = Depends(_manager),
):
    experiment = await mgr.create_experiment(template_id, data)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return experiment


@router.get("/{template_id}/experiments", response_model=list[ExperimentOut])
async def list_experiments(
    template_id: uuid.UUID,
    active_only: bool = False,
    mgr: PromptManager = Depends(_manager),
):
    return await mgr.list_experiments(template_id, active_only=active_only)


@router.post("/experiments/{experiment_id}/score", response_model=ExperimentOut)
async def record_score(
    experiment_id: uuid.UUID,
    data: ExperimentScoreRequest,
    mgr: PromptManager = Depends(_manager),
):
    experiment = await mgr.record_score(experiment_id, data)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found or concluded")
    return experiment


@router.post("/experiments/{experiment_id}/conclude", response_model=ExperimentOut)
async def conclude_experiment(
    experiment_id: uuid.UUID,
    data: ExperimentConclude,
    mgr: PromptManager = Depends(_manager),
):
    experiment = await mgr.conclude_experiment(experiment_id, data)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment
