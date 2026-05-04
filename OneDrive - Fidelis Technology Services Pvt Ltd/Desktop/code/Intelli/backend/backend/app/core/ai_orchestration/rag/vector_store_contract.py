"""
Intelli Platform — Vector Store Interface Contract
Feature: AI-7.3 (interface for DATA-5.2)

Abstract interface that DATA-5.2 (Vector Database Layer) must implement.
RAG uses this contract so it works regardless of the vector DB backend
(Pinecone, Weaviate, ChromaDB, etc.).

NOTE: This is an interface contract per MVP_TRACKER Rule 5.
When DATA-5.2 is BUILT, it must provide a concrete implementation of
BaseVectorStore and register it via set_vector_store().
"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class VectorDocument(BaseModel):
    """A document stored in the vector database."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    embedding: list[float] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    collection: str = "default"
    score: float = 0.0  # similarity score (populated on retrieval)


class VectorSearchResult(BaseModel):
    """Result from a vector similarity search."""
    documents: list[VectorDocument]
    query: str
    total_found: int = 0


class BaseVectorStore(ABC):
    """
    Interface contract for vector database backends.
    DATA-5.2 must implement this class.
    """

    @abstractmethod
    async def upsert(self, documents: list[VectorDocument], collection: str = "default") -> int:
        """Insert or update documents with their embeddings. Returns count upserted."""

    @abstractmethod
    async def search(
        self,
        query_embedding: list[float],
        collection: str = "default",
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[VectorDocument]:
        """Search for similar documents by embedding vector."""

    @abstractmethod
    async def delete(self, document_ids: list[str], collection: str = "default") -> int:
        """Delete documents by ID. Returns count deleted."""

    @abstractmethod
    async def get(self, document_ids: list[str], collection: str = "default") -> list[VectorDocument]:
        """Retrieve documents by ID."""

    @abstractmethod
    async def list_collections(self) -> list[str]:
        """List all available collections."""

    @abstractmethod
    async def create_collection(self, name: str, dimension: int = 1536) -> None:
        """Create a new collection/index."""

    @abstractmethod
    async def delete_collection(self, name: str) -> None:
        """Delete a collection/index."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the vector store is reachable."""


class InMemoryVectorStore(BaseVectorStore):
    """
    In-memory vector store for development/testing when DATA-5.2 is not yet BUILT.
    Uses brute-force cosine similarity. NOT for production.
    """

    def __init__(self):
        self._collections: dict[str, dict[str, VectorDocument]] = {}

    async def upsert(self, documents: list[VectorDocument], collection: str = "default") -> int:
        if collection not in self._collections:
            self._collections[collection] = {}
        for doc in documents:
            self._collections[collection][doc.id] = doc
        return len(documents)

    async def search(
        self,
        query_embedding: list[float],
        collection: str = "default",
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[VectorDocument]:
        if collection not in self._collections:
            return []

        docs = list(self._collections[collection].values())

        # Apply metadata filter
        if filter_metadata:
            docs = [
                d for d in docs
                if all(d.metadata.get(k) == v for k, v in filter_metadata.items())
            ]

        # Cosine similarity
        scored = []
        for doc in docs:
            if not doc.embedding:
                continue
            score = self._cosine_similarity(query_embedding, doc.embedding)
            result = doc.model_copy()
            result.score = score
            scored.append(result)

        scored.sort(key=lambda d: d.score, reverse=True)
        return scored[:top_k]

    async def delete(self, document_ids: list[str], collection: str = "default") -> int:
        if collection not in self._collections:
            return 0
        count = 0
        for doc_id in document_ids:
            if doc_id in self._collections[collection]:
                del self._collections[collection][doc_id]
                count += 1
        return count

    async def get(self, document_ids: list[str], collection: str = "default") -> list[VectorDocument]:
        if collection not in self._collections:
            return []
        return [
            self._collections[collection][doc_id]
            for doc_id in document_ids
            if doc_id in self._collections[collection]
        ]

    async def list_collections(self) -> list[str]:
        return list(self._collections.keys())

    async def create_collection(self, name: str, dimension: int = 1536) -> None:
        if name not in self._collections:
            self._collections[name] = {}

    async def delete_collection(self, name: str) -> None:
        self._collections.pop(name, None)

    async def health_check(self) -> bool:
        return True

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        if len(a) != len(b) or not a:
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = sum(x * x for x in a) ** 0.5
        mag_b = sum(x * x for x in b) ** 0.5
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)


# ── Singleton registry ──────────────────────────────────────

_vector_store: BaseVectorStore | None = None


def get_vector_store() -> BaseVectorStore:
    """Get the current vector store. Falls back to in-memory if DATA-5.2 not configured."""
    global _vector_store
    if _vector_store is None:
        _vector_store = InMemoryVectorStore()
    return _vector_store


def set_vector_store(store: BaseVectorStore) -> None:
    """Register the concrete vector store implementation (called by DATA-5.2)."""
    global _vector_store
    _vector_store = store
