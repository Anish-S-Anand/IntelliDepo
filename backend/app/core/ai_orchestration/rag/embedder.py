"""
Intelli Platform — Embedding Service
Feature: AI-7.3

Generates vector embeddings for text chunks using OpenAI, Cohere, or local models.
Supports batched embedding for efficiency.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from enum import Enum

from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingProvider(str, Enum):
    OPENAI = "openai"
    LOCAL = "local"


class EmbeddingConfig(BaseModel):
    provider: EmbeddingProvider = EmbeddingProvider.OPENAI
    model: str = "text-embedding-3-small"
    dimension: int = 1536
    batch_size: int = 100  # max texts per API call


class BaseEmbedder(ABC):
    """Interface for embedding providers."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""

    @abstractmethod
    async def embed_single(self, text: str) -> list[float]:
        """Generate embedding for a single text."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding dimension."""


class OpenAIEmbedder(BaseEmbedder):
    """Embedding using OpenAI's embedding API."""

    def __init__(self, config: EmbeddingConfig | None = None):
        self.config = config or EmbeddingConfig()
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []

        # Process in batches
        for i in range(0, len(texts), self.config.batch_size):
            batch = texts[i : i + self.config.batch_size]
            # Clean texts — API rejects empty strings
            batch = [t if t.strip() else " " for t in batch]

            response = await self._client.embeddings.create(
                model=self.config.model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def embed_single(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]

    @property
    def dimension(self) -> int:
        return self.config.dimension


class LocalEmbedder(BaseEmbedder):
    """
    Embedding using a local model via sentence-transformers.
    Falls back to a simple hash-based pseudo-embedding if the library is unavailable.
    """

    def __init__(self, config: EmbeddingConfig | None = None):
        self.config = config or EmbeddingConfig(
            provider=EmbeddingProvider.LOCAL,
            model="all-MiniLM-L6-v2",
            dimension=384,
        )
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.config.model)
            logger.info("Loaded local embedding model: %s", self.config.model)
        except ImportError:
            logger.warning(
                "sentence-transformers not installed, using hash-based pseudo-embeddings"
            )
            self._model = "fallback"

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self._load_model()
        if self._model == "fallback":
            return [self._hash_embed(t) for t in texts]
        embeddings = self._model.encode(texts, show_progress_bar=False)
        return [e.tolist() for e in embeddings]

    async def embed_single(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]

    @property
    def dimension(self) -> int:
        return self.config.dimension

    def _hash_embed(self, text: str) -> list[float]:
        """Deterministic pseudo-embedding for testing without ML models."""
        import hashlib
        h = hashlib.sha256(text.encode()).hexdigest()
        # Convert hex to floats in [-1, 1]
        dim = self.config.dimension
        values = []
        for i in range(dim):
            byte_idx = i % 32
            val = int(h[byte_idx * 2 : byte_idx * 2 + 2], 16) / 127.5 - 1.0
            values.append(val)
        return values


# ── Factory ──────────────────────────────────────────────────

_embedder: BaseEmbedder | None = None


def get_embedder(config: EmbeddingConfig | None = None) -> BaseEmbedder:
    """Get or create the singleton embedder."""
    global _embedder
    if _embedder is not None:
        return _embedder

    config = config or EmbeddingConfig()

    if config.provider == EmbeddingProvider.OPENAI and settings.OPENAI_API_KEY:
        _embedder = OpenAIEmbedder(config)
    else:
        _embedder = LocalEmbedder(config)

    return _embedder
