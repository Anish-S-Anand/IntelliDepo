"""
Intelli Platform — Self-Learning Service
Feature: AI-7.2-learning

Service for recording task outcomes, retrieving past examples for context, and improving prompts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_orchestration.agent_models import Task
from app.core.ai_orchestration.learning.vector_memory import VectorMemory
from app.core.ai_orchestration.persistence.models import TaskOutcome
from app.core.ai_orchestration.persistence.service import AgentPersistenceService

logger = logging.getLogger(__name__)


class SelfLearningService:
    """
    Orchestrates the continuous improvement loop for agents:
    1. Records task outcomes and feedback
    2. Embeds outcomes in vector space for retrieval
    3. Injects past similar examples as context for future tasks
    4. Generates improved prompts when enough high-quality data exists
    """

    def __init__(
        self,
        db: AsyncSession,
        vector_memory: VectorMemory | None,
        persistence: AgentPersistenceService,
    ):
        self.db = db
        self.vector_memory = vector_memory
        self.persistence = persistence

    async def record_outcome(
        self,
        task: Task,
        agent_type: str,
        feedback_score: float | None = None,
        feedback_label: str | None = None,
    ) -> TaskOutcome:
        """
        Record the outcome of a completed task for future learning.
        Persists to DB and optionally embeds to vector DB.
        """
        outcome = await self.persistence.save_outcome(
            self.db, task, agent_type, feedback_score, feedback_label
        )

        # Embed the outcome in Pinecone if vector memory is available
        if self.vector_memory and task.output_data.get("response"):
            try:
                embedding_id = await self.vector_memory.upsert_outcome(
                    outcome_id=str(outcome.id),
                    task_description=task.description,
                    response_content=task.output_data["response"],
                    agent_type=agent_type,
                    confidence=task.confidence_score or 0.5,
                    feedback=feedback_score,
                )
                outcome.embedding_id = embedding_id
                await self.db.commit()
                logger.debug(
                    "Embedded outcome %s to Pinecone with ID: %s",
                    outcome.id[:8],
                    embedding_id[:8],
                )
            except Exception as e:
                logger.warning("Failed to embed outcome to Pinecone: %s", e)

        return outcome

    async def build_learning_context(
        self, task_description: str, agent_type: str
    ) -> str:
        """
        Build a context block of past successful examples for few-shot learning.
        Retrieved from Pinecone (if available) or falls back to recent DB outcomes.
        """
        similar_outcomes = []

        # Try to retrieve from Pinecone first
        if self.vector_memory:
            try:
                similar_outcomes = await self.vector_memory.retrieve_similar(
                    task_description, agent_type, top_k=5, min_feedback=0.6
                )
            except Exception as e:
                logger.warning("Failed to retrieve from Pinecone: %s", e)

        # Fallback to recent DB outcomes if Pinecone unavailable or no results
        if not similar_outcomes:
            db_outcomes = await self.persistence.get_recent_outcomes(
                self.db, agent_type, limit=5
            )
            similar_outcomes = [
                {
                    "task_description": o.task_description,
                    "confidence": o.confidence_score,
                    "feedback": o.feedback_score or 0.0,
                }
                for o in db_outcomes
                if (o.feedback_score or 0) >= 0.6
            ]

        # Format as few-shot examples
        if not similar_outcomes:
            return ""

        lines = ["## Past successful examples for similar tasks:"]
        for i, item in enumerate(similar_outcomes, 1):
            task_desc = item.get("task_description", "")[:200]
            confidence = item.get("confidence", 0.0)
            lines.append(f"\nExample {i} (confidence {confidence:.2f}):")
            lines.append(f"Task: {task_desc}")

        context = "\n".join(lines)
        logger.debug(
            "Built learning context with %d examples for agent_type=%s",
            len(similar_outcomes),
            agent_type,
        )
        return context

    async def maybe_improve_prompt(
        self,
        agent_type: str,
        prompt_manager,  # PromptManager type, passed to avoid circular imports
        template_name: str,
    ) -> bool:
        """
        If >= 20 high-quality outcomes exist, generate an improved system prompt.
        Returns True if a new PromptVersion was created.
        """
        outcomes = await self.persistence.get_recent_outcomes(
            self.db, agent_type, limit=50
        )
        good_outcomes = [o for o in outcomes if (o.feedback_score or 0) >= 0.8]

        if len(good_outcomes) < 20:
            logger.debug(
                "Not enough good outcomes (%d < 20) to improve prompt for %s",
                len(good_outcomes),
                agent_type,
            )
            return False

        logger.info(
            "Generating improved prompt for %s based on %d good outcomes",
            agent_type,
            len(good_outcomes),
        )

        # Summarize patterns from good outcomes
        task_samples = "\n".join(
            [f"- {o.task_description[:100]}" for o in good_outcomes[:5]]
        )

        meta_prompt = (
            f"Based on the following successful task outcomes for a {agent_type} agent, "
            f"generate an improved system prompt that captures the key patterns and best practices:\n\n"
            f"Sample tasks:\n{task_samples}\n\n"
            f"Generate a concise, actionable system prompt (2-3 sentences) that will improve performance."
        )

        try:
            from app.core.ai_orchestration.llm_engine import get_llm_engine
            from app.core.ai_orchestration.models import LLMRequest, Message, MessageRole

            engine = get_llm_engine()
            request = LLMRequest(
                messages=[Message(role=MessageRole.USER, content=meta_prompt)],
                temperature=0.3,
                max_tokens=500,
            )
            response = await engine.generate(request)

            # Create a new PromptVersion via the PromptManager
            new_version = await prompt_manager.create_version(
                template_id=None,  # Will be looked up by name
                content=response.content,
                system_prompt=response.content,
                user_prompt="",
                variables=[],
                model_params={"temperature": 0.7},
                template_name=template_name,
            )
            logger.info(
                "Created improved prompt version %d for %s",
                new_version.version_number if hasattr(new_version, "version_number") else "?",
                agent_type,
            )
            return True
        except Exception as e:
            logger.error("Failed to generate improved prompt: %s", e)
            return False
