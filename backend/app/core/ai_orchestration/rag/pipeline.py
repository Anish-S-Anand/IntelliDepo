"""
Intelli Platform — RAG Pipeline
Feature: AI-7.3

End-to-end Retrieval-Augmented Generation pipeline:
  Ingest: document → chunk → embed → store in vector DB
  Query:  question → embed → retrieve → rerank → augment prompt → LLM → answer
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.ai_orchestration.llm_engine import get_llm_engine
from app.core.ai_orchestration.models import LLMRequest, Message, MessageRole
from app.core.ai_orchestration.rag.chunker import (
    Chunk,
    ChunkerConfig,
    get_chunker,
)
from app.core.ai_orchestration.rag.embedder import (
    EmbeddingConfig,
    get_embedder,
)
from app.core.ai_orchestration.rag.vector_store_contract import (
    VectorDocument,
    get_vector_store,
)

logger = logging.getLogger(__name__)


# ── Models ─────────────────────────────────────────────────

class IngestRequest(BaseModel):
    """Request to ingest a document into the RAG system."""
    content: str
    source_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    collection: str = "default"
    metadata: dict = Field(default_factory=dict)
    chunker_config: ChunkerConfig | None = None


class IngestResult(BaseModel):
    """Result of a document ingestion."""
    source_id: str
    collection: str
    chunks_created: int
    total_tokens_estimate: int


class RetrievalResult(BaseModel):
    """A single retrieved context for a query."""
    content: str
    source_id: str
    score: float
    metadata: dict = Field(default_factory=dict)


class RAGRequest(BaseModel):
    """Request for RAG-augmented generation."""
    query: str
    collection: str = "default"
    top_k: int = 5
    min_score: float = 0.0  # minimum similarity threshold
    filter_metadata: dict | None = None
    system_prompt: str | None = None
    model: str | None = None
    temperature: float = 0.3  # lower default for factual RAG answers
    max_tokens: int = 2048
    include_sources: bool = True


class RAGResponse(BaseModel):
    """Response from a RAG query."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    answer: str
    sources: list[RetrievalResult] = Field(default_factory=list)
    model: str = ""
    usage_tokens: int = 0
    latency_ms: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── RAG Pipeline ───────────────────────────────────────────

DEFAULT_RAG_SYSTEM_PROMPT = """You are a knowledgeable assistant. Answer the user's question based on the provided context.

Rules:
- Only use information from the provided context to answer
- If the context doesn't contain enough information, say so clearly
- Cite the relevant source when possible
- Be concise and direct

Context:
{context}"""


class RAGPipeline:
    """
    Full RAG pipeline supporting document ingestion and augmented generation.

    Integrates with:
    - AI-7.1 (LLM Engine) for generation
    - DATA-5.2 (Vector Store) for storage/retrieval (via interface contract)
    """

    def __init__(
        self,
        chunker_config: ChunkerConfig | None = None,
        embedding_config: EmbeddingConfig | None = None,
    ):
        self._chunker_config = chunker_config
        self._embedding_config = embedding_config

    # ── Ingestion ──────────────────────────────────────────

    async def ingest(self, request: IngestRequest) -> IngestResult:
        """Ingest a document: chunk → embed → store."""
        chunker = get_chunker(request.chunker_config or self._chunker_config)
        embedder = get_embedder(self._embedding_config)
        store = get_vector_store()

        # 1. Chunk the document
        chunks = chunker.chunk(
            text=request.content,
            source_id=request.source_id,
            metadata=request.metadata,
        )

        if not chunks:
            return IngestResult(
                source_id=request.source_id,
                collection=request.collection,
                chunks_created=0,
                total_tokens_estimate=0,
            )

        # 2. Embed all chunks
        texts = [c.content for c in chunks]
        embeddings = await embedder.embed(texts)

        # 3. Create vector documents and store
        vector_docs = []
        for chunk, embedding in zip(chunks, embeddings):
            meta = {**request.metadata, **chunk.metadata}
            meta["source_id"] = request.source_id
            meta["chunk_index"] = chunk.index
            meta["char_start"] = chunk.char_start
            meta["char_end"] = chunk.char_end
            vector_docs.append(VectorDocument(
                id=chunk.id,
                content=chunk.content,
                embedding=embedding,
                metadata=meta,
                collection=request.collection,
            ))

        # Ensure collection exists
        collections = await store.list_collections()
        if request.collection not in collections:
            await store.create_collection(request.collection, dimension=embedder.dimension)

        await store.upsert(vector_docs, collection=request.collection)

        total_tokens = sum(c.token_estimate for c in chunks)

        logger.info(
            "Ingested document %s: %d chunks into collection '%s'",
            request.source_id, len(chunks), request.collection,
        )

        return IngestResult(
            source_id=request.source_id,
            collection=request.collection,
            chunks_created=len(chunks),
            total_tokens_estimate=total_tokens,
        )

    # ── Retrieval ──────────────────────────────────────────

    async def retrieve(
        self,
        query: str,
        collection: str = "default",
        top_k: int = 5,
        min_score: float = 0.0,
        filter_metadata: dict | None = None,
    ) -> list[RetrievalResult]:
        """Retrieve relevant context chunks for a query."""
        embedder = get_embedder(self._embedding_config)
        store = get_vector_store()

        # Embed the query
        query_embedding = await embedder.embed_single(query)

        # Search vector store
        results = await store.search(
            query_embedding=query_embedding,
            collection=collection,
            top_k=top_k,
            filter_metadata=filter_metadata,
        )

        # Filter by minimum score and convert
        retrieved = []
        for doc in results:
            if doc.score < min_score:
                continue
            retrieved.append(RetrievalResult(
                content=doc.content,
                source_id=doc.metadata.get("source_id", doc.id),
                score=doc.score,
                metadata=doc.metadata,
            ))

        return retrieved

    # ── RAG Generation ─────────────────────────────────────

    async def query(self, request: RAGRequest) -> RAGResponse:
        """Full RAG: retrieve context → augment prompt → generate answer."""
        import time
        start = time.perf_counter()

        # 1. Retrieve relevant context
        sources = await self.retrieve(
            query=request.query,
            collection=request.collection,
            top_k=request.top_k,
            min_score=request.min_score,
            filter_metadata=request.filter_metadata,
        )

        # 2. Build augmented prompt
        context_text = self._format_context(sources)
        system_prompt = (request.system_prompt or DEFAULT_RAG_SYSTEM_PROMPT).format(
            context=context_text
        )

        # 3. Call LLM via AI-7.1 engine
        engine = get_llm_engine()
        llm_request = LLMRequest(
            messages=[
                Message(role=MessageRole.SYSTEM, content=system_prompt),
                Message(role=MessageRole.USER, content=request.query),
            ],
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        llm_response = await engine.generate(llm_request)
        latency_ms = (time.perf_counter() - start) * 1000

        return RAGResponse(
            answer=llm_response.content,
            sources=sources if request.include_sources else [],
            model=llm_response.model,
            usage_tokens=llm_response.usage.total_tokens,
            latency_ms=latency_ms,
        )

    # ── Collection Management ──────────────────────────────

    async def create_collection(self, name: str, dimension: int | None = None) -> None:
        """Create a new vector collection."""
        embedder = get_embedder(self._embedding_config)
        store = get_vector_store()
        await store.create_collection(name, dimension=dimension or embedder.dimension)

    async def delete_collection(self, name: str) -> None:
        """Delete a vector collection and all its documents."""
        store = get_vector_store()
        await store.delete_collection(name)

    async def list_collections(self) -> list[str]:
        """List all vector collections."""
        store = get_vector_store()
        return await store.list_collections()

    async def delete_documents(
        self, source_id: str, collection: str = "default"
    ) -> int:
        """Delete all chunks belonging to a source document."""
        store = get_vector_store()
        # Retrieve all docs with this source_id, then delete
        # Since we can't search by metadata directly in delete, we search first
        embedder = get_embedder(self._embedding_config)
        dummy_embedding = [0.0] * embedder.dimension
        all_docs = await store.search(
            query_embedding=dummy_embedding,
            collection=collection,
            top_k=10000,
            filter_metadata={"source_id": source_id},
        )
        if not all_docs:
            return 0
        doc_ids = [doc.id for doc in all_docs]
        return await store.delete(doc_ids, collection=collection)

    # ── Private ────────────────────────────────────────────

    @staticmethod
    def _format_context(sources: list[RetrievalResult]) -> str:
        if not sources:
            return "No relevant context found."

        parts = []
        for i, src in enumerate(sources, 1):
            source_label = src.metadata.get("title", src.source_id)
            parts.append(f"[{i}] (source: {source_label}, relevance: {src.score:.2f})\n{src.content}")

        return "\n\n---\n\n".join(parts)


# ── Singleton ──────────────────────────────────────────────

_pipeline: RAGPipeline | None = None


def get_rag_pipeline() -> RAGPipeline:
    """Get or create the singleton RAG pipeline."""
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline
