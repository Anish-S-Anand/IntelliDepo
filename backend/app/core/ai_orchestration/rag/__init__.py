"""
Intelli Platform — RAG Module
Feature: AI-7.3

Public API for Retrieval-Augmented Generation.
"""
from app.core.ai_orchestration.rag.pipeline import (
    RAGPipeline,
    RAGRequest,
    RAGResponse,
    IngestRequest,
    IngestResult,
    RetrievalResult,
    get_rag_pipeline,
)
from app.core.ai_orchestration.rag.vector_store_contract import (
    BaseVectorStore,
    VectorDocument,
    get_vector_store,
    set_vector_store,
)
from app.core.ai_orchestration.rag.chunker import (
    Chunk,
    ChunkerConfig,
    ChunkStrategy,
    get_chunker,
)
from app.core.ai_orchestration.rag.embedder import (
    EmbeddingConfig,
    EmbeddingProvider,
    get_embedder,
)

__all__ = [
    "RAGPipeline",
    "RAGRequest",
    "RAGResponse",
    "IngestRequest",
    "IngestResult",
    "RetrievalResult",
    "get_rag_pipeline",
    "BaseVectorStore",
    "VectorDocument",
    "get_vector_store",
    "set_vector_store",
    "Chunk",
    "ChunkerConfig",
    "ChunkStrategy",
    "get_chunker",
    "EmbeddingConfig",
    "EmbeddingProvider",
    "get_embedder",
]
