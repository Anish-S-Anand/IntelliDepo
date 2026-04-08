"""
Intelli Platform — Agent Celery Tasks
Feature: AI-7.2-celery

Async tasks for agent operations (task delegation, etc).
"""
import asyncio
import logging

from app.core.ai_orchestration.agent_models import TaskPriority
from app.core.ai_orchestration.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="agents.delegate_task", max_retries=3)
def celery_delegate_task(
    self,
    agent_type: str,
    task_name: str,
    task_description: str,
    input_data: dict | None = None,
    priority: str = "normal",
) -> dict:
    """
    Async Celery task to delegate a task to an agent.
    Returns the completed task as a serialized dict.
    """

    async def _run():
        from app.core.ai_orchestration.agent_framework import get_agent_orchestrator
        from app.database import async_session

        orchestrator = get_agent_orchestrator()

        async with async_session() as db:
            task = await orchestrator.delegate_task(
                agent_type=agent_type,
                task_name=task_name,
                task_description=task_description,
                input_data=input_data or {},
                priority=TaskPriority(priority),
                db=db,
            )
            # Serialize task to dict (removes datetime objects for JSON)
            return task.model_dump(mode="json")

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("Celery task failed: %s", exc)
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
