"""
Tests for DATA-5.2: Vector Database Layer

Tests the vector store contract implementation (InMemory) and embedding service.
Uses InMemoryVectorStore so tests run without Pinecone credentials.
"""
import pytest

from app.core.ai_orchestration.rag.vector_store_contract import (
    InMemoryVectorStore,
    VectorDocument,
    get_vector_store,
    set_vector_store,
)
from app.core.data_infra.vector_db import (
    EmbeddingService,
    PineconeVectorStore,
    init_vector_store,
)


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def store():
    return InMemoryVectorStore()


@pytest.fixture
def sample_docs():
    return [
        VectorDocument(
            id="doc-1",
            content="Warehouse inventory is running low on SKU-42",
            embedding=[0.1, 0.2, 0.3, 0.4],
            metadata={"category": "inventory", "priority": "high"},
            collection="depot",
        ),
        VectorDocument(
            id="doc-2",
            content="Monthly revenue report shows 15% growth",
            embedding=[0.5, 0.6, 0.7, 0.8],
            metadata={"category": "finance", "priority": "medium"},
            collection="depot",
        ),
        VectorDocument(
            id="doc-3",
            content="New employee onboarding checklist updated",
            embedding=[0.9, 0.1, 0.2, 0.3],
            metadata={"category": "hr", "priority": "low"},
            collection="depot",
        ),
    ]


# ── InMemoryVectorStore Tests ─────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_documents(store, sample_docs):
    count = await store.upsert(sample_docs, collection="depot")
    assert count == 3


@pytest.mark.asyncio
async def test_upsert_updates_existing(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    updated = VectorDocument(
        id="doc-1",
        content="Updated content",
        embedding=[0.9, 0.8, 0.7, 0.6],
        metadata={"category": "updated"},
    )
    count = await store.upsert([updated], collection="depot")
    assert count == 1
    results = await store.get(["doc-1"], collection="depot")
    assert results[0].content == "Updated content"


@pytest.mark.asyncio
async def test_search_returns_sorted_by_similarity(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    # Search with embedding close to doc-1
    results = await store.search(
        query_embedding=[0.1, 0.2, 0.3, 0.4],
        collection="depot",
        top_k=3,
    )
    assert len(results) == 3
    assert results[0].id == "doc-1"
    assert results[0].score > results[1].score


@pytest.mark.asyncio
async def test_search_with_metadata_filter(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    results = await store.search(
        query_embedding=[0.1, 0.2, 0.3, 0.4],
        collection="depot",
        top_k=10,
        filter_metadata={"category": "finance"},
    )
    assert len(results) == 1
    assert results[0].id == "doc-2"


@pytest.mark.asyncio
async def test_search_top_k_limit(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    results = await store.search(
        query_embedding=[0.5, 0.5, 0.5, 0.5],
        collection="depot",
        top_k=1,
    )
    assert len(results) == 1


@pytest.mark.asyncio
async def test_search_empty_collection(store):
    results = await store.search(
        query_embedding=[0.1, 0.2],
        collection="nonexistent",
    )
    assert results == []


@pytest.mark.asyncio
async def test_get_documents(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    results = await store.get(["doc-1", "doc-3"], collection="depot")
    assert len(results) == 2
    ids = {doc.id for doc in results}
    assert ids == {"doc-1", "doc-3"}


@pytest.mark.asyncio
async def test_get_nonexistent_documents(store):
    results = await store.get(["missing-id"], collection="depot")
    assert results == []


@pytest.mark.asyncio
async def test_delete_documents(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    deleted = await store.delete(["doc-1", "doc-2"], collection="depot")
    assert deleted == 2
    remaining = await store.get(["doc-1", "doc-2", "doc-3"], collection="depot")
    assert len(remaining) == 1
    assert remaining[0].id == "doc-3"


@pytest.mark.asyncio
async def test_delete_nonexistent(store):
    deleted = await store.delete(["missing"], collection="depot")
    assert deleted == 0


@pytest.mark.asyncio
async def test_create_and_list_collections(store):
    await store.create_collection("alpha")
    await store.create_collection("beta")
    collections = await store.list_collections()
    assert "alpha" in collections
    assert "beta" in collections


@pytest.mark.asyncio
async def test_delete_collection(store, sample_docs):
    await store.upsert(sample_docs, collection="depot")
    await store.delete_collection("depot")
    results = await store.get(["doc-1"], collection="depot")
    assert results == []
    collections = await store.list_collections()
    assert "depot" not in collections


@pytest.mark.asyncio
async def test_health_check(store):
    assert await store.health_check() is True


# ── Cosine Similarity Edge Cases ──────────────────────────────────

@pytest.mark.asyncio
async def test_cosine_similarity_zero_vectors(store):
    score = store._cosine_similarity([0, 0, 0], [1, 2, 3])
    assert score == 0.0


@pytest.mark.asyncio
async def test_cosine_similarity_identical_vectors(store):
    score = store._cosine_similarity([1, 2, 3], [1, 2, 3])
    assert abs(score - 1.0) < 1e-6


@pytest.mark.asyncio
async def test_cosine_similarity_empty_vectors(store):
    score = store._cosine_similarity([], [])
    assert score == 0.0


@pytest.mark.asyncio
async def test_cosine_similarity_mismatched_length(store):
    score = store._cosine_similarity([1, 2], [1, 2, 3])
    assert score == 0.0


# ── Namespace / Collection Isolation ──────────────────────────────

@pytest.mark.asyncio
async def test_collections_are_isolated(store):
    doc_a = VectorDocument(id="a1", content="alpha", embedding=[1, 0], collection="alpha")
    doc_b = VectorDocument(id="b1", content="beta", embedding=[0, 1], collection="beta")
    await store.upsert([doc_a], collection="alpha")
    await store.upsert([doc_b], collection="beta")

    alpha_results = await store.get(["a1", "b1"], collection="alpha")
    assert len(alpha_results) == 1
    assert alpha_results[0].id == "a1"


# ── Singleton Registry ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_init_vector_store_fallback_to_memory(monkeypatch):
    """Without Pinecone credentials, init should fall back to InMemory."""
    monkeypatch.setattr("app.config.settings.PINECONE_API_KEY", "")
    monkeypatch.setattr("app.config.settings.VECTOR_DB_PROVIDER", "memory")
    store = await init_vector_store()
    assert isinstance(store, InMemoryVectorStore)
    assert get_vector_store() is store


# ── PineconeVectorStore Instantiation ─────────────────────────────

def test_pinecone_store_class_exists():
    """Verify PineconeVectorStore is a proper subclass of BaseVectorStore."""
    from app.core.ai_orchestration.rag.vector_store_contract import BaseVectorStore
    assert issubclass(PineconeVectorStore, BaseVectorStore)
