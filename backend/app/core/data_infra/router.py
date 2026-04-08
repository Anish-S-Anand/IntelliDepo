"""
Intelli Platform — Vector DB API Router
Feature: DATA-5.2

REST endpoints for vector database operations:
- Collections: list, create, delete
- Documents: upsert (with auto-embedding), search (semantic), get, delete
- Health: vector store status
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import require_permission
from app.core.ai_orchestration.rag.vector_store_contract import (
    VectorDocument,
    get_vector_store,
)
from app.core.data_infra.vector_db import get_embedding_service
from app.shared.models.user import User

router = APIRouter(prefix="/api/v1/vector", tags=["Vector DB"])


# ── Request / Response Schemas ───────────────────────────────────

class DocumentInput(BaseModel):
    content: str
    metadata: dict = Field(default_factory=dict)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class UpsertRequest(BaseModel):
    documents: list[DocumentInput]
    collection: str = "default"


class UpsertResponse(BaseModel):
    upserted: int
    collection: str


class SearchRequest(BaseModel):
    query: str
    collection: str = "default"
    top_k: int = Field(default=5, ge=1, le=100)
    filter_metadata: dict | None = None


class SearchResult(BaseModel):
    id: str
    content: str
    score: float
    metadata: dict


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str
    collection: str
    total: int


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    dimension: int = Field(default=384, ge=1, le=4096)


class CollectionResponse(BaseModel):
    collections: list[str]


class DeleteRequest(BaseModel):
    document_ids: list[str]
    collection: str = "default"


class DeleteResponse(BaseModel):
    deleted: int


class DocumentResponse(BaseModel):
    id: str
    content: str
    metadata: dict
    collection: str


class HealthResponse(BaseModel):
    status: str
    provider: str


# ── Collection Endpoints ─────────────────────────────────────────

@router.get("/collections", response_model=CollectionResponse)
async def list_collections(
    current_user: User = Depends(require_permission("ai:read")),
):
    """List all vector collections/namespaces."""
    store = get_vector_store()
    collections = await store.list_collections()
    return CollectionResponse(collections=collections)


@router.post("/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    current_user: User = Depends(require_permission("ai:write")),
):
    """Create a new vector collection."""
    store = get_vector_store()
    await store.create_collection(body.name, body.dimension)
    collections = await store.list_collections()
    return CollectionResponse(collections=collections)


@router.delete("/collections/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    name: str,
    current_user: User = Depends(require_permission("ai:write")),
):
    """Delete a vector collection and all its documents."""
    store = get_vector_store()
    await store.delete_collection(name)


# ── Document Endpoints ───────────────────────────────────────────

@router.post("/documents", response_model=UpsertResponse, status_code=status.HTTP_201_CREATED)
async def upsert_documents(
    body: UpsertRequest,
    current_user: User = Depends(require_permission("ai:write")),
):
    """Upsert documents with auto-generated embeddings."""
    embedder = get_embedding_service()
    store = get_vector_store()

    # Generate embeddings for all documents in one batch
    texts = [doc.content for doc in body.documents]
    embeddings = await embedder.embed_texts(texts)

    vector_docs = [
        VectorDocument(
            id=doc.id,
            content=doc.content,
            embedding=emb,
            metadata=doc.metadata,
            collection=body.collection,
        )
        for doc, emb in zip(body.documents, embeddings)
    ]

    count = await store.upsert(vector_docs, collection=body.collection)
    return UpsertResponse(upserted=count, collection=body.collection)


@router.post("/search", response_model=SearchResponse)
async def search_documents(
    body: SearchRequest,
    current_user: User = Depends(require_permission("ai:read")),
):
    """Semantic similarity search across documents."""
    embedder = get_embedding_service()
    store = get_vector_store()

    query_embedding = await embedder.embed_query(body.query)
    results = await store.search(
        query_embedding=query_embedding,
        collection=body.collection,
        top_k=body.top_k,
        filter_metadata=body.filter_metadata,
    )

    return SearchResponse(
        results=[
            SearchResult(
                id=doc.id,
                content=doc.content,
                score=doc.score,
                metadata=doc.metadata,
            )
            for doc in results
        ],
        query=body.query,
        collection=body.collection,
        total=len(results),
    )


@router.post("/documents/get", response_model=list[DocumentResponse])
async def get_documents(
    body: DeleteRequest,
    current_user: User = Depends(require_permission("ai:read")),
):
    """Retrieve documents by their IDs."""
    store = get_vector_store()
    docs = await store.get(body.document_ids, collection=body.collection)
    return [
        DocumentResponse(
            id=doc.id,
            content=doc.content,
            metadata=doc.metadata,
            collection=doc.collection,
        )
        for doc in docs
    ]


@router.post("/documents/delete", response_model=DeleteResponse)
async def delete_documents(
    body: DeleteRequest,
    current_user: User = Depends(require_permission("ai:write")),
):
    """Delete documents by their IDs."""
    store = get_vector_store()
    count = await store.delete(body.document_ids, collection=body.collection)
    return DeleteResponse(deleted=count)


# ── Health ───────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def vector_health():
    """Check vector database connectivity."""
    from app.config import settings
    store = get_vector_store()
    healthy = await store.health_check()
    return HealthResponse(
        status="healthy" if healthy else "unhealthy",
        provider=settings.VECTOR_DB_PROVIDER,
    )
