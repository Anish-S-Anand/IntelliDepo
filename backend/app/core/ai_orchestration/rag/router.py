"""
Intelli Platform — RAG API Router
Feature: AI-7.3

Endpoints for document ingestion, RAG queries, retrieval, and collection management.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.core.ai_orchestration.rag.pipeline import (
    IngestRequest,
    IngestResult,
    RAGPipeline,
    RAGRequest,
    RAGResponse,
    RetrievalResult,
    get_rag_pipeline,
)

router = APIRouter(prefix="/api/v1/rag", tags=["RAG"])


def get_pipeline() -> RAGPipeline:
    return get_rag_pipeline()


@router.post("/ingest", response_model=IngestResult)
async def ingest_document(
    request: IngestRequest,
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """Ingest a document into the RAG system (chunk → embed → store)."""
    return await pipeline.ingest(request)


@router.post("/query", response_model=RAGResponse)
async def rag_query(
    request: RAGRequest,
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """Ask a question with RAG-augmented generation."""
    try:
        return await pipeline.query(request)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/retrieve", response_model=list[RetrievalResult])
async def retrieve_context(
    request: RAGRequest,
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """Retrieve relevant context chunks without generating an answer."""
    return await pipeline.retrieve(
        query=request.query,
        collection=request.collection,
        top_k=request.top_k,
        min_score=request.min_score,
        filter_metadata=request.filter_metadata,
    )


@router.get("/collections")
async def list_collections(
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """List all vector collections."""
    collections = await pipeline.list_collections()
    return {"collections": collections}


@router.post("/collections/{name}")
async def create_collection(
    name: str,
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """Create a new vector collection."""
    await pipeline.create_collection(name)
    return {"status": "created", "collection": name}


@router.delete("/collections/{name}")
async def delete_collection(
    name: str,
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """Delete a vector collection and all its documents."""
    await pipeline.delete_collection(name)
    return {"status": "deleted", "collection": name}


@router.delete("/documents/{source_id}")
async def delete_documents(
    source_id: str,
    collection: str = "default",
    current_user: User = Depends(get_current_user),
    pipeline: RAGPipeline = Depends(get_pipeline),
):
    """Delete all chunks belonging to a source document."""
    count = await pipeline.delete_documents(source_id, collection)
    return {"status": "deleted", "source_id": source_id, "chunks_deleted": count}
