"""
Intelli Platform — Multi-Agent API Router
Feature: AI-7.2

Endpoints for managing agents, delegating tasks, running pipelines,
and viewing agent stats.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import get_current_user
from app.database import get_db
from app.shared.models.user import User
from app.core.ai_orchestration.agent_framework import (
    AgentOrchestrator,
    get_agent_orchestrator,
)
from app.core.ai_orchestration.agent_models import (
    AgentCapability,
    AgentConfig,
    PipelineConfig,
    TaskPriority,
)

router = APIRouter(prefix="/api/v1/agents", tags=["Multi-Agent Framework"])


def get_orchestrator() -> AgentOrchestrator:
    return get_agent_orchestrator()


# ── Request Schemas ────────────────────────────────────────


class RegisterAgentRequest(BaseModel):
    agent_type: str
    display_name: str
    system_prompt: str
    capabilities: list[AgentCapability] = []
    model: str | None = None
    temperature: float = 0.7
    max_tokens: int = 2048


class DelegateTaskRequest(BaseModel):
    agent_type: str
    task_name: str
    task_description: str
    input_data: dict = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    reuse_agent: bool = True
    async_execution: bool = False  # Queue via Celery instead of executing inline
    confidence_threshold: float | None = None  # Override agent's default threshold


class SendMessageRequest(BaseModel):
    from_agent_id: str
    to_agent_id: str
    content: str
    message_type: str = "text"


class RecordFeedbackRequest(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    label: str | None = None  # "good" | "bad" | "escalated"


# ── Endpoints ──────────────────────────────────────────────


@router.post("/types/register")
async def register_agent_type(
    req: RegisterAgentRequest,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """Register a new agent type blueprint."""
    config = AgentConfig(
        agent_type=req.agent_type,
        display_name=req.display_name,
        system_prompt=req.system_prompt,
        capabilities=req.capabilities,
        model=req.model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )
    orch.register_agent_type(config)
    return {"status": "registered", "agent_type": req.agent_type}


@router.get("/types")
async def list_agent_types(
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """List all registered agent types."""
    return {"types": orch.get_registered_types()}


@router.post("/spawn/{agent_type}")
async def spawn_agent(
    agent_type: str,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """Spawn a new live agent instance from a registered type."""
    try:
        agent = orch.spawn_agent(agent_type)
        return {
            "agent_id": agent.agent_id,
            "agent_type": agent_type,
            "status": agent.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{agent_id}")
async def destroy_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """Destroy a live agent instance."""
    if orch.destroy_agent(agent_id):
        return {"status": "destroyed", "agent_id": agent_id}
    raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")


@router.get("/")
async def list_agents(
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """List all live agents and their states."""
    return {"agents": [a.model_dump() for a in orch.list_agents()]}


@router.post("/delegate")
async def delegate_task(
    req: DelegateTaskRequest,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
    db: AsyncSession = Depends(get_db),
):
    """Delegate a task to an agent (spawns one if needed)."""
    try:
        # Check if async execution requested
        if req.async_execution:
            from app.core.ai_orchestration.tasks.agent_tasks import celery_delegate_task

            async_result = celery_delegate_task.delay(
                agent_type=req.agent_type,
                task_name=req.task_name,
                task_description=req.task_description,
                input_data=req.input_data,
                priority=req.priority.value,
            )
            return {
                "status": "queued",
                "celery_task_id": async_result.id,
                "message": "Task queued for async execution",
            }

        # Sync execution
        task = await orch.delegate_task(
            agent_type=req.agent_type,
            task_name=req.task_name,
            task_description=req.task_description,
            input_data=req.input_data,
            priority=req.priority,
            reuse_agent=req.reuse_agent,
            db=db,
        )
        return task.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/tasks/{celery_task_id}/status")
async def check_async_task_status(
    celery_task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Check the status of an async Celery task."""
    from app.core.ai_orchestration.tasks.celery_app import celery_app

    async_result = celery_app.AsyncResult(celery_task_id)

    return {
        "celery_task_id": celery_task_id,
        "status": async_result.status,
        "result": async_result.result if async_result.ready() else None,
    }


@router.post("/outcomes/{task_id}/feedback")
async def record_outcome_feedback(
    task_id: str,
    req: RecordFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record human feedback on a task outcome for self-learning."""
    try:
        from app.core.ai_orchestration.persistence.models import TaskOutcome

        # Find the outcome in the database
        from sqlalchemy import select
        outcome = await db.scalar(
            select(TaskOutcome).where(TaskOutcome.task_id == task_id).limit(1)
        )

        if not outcome:
            raise HTTPException(status_code=404, detail=f"Outcome '{task_id}' not found")

        # Update feedback
        outcome.feedback_score = req.score
        outcome.feedback_label = req.label
        await db.commit()

        return {
            "status": "feedback_recorded",
            "task_id": task_id,
            "score": req.score,
            "label": req.label,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools")
async def list_tools(
    current_user: User = Depends(get_current_user),
):
    """List all registered tools available to agents."""
    from app.core.ai_orchestration.tools.registry import tool_registry

    tools = tool_registry.list_tools()
    return {
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters_schema,
            }
            for t in tools
        ],
        "count": len(tools),
    }


@router.post("/message")
async def send_message(
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """Send a message between two agents."""
    msg = await orch.send_message(
        from_agent_id=req.from_agent_id,
        to_agent_id=req.to_agent_id,
        content=req.content,
        message_type=req.message_type,
    )
    return msg.model_dump()


@router.post("/pipeline")
async def run_pipeline(
    pipeline: PipelineConfig,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """Execute a multi-agent pipeline."""
    try:
        results = await orch.run_pipeline(pipeline)
        return {"pipeline": pipeline.name, "results": [t.model_dump() for t in results]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tasks")
async def task_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """View recent task history."""
    return {"tasks": [t.model_dump() for t in orch.get_task_history(limit)]}


@router.get("/stats")
async def agent_stats(
    current_user: User = Depends(get_current_user),
    orch: AgentOrchestrator = Depends(get_orchestrator),
):
    """Get orchestrator-level statistics."""
    return orch.get_stats()
