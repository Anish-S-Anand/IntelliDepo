"""
Intelli Platform — Prompt Management Service
Feature: AI-7.4

Core business logic for prompt template CRUD, versioning, variable rendering,
and A/B test experiment management.
"""
from __future__ import annotations

import random
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.ai_orchestration.prompts.models import (
    PromptExperiment,
    PromptTemplate,
    PromptVersion,
)
from app.core.ai_orchestration.prompts.schemas import (
    ExperimentConclude,
    ExperimentCreate,
    ExperimentScoreRequest,
    PromptRenderOut,
    PromptRenderRequest,
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptVersionCreate,
)

# Regex to find {{variable_name}} placeholders in prompt text
_VAR_PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")


class PromptManager:
    """Service layer for prompt template management."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Templates ────────────────────────────────────────

    async def create_template(self, data: PromptTemplateCreate) -> PromptTemplate:
        """Create a prompt template with its first version."""
        template = PromptTemplate(
            name=data.name,
            description=data.description,
            category=data.category,
            tags=data.tags,
        )
        self.db.add(template)
        await self.db.flush()

        # Create version 1
        version = PromptVersion(
            template_id=template.id,
            version_number=1,
            system_prompt=data.system_prompt,
            user_prompt=data.user_prompt,
            variables=data.variables,
            model_params=data.model_params,
            change_note=data.change_note,
        )
        self.db.add(version)
        await self.db.flush()

        template.active_version_id = version.id
        await self.db.commit()
        # Re-fetch with eager loading to avoid lazy-load issues
        return await self.get_template(template.id)  # type: ignore[return-value]

    async def get_template(self, template_id: uuid.UUID) -> PromptTemplate | None:
        result = await self.db.execute(
            select(PromptTemplate)
            .options(selectinload(PromptTemplate.versions))
            .where(PromptTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    async def get_template_by_name(self, name: str) -> PromptTemplate | None:
        result = await self.db.execute(
            select(PromptTemplate)
            .options(selectinload(PromptTemplate.versions))
            .where(PromptTemplate.name == name)
        )
        return result.scalar_one_or_none()

    async def list_templates(
        self, category: str | None = None, is_active: bool | None = None
    ) -> list[PromptTemplate]:
        stmt = (
            select(PromptTemplate)
            .options(selectinload(PromptTemplate.versions))
            .order_by(PromptTemplate.name)
        )
        if category is not None:
            stmt = stmt.where(PromptTemplate.category == category)
        if is_active is not None:
            stmt = stmt.where(PromptTemplate.is_active == is_active)
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all())

    async def update_template(
        self, template_id: uuid.UUID, data: PromptTemplateUpdate
    ) -> PromptTemplate | None:
        template = await self.get_template(template_id)
        if template is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(template, field, value)
        await self.db.commit()
        return await self.get_template(template_id)

    async def delete_template(self, template_id: uuid.UUID) -> bool:
        template = await self.get_template(template_id)
        if template is None:
            return False
        await self.db.delete(template)
        await self.db.commit()
        return True

    # ── Versions ─────────────────────────────────────────

    async def create_version(
        self, template_id: uuid.UUID, data: PromptVersionCreate
    ) -> PromptVersion | None:
        """Add a new version to an existing template."""
        template = await self.get_template(template_id)
        if template is None:
            return None

        # Determine next version number
        max_version = await self.db.execute(
            select(func.max(PromptVersion.version_number)).where(
                PromptVersion.template_id == template_id
            )
        )
        next_version = (max_version.scalar() or 0) + 1

        version = PromptVersion(
            template_id=template_id,
            version_number=next_version,
            system_prompt=data.system_prompt,
            user_prompt=data.user_prompt,
            variables=data.variables,
            model_params=data.model_params,
            change_note=data.change_note,
        )
        self.db.add(version)
        await self.db.flush()

        # Auto-promote: set as active version
        template.active_version_id = version.id
        await self.db.commit()
        await self.db.refresh(version)
        return version

    async def get_version(self, version_id: uuid.UUID) -> PromptVersion | None:
        result = await self.db.execute(
            select(PromptVersion).where(PromptVersion.id == version_id)
        )
        return result.scalar_one_or_none()

    async def set_active_version(
        self, template_id: uuid.UUID, version_id: uuid.UUID
    ) -> bool:
        """Manually set which version is active for a template."""
        template = await self.get_template(template_id)
        if template is None:
            return False
        # Verify version belongs to this template
        version = await self.get_version(version_id)
        if version is None or version.template_id != template_id:
            return False
        template.active_version_id = version_id
        await self.db.commit()
        return True

    # ── Rendering ────────────────────────────────────────

    async def render(
        self, template_id: uuid.UUID, request: PromptRenderRequest
    ) -> PromptRenderOut | None:
        """Render a prompt template with variable substitution.

        If an active A/B experiment exists for this template and no specific
        version is requested, the experiment's traffic split determines which
        variant is returned.
        """
        template = await self.get_template(template_id)
        if template is None:
            return None

        experiment_id: uuid.UUID | None = None
        variant_label: str | None = None
        version: PromptVersion | None = None

        if request.version_id:
            # Explicit version requested
            version = await self.get_version(request.version_id)
        else:
            # Check for active experiment
            experiment = await self._get_active_experiment(template_id)
            if experiment:
                version, variant_label = self._pick_experiment_variant(experiment)
                experiment_id = experiment.id
                # Bump impression count
                if variant_label == "a":
                    experiment.variant_a_impressions += 1
                else:
                    experiment.variant_b_impressions += 1
                await self.db.commit()
            else:
                # Use active version
                if template.active_version_id:
                    version = await self.get_version(template.active_version_id)

        if version is None:
            return None

        rendered_system = self._substitute(version.system_prompt, request.variables) if version.system_prompt else None
        rendered_user = self._substitute(version.user_prompt, request.variables)

        return PromptRenderOut(
            system_prompt=rendered_system,
            user_prompt=rendered_user,
            version_id=version.id,
            version_number=version.version_number,
            experiment_id=experiment_id,
            variant=variant_label,
        )

    # ── A/B Experiments ──────────────────────────────────

    async def create_experiment(
        self, template_id: uuid.UUID, data: ExperimentCreate
    ) -> PromptExperiment | None:
        template = await self.get_template(template_id)
        if template is None:
            return None

        experiment = PromptExperiment(
            template_id=template_id,
            name=data.name,
            description=data.description,
            variant_a_id=data.variant_a_id,
            variant_b_id=data.variant_b_id,
            traffic_split=data.traffic_split,
        )
        self.db.add(experiment)
        await self.db.commit()
        await self.db.refresh(experiment)
        return experiment

    async def record_score(
        self, experiment_id: uuid.UUID, data: ExperimentScoreRequest
    ) -> PromptExperiment | None:
        """Record a quality score for a variant (running average)."""
        result = await self.db.execute(
            select(PromptExperiment).where(PromptExperiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()
        if experiment is None or not experiment.is_active:
            return None

        if data.variant == "a":
            n = experiment.variant_a_impressions or 1
            experiment.variant_a_score = (
                (experiment.variant_a_score * (n - 1) + data.score) / n
            )
        else:
            n = experiment.variant_b_impressions or 1
            experiment.variant_b_score = (
                (experiment.variant_b_score * (n - 1) + data.score) / n
            )

        await self.db.commit()
        await self.db.refresh(experiment)
        return experiment

    async def conclude_experiment(
        self, experiment_id: uuid.UUID, data: ExperimentConclude
    ) -> PromptExperiment | None:
        """End an experiment, declare a winner, optionally promote the winning version."""
        result = await self.db.execute(
            select(PromptExperiment).where(PromptExperiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()
        if experiment is None:
            return None

        winner_id = experiment.variant_a_id if data.winner == "a" else experiment.variant_b_id
        experiment.winner_id = winner_id
        experiment.is_active = False
        experiment.concluded_at = datetime.now(timezone.utc)

        if data.promote:
            template = await self.get_template(experiment.template_id)
            if template:
                template.active_version_id = winner_id

        await self.db.commit()
        await self.db.refresh(experiment)
        return experiment

    async def list_experiments(
        self, template_id: uuid.UUID, active_only: bool = False
    ) -> list[PromptExperiment]:
        stmt = select(PromptExperiment).where(
            PromptExperiment.template_id == template_id
        )
        if active_only:
            stmt = stmt.where(PromptExperiment.is_active == True)  # noqa: E712
        result = await self.db.execute(stmt.order_by(PromptExperiment.created_at.desc()))
        return list(result.scalars().all())

    # ── Private helpers ──────────────────────────────────

    async def _get_active_experiment(
        self, template_id: uuid.UUID
    ) -> PromptExperiment | None:
        result = await self.db.execute(
            select(PromptExperiment)
            .options(
                selectinload(PromptExperiment.variant_a),
                selectinload(PromptExperiment.variant_b),
            )
            .where(
                PromptExperiment.template_id == template_id,
                PromptExperiment.is_active == True,  # noqa: E712
            ).limit(1)
        )
        return result.scalar_one_or_none()

    def _pick_experiment_variant(
        self, experiment: PromptExperiment
    ) -> tuple[PromptVersion, str]:
        """Randomly choose a variant based on traffic split."""
        if random.random() < experiment.traffic_split:
            return experiment.variant_a, "a"
        return experiment.variant_b, "b"

    @staticmethod
    def _substitute(text: str, variables: dict[str, str]) -> str:
        """Replace {{variable}} placeholders with provided values."""
        def replacer(match: re.Match) -> str:
            key = match.group(1)
            return variables.get(key, match.group(0))
        return _VAR_PATTERN.sub(replacer, text)
