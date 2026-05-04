"""
Intelli Platform — Agent Persistence Models
Feature: AI-7.2-persistence

SQLAlchemy ORM models for persisting agent state, task history, and learning outcomes.
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import JSON, Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import BaseModel


class PersistedAgentState(BaseModel):
    """Persistent storage of an agent's state for recovery across restarts."""

    __tablename__ = "ai_agent_states"

    agent_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="idle")
    conversation_history: Mapped[list] = mapped_column(JSON, default=list)
    total_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    last_active: Mapped[datetime | None] = mapped_column(nullable=True)
    is_persistent: Mapped[bool] = mapped_column(Boolean, default=True)


class PersistedTask(BaseModel):
    """Persistent storage of task execution history."""

    __tablename__ = "ai_agent_tasks"

    task_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    agent_type: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(50), default="normal")
    input_data: Mapped[dict] = mapped_column(JSON, default=dict)
    output_data: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retries: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class TaskOutcome(BaseModel):
    """Self-learning outcomes: feedback and results for future prompt improvement."""

    __tablename__ = "ai_task_outcomes"

    task_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    response_content: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.5)
    feedback_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    was_escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
