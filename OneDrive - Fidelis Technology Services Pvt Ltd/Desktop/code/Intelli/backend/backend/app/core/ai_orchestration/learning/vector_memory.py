"""
Intelli Platform — Vector Memory for Self-Learning
Feature: AI-7.2-learning

Pinecone-backed semantic memory for agent task outcomes.
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


class VectorMemory:
    """Manages semantic vector embeddings of agent outcomes using Pinecone."""

    def __init__(self, api_key: str, index_name: str = "agent-outcomes"):
        from pinecone import Pinecone
        from sentence_transformers import SentenceTransformer

        self._pc = Pinecone(api_key=api_key)
        self._index = self._pc.Index(index_name)
        self._embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Initialized VectorMemory with Pinecone index: %s", index_name)

    async def embed(self, text: str) -> list[float]:
        """Embed text into vector space (async-safe)."""
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None, lambda: self._embedder.encode(text).tolist()
        )
        return embedding

    async def upsert_outcome(
        self,
        outcome_id: str,
        task_description: str,
        response_content: str,
        agent_type: str,
        confidence: float,
        feedback: float | None,
    ) -> str:
        """Embed and store an outcome in Pinecone."""
        text = f"Task: {task_description}\nResponse: {response_content}"
        vector = await self.embed(text)

        metadata = {
            "agent_type": agent_type,
            "confidence": float(confidence),
            "feedback": float(feedback) if feedback is not None else 0.0,
            "task_description": task_description[:500],  # Truncate for metadata
        }

        # Upsert to Pinecone
        self._index.upsert(
            vectors=[
                {
                    "id": outcome_id,
                    "values": vector,
                    "metadata": metadata,
                }
            ]
        )
        logger.debug(
            "Upserted outcome to vector DB: %s (agent_type=%s)",
            outcome_id[:8],
            agent_type,
        )
        return outcome_id

    async def retrieve_similar(
        self,
        task_description: str,
        agent_type: str,
        top_k: int = 5,
        min_feedback: float = 0.6,
    ) -> list[dict]:
        """Retrieve semantically similar past outcomes."""
        vector = await self.embed(task_description)

        # Query Pinecone with metadata filtering
        results = self._index.query(
            vector=vector,
            top_k=top_k,
            filter={"agent_type": {"$eq": agent_type}, "feedback": {"$gte": min_feedback}},
            include_metadata=True,
        )

        matches = [
            {
                "id": m.id,
                "score": m.score,
                **m.metadata,
            }
            for m in results.matches
        ]
        logger.debug(
            "Retrieved %d similar outcomes for agent_type=%s",
            len(matches),
            agent_type,
        )
        return matches


# Global instance (lazy-loaded)
_vector_memory_instance: VectorMemory | None = None


def get_vector_memory() -> VectorMemory | None:
    """Get or create the global VectorMemory instance."""
    global _vector_memory_instance
    if _vector_memory_instance is None:
        from app.config import settings

        if settings.PINECONE_API_KEY:
            try:
                _vector_memory_instance = VectorMemory(
                    api_key=settings.PINECONE_API_KEY,
                    index_name=settings.PINECONE_AGENT_INDEX,
                )
                logger.info("VectorMemory initialized")
            except Exception as e:
                logger.warning("Failed to initialize VectorMemory: %s", e)
        else:
            logger.info("PINECONE_API_KEY not set; VectorMemory disabled")

    return _vector_memory_instance
