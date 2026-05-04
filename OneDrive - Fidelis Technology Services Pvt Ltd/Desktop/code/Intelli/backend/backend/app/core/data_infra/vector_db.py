"""
Intelli Platform — Vector Database Layer
Feature: DATA-5.2

Concrete Pinecone implementation of BaseVectorStore (defined by AI-7.3 contract),
plus an embedding service for generating vectors from text.

Supports:
- Pinecone (production) via pinecone-client
- InMemoryVectorStore (dev/test) from the RAG contract module

Usage:
    from app.core.data_infra.vector_db import get_embedding_service, init_vector_store

    # On app startup
    await init_vector_store()

    # Generate embeddings
    embedder = get_embedding_service()
    vectors = await embedder.embed_texts(["hello world"])

    # Use the store (same interface as RAG contract)
    from app.core.ai_orchestration.rag.vector_store_contract import get_vector_store
    store = get_vector_store()
    await store.upsert(docs)
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import settings
from app.core.ai_orchestration.rag.vector_store_contract import (
    BaseVectorStore,
    InMemoryVectorStore,
    VectorDocument,
    set_vector_store,
    get_vector_store,
)

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════
# Embedding Service
# ══════════════════════════════════════════════════════════════════════

class EmbeddingService:
    """Generate embeddings using sentence-transformers (runs locally, no API key needed)."""

    def __init__(self, model_name: str | None = None):
        self._model_name = model_name or settings.VECTOR_EMBEDDING_MODEL
        self._model = None

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
            logger.info("Loaded embedding model: %s (dim=%d)", self._model_name, self.dimension)

    @property
    def dimension(self) -> int:
        if self._model is not None:
            return self._model.get_sentence_embedding_dimension()
        return settings.VECTOR_EMBEDDING_DIMENSION

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts. Returns list of float vectors."""
        self._load_model()
        embeddings = self._model.encode(texts, normalize_embeddings=True)
        return [vec.tolist() for vec in embeddings]

    async def embed_query(self, query: str) -> list[float]:
        """Embed a single query string."""
        results = await self.embed_texts([query])
        return results[0]


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


# ══════════════════════════════════════════════════════════════════════
# Pinecone Vector Store
# ══════════════════════════════════════════════════════════════════════

class PineconeVectorStore(BaseVectorStore):
    """Production vector store backed by Pinecone."""

    def __init__(self, api_key: str, index_name: str):
        from pinecone import Pinecone
        self._pc = Pinecone(api_key=api_key)
        self._index_name = index_name
        self._index = None
        self._host_cache: dict[str, Any] = {}

    def _get_index(self):
        if self._index is None:
            self._index = self._pc.Index(self._index_name)
        return self._index

    # ── BaseVectorStore implementation ──────────────────────────

    async def upsert(self, documents: list[VectorDocument], collection: str = "default") -> int:
        index = self._get_index()
        vectors = []
        for doc in documents:
            if not doc.embedding:
                continue
            vectors.append({
                "id": doc.id,
                "values": doc.embedding,
                "metadata": {**doc.metadata, "_content": doc.content[:4000], "_collection": collection},
            })
        if not vectors:
            return 0

        # Pinecone upsert in batches of 100
        batch_size = 100
        total = 0
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            index.upsert(vectors=batch, namespace=collection)
            total += len(batch)
        return total

    async def search(
        self,
        query_embedding: list[float],
        collection: str = "default",
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[VectorDocument]:
        index = self._get_index()

        query_params: dict[str, Any] = {
            "vector": query_embedding,
            "top_k": top_k,
            "namespace": collection,
            "include_metadata": True,
        }
        if filter_metadata:
            query_params["filter"] = filter_metadata

        results = index.query(**query_params)

        documents = []
        for match in results.get("matches", []):
            meta = dict(match.get("metadata", {}))
            content = meta.pop("_content", "")
            meta.pop("_collection", None)
            documents.append(VectorDocument(
                id=match["id"],
                content=content,
                embedding=[],  # don't return full vectors on search
                metadata=meta,
                collection=collection,
                score=match.get("score", 0.0),
            ))
        return documents

    async def delete(self, document_ids: list[str], collection: str = "default") -> int:
        index = self._get_index()
        index.delete(ids=document_ids, namespace=collection)
        return len(document_ids)

    async def get(self, document_ids: list[str], collection: str = "default") -> list[VectorDocument]:
        index = self._get_index()
        result = index.fetch(ids=document_ids, namespace=collection)
        documents = []
        for vec_id, vec_data in result.get("vectors", {}).items():
            meta = dict(vec_data.get("metadata", {}))
            content = meta.pop("_content", "")
            meta.pop("_collection", None)
            documents.append(VectorDocument(
                id=vec_id,
                content=content,
                embedding=vec_data.get("values", []),
                metadata=meta,
                collection=collection,
            ))
        return documents

    async def list_collections(self) -> list[str]:
        index = self._get_index()
        stats = index.describe_index_stats()
        return list(stats.get("namespaces", {}).keys())

    async def create_collection(self, name: str, dimension: int = 1536) -> None:
        # Pinecone uses namespaces within an index — no explicit creation needed.
        # If the index itself doesn't exist, create it.
        existing = [idx.name for idx in self._pc.list_indexes()]
        if self._index_name not in existing:
            from pinecone import ServerlessSpec
            self._pc.create_index(
                name=self._index_name,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            self._index = None  # force re-fetch
            logger.info("Created Pinecone index: %s (dim=%d)", self._index_name, dimension)

    async def delete_collection(self, name: str) -> None:
        # Delete all vectors in the namespace
        index = self._get_index()
        index.delete(delete_all=True, namespace=name)

    async def health_check(self) -> bool:
        try:
            index = self._get_index()
            index.describe_index_stats()
            return True
        except Exception:
            return False


# ══════════════════════════════════════════════════════════════════════
# Initialization (called at app startup)
# ══════════════════════════════════════════════════════════════════════

async def init_vector_store() -> BaseVectorStore:
    """Initialize the vector store based on config and register it with the RAG contract."""
    provider = settings.VECTOR_DB_PROVIDER.lower()

    if provider == "pinecone" and settings.PINECONE_API_KEY:
        store = PineconeVectorStore(
            api_key=settings.PINECONE_API_KEY,
            index_name=settings.PINECONE_INDEX_NAME,
        )
        # Ensure the default index exists
        await store.create_collection("default", dimension=get_embedding_service().dimension)
        logger.info("Vector store initialized: Pinecone (index=%s)", settings.PINECONE_INDEX_NAME)
    else:
        store = InMemoryVectorStore()
        logger.info("Vector store initialized: InMemory (dev mode — set PINECONE_API_KEY for production)")

    set_vector_store(store)
    return store
