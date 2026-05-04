"""
Intelli Platform — Multi-Agent Data Models
Feature: AI-7.2

Pydantic models for agent definitions, tasks, messages, and execution state.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    WAITING = "waiting"       # waiting for another agent's output
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DELEGATED = "delegated"   # handed off to a sub-agent
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class AgentCapability(str, Enum):
    """Predefined capabilities an agent can declare."""
    TEXT_GENERATION = "text_generation"
    SUMMARIZATION = "summarization"
    EXTRACTION = "extraction"
    ANALYSIS = "analysis"
    CLASSIFICATION = "classification"
    TRANSLATION = "translation"
    CODE_GENERATION = "code_generation"
    SEARCH = "search"
    REASONING = "reasoning"
    VISION = "vision"
    CUSTOM = "custom"


class AgentConfig(BaseModel):
    """Blueprint for creating an agent."""
    agent_type: str                          # e.g. "summarizer", "recruiter_screener"
    display_name: str
    system_prompt: str                       # the agent's persona / instructions
    capabilities: list[AgentCapability] = []
    model: str | None = None                 # override the default LLM model
    temperature: float = 0.7
    max_tokens: int = 2048
    max_retries: int = 2
    timeout_seconds: float = 120.0
    confidence_threshold: float = 0.7        # escalate if confidence < this value
    fallback_model: str | None = None        # retry with this model if confidence is low
    enabled_tools: list[str] = Field(default_factory=list)  # tool names from registry
    metadata: dict = Field(default_factory=dict)


class AgentMessage(BaseModel):
    """A message passed between agents or between an agent and the orchestrator."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_agent: str                          # agent_id or "orchestrator"
    to_agent: str                            # agent_id or "orchestrator"
    content: str
    message_type: str = "text"               # text, task_result, error, handoff
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Task(BaseModel):
    """A unit of work assigned to an agent."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.NORMAL
    assigned_to: str | None = None           # agent_id
    delegated_from: str | None = None        # parent agent_id if sub-delegated
    input_data: dict = Field(default_factory=dict)
    output_data: dict = Field(default_factory=dict)
    confidence_score: float | None = None    # confidence of the response (0.0-1.0)
    error: str | None = None
    retries: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @property
    def duration_ms(self) -> float | None:
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() * 1000
        return None


class AgentState(BaseModel):
    """Runtime state of a live agent instance."""
    agent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    config: AgentConfig
    status: AgentStatus = AgentStatus.IDLE
    current_task: str | None = None          # task_id
    conversation_history: list[dict] = Field(default_factory=list)
    completed_tasks: list[str] = Field(default_factory=list)
    total_tokens_used: int = 0
    total_cost_usd: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PipelineStep(BaseModel):
    """A single step in a multi-agent pipeline."""
    agent_type: str
    task_name: str
    task_description: str
    input_mapping: dict[str, str] = Field(default_factory=dict)
    # e.g. {"text": "$previous.output"} — maps inputs from prior step outputs


class PipelineConfig(BaseModel):
    """Defines a sequence of agents that process data in order."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    steps: list[PipelineStep]
    parallel_groups: list[list[int]] = Field(default_factory=list)
    # e.g. [[0,1],[2]] means steps 0 and 1 run in parallel, then step 2
