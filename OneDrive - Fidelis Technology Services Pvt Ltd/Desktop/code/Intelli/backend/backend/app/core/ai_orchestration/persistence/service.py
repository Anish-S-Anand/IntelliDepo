"""
Intelli Platform — Agent Persistence Service
Feature: AI-7.2-persistence

CRUD operations for persisting and retrieving agent state, tasks, and outcomes.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_orchestration.agent_models import AgentState, Task
from app.core.ai_orchestration.persistence.models import (
    PersistedAgentState,
    PersistedTask,
    TaskOutcome,
)

logger = logging.getLogger(__name__)


class AgentPersistenceService:
    """Manages persistence of agent state, tasks, and learning outcomes."""

    async def save_agent_state(self, db: AsyncSession, agent_state: AgentState) -> PersistedAgentState:
        """Save or update agent state to the database."""
        persisted = await db.scalar(
            select(PersistedAgentState).where(
                PersistedAgentState.agent_id == agent_state.agent_id
            )
        )

        config_json = agent_state.config.model_dump()

        if persisted:
            persisted.status = agent_state.status.value
            persisted.conversation_history = agent_state.conversation_history
            persisted.total_tokens_used = agent_state.total_tokens_used
            persisted.total_cost_usd = agent_state.total_cost_usd
            persisted.last_active = datetime.now(timezone.utc)
            persisted.config_json = config_json
        else:
            persisted = PersistedAgentState(
                agent_id=agent_state.agent_id,
                agent_type=agent_state.config.agent_type,
                display_name=agent_state.config.display_name,
                config_json=config_json,
                status=agent_state.status.value,
                conversation_history=agent_state.conversation_history,
                total_tokens_used=agent_state.total_tokens_used,
                total_cost_usd=agent_state.total_cost_usd,
                last_active=datetime.now(timezone.utc),
            )
            db.add(persisted)

        await db.commit()
        return persisted

    async def load_agent_states(self, db: AsyncSession) -> list[PersistedAgentState]:
        """Load all persistent agent states from the database."""
        result = await db.scalars(
            select(PersistedAgentState).where(
                PersistedAgentState.is_persistent == True
            )
        )
        return list(result)

    async def save_task(
        self,
        db: AsyncSession,
        task: Task,
        agent_type: str,
        celery_task_id: str | None = None,
    ) -> PersistedTask:
        """Save or update a task to the database."""
        persisted = await db.scalar(
            select(PersistedTask).where(PersistedTask.task_id == task.id)
        )

        if persisted:
            persisted.status = task.status.value
            persisted.input_data = task.input_data
            persisted.output_data = task.output_data
            persisted.confidence_score = task.confidence_score
            persisted.error = task.error
            persisted.retries = task.retries
            persisted.completed_at = task.completed_at
        else:
            persisted = PersistedTask(
                task_id=task.id,
                task_name=task.name,
                task_description=task.description,
                agent_id=task.assigned_to,
                agent_type=agent_type,
                status=task.status.value,
                priority=task.priority.value,
                input_data=task.input_data,
                output_data=task.output_data,
                confidence_score=task.confidence_score,
                error=task.error,
                retries=task.retries,
                celery_task_id=celery_task_id,
                started_at=task.started_at,
                completed_at=task.completed_at,
            )
            db.add(persisted)

        await db.commit()
        return persisted

    async def save_outcome(
        self,
        db: AsyncSession,
        task: Task,
        agent_type: str,
        feedback_score: float | None = None,
        feedback_label: str | None = None,
    ) -> TaskOutcome:
        """Record the outcome of a task for self-learning."""
        response_content = task.output_data.get("response", "")

        outcome = TaskOutcome(
            task_id=task.id,
            agent_type=agent_type,
            task_description=task.description,
            response_content=response_content,
            confidence_score=task.confidence_score or 0.5,
            feedback_score=feedback_score,
            feedback_label=feedback_label,
            model_used=task.output_data.get("model"),
        )
        db.add(outcome)
        await db.commit()
        logger.info(
            "Recorded outcome for task %s (agent_type=%s, confidence=%.2f)",
            task.id[:8],
            agent_type,
            task.confidence_score or 0.5,
        )
        return outcome

    async def get_recent_outcomes(
        self, db: AsyncSession, agent_type: str, limit: int = 20
    ) -> list[TaskOutcome]:
        """Retrieve recent task outcomes for an agent type, ordered by recency."""
        result = await db.scalars(
            select(TaskOutcome)
            .where(TaskOutcome.agent_type == agent_type)
            .order_by(TaskOutcome.created_at.desc())
            .limit(limit)
        )
        return list(result)
