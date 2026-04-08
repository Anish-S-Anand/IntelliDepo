"""
Tests for AI-7.3: RAG Framework

Tests chunking, embedding, vector store contract, and the full RAG pipeline
using in-memory implementations (no real APIs or vector DBs needed).
"""
import pytest

from app.core.ai_orchestration.rag.chunker import (
    Chunk,
    ChunkerConfig,
    ChunkStrategy,
    RecursiveChunker,
    SentenceChunker,
    ParagraphChunker,
    get_chunker,
)
from app.core.ai_orchestration.rag.embedder import (
    EmbeddingConfig,
    EmbeddingProvider,
    LocalEmbedder,
)
from app.core.ai_orchestration.rag.vector_store_contract import (
    InMemoryVectorStore,
    VectorDocument,
)
from app.core.ai_orchestration.rag.pipeline import (
    IngestRequest,
    RAGPipeline,
    RAGRequest,
    get_rag_pipeline,
)


# ── Chunker Tests ──────────────────────────────────────────

SAMPLE_TEXT = """The quick brown fox jumps over the lazy dog. This is a simple test sentence.

Machine learning is a subset of artificial intelligence. It focuses on building systems that learn from data. Deep learning is a further subset of machine learning.

Natural language processing enables computers to understand human language. It combines computational linguistics with statistical and neural methods. NLP powers many modern applications including chatbots, translation, and search engines."""


class TestRecursiveChunker:
    def test_basic_chunking(self):
        chunker = RecursiveChunker(ChunkerConfig(chunk_size=50, chunk_overlap=10, min_chunk_size=10))
        chunks = chunker.chunk(SAMPLE_TEXT, source_id="test-doc")

        assert len(chunks) > 0
        assert all(isinstance(c, Chunk) for c in chunks)
        assert all(c.source_id == "test-doc" for c in chunks)

    def test_empty_text(self):
        chunker = RecursiveChunker()
        chunks = chunker.chunk("")
        assert chunks == []

    def test_small_text_single_chunk(self):
        chunker = RecursiveChunker(ChunkerConfig(chunk_size=1000, min_chunk_size=5))
        chunks = chunker.chunk("Hello world, this is a test.")
        assert len(chunks) == 1

    def test_metadata_preserved(self):
        chunker = RecursiveChunker(ChunkerConfig(chunk_size=50, min_chunk_size=10))
        meta = {"author": "test", "type": "doc"}
        chunks = chunker.chunk(SAMPLE_TEXT, metadata=meta)
        assert all(c.metadata == meta for c in chunks)

    def test_chunk_indices_sequential(self):
        chunker = RecursiveChunker(ChunkerConfig(chunk_size=50, min_chunk_size=10))
        chunks = chunker.chunk(SAMPLE_TEXT)
        indices = [c.index for c in chunks]
        assert indices == list(range(len(chunks)))


class TestSentenceChunker:
    def test_splits_at_sentences(self):
        chunker = SentenceChunker(ChunkerConfig(
            strategy=ChunkStrategy.SENTENCE, chunk_size=50, min_chunk_size=10
        ))
        chunks = chunker.chunk(SAMPLE_TEXT, source_id="sent-test")
        assert len(chunks) > 0
        assert all(c.source_id == "sent-test" for c in chunks)


class TestParagraphChunker:
    def test_splits_at_paragraphs(self):
        chunker = ParagraphChunker(ChunkerConfig(
            strategy=ChunkStrategy.PARAGRAPH, min_chunk_size=10
        ))
        chunks = chunker.chunk(SAMPLE_TEXT)
        # SAMPLE_TEXT has 3 paragraphs
        assert len(chunks) == 3


class TestChunkerFactory:
    def test_returns_recursive_by_default(self):
        chunker = get_chunker()
        assert isinstance(chunker, RecursiveChunker)

    def test_returns_sentence_chunker(self):
        chunker = get_chunker(ChunkerConfig(strategy=ChunkStrategy.SENTENCE))
        assert isinstance(chunker, SentenceChunker)


# ── Embedder Tests ─────────────────────────────────────────

class TestLocalEmbedder:
    @pytest.mark.asyncio
    async def test_embed_single(self):
        embedder = LocalEmbedder(EmbeddingConfig(
            provider=EmbeddingProvider.LOCAL, dimension=128
        ))
        result = await embedder.embed_single("test text")
        assert len(result) == 128
        assert all(isinstance(v, float) for v in result)

    @pytest.mark.asyncio
    async def test_embed_batch(self):
        embedder = LocalEmbedder(EmbeddingConfig(
            provider=EmbeddingProvider.LOCAL, dimension=64
        ))
        results = await embedder.embed(["text one", "text two", "text three"])
        assert len(results) == 3
        assert all(len(r) == 64 for r in results)

    @pytest.mark.asyncio
    async def test_deterministic(self):
        embedder = LocalEmbedder(EmbeddingConfig(
            provider=EmbeddingProvider.LOCAL, dimension=64
        ))
        a = await embedder.embed_single("hello world")
        b = await embedder.embed_single("hello world")
        assert a == b

    @pytest.mark.asyncio
    async def test_different_texts_different_embeddings(self):
        embedder = LocalEmbedder(EmbeddingConfig(
            provider=EmbeddingProvider.LOCAL, dimension=64
        ))
        a = await embedder.embed_single("hello world")
        b = await embedder.embed_single("goodbye world")
        assert a != b


# ── Vector Store Tests ─────────────────────────────────────

class TestInMemoryVectorStore:
    @pytest.fixture
    def store(self):
        return InMemoryVectorStore()

    @pytest.mark.asyncio
    async def test_upsert_and_get(self, store):
        docs = [
            VectorDocument(id="1", content="hello", embedding=[1.0, 0.0, 0.0]),
            VectorDocument(id="2", content="world", embedding=[0.0, 1.0, 0.0]),
        ]
        count = await store.upsert(docs)
        assert count == 2

        retrieved = await store.get(["1", "2"])
        assert len(retrieved) == 2

    @pytest.mark.asyncio
    async def test_search(self, store):
        docs = [
            VectorDocument(id="1", content="machine learning", embedding=[1.0, 0.0, 0.0]),
            VectorDocument(id="2", content="deep learning", embedding=[0.9, 0.1, 0.0]),
            VectorDocument(id="3", content="cooking recipes", embedding=[0.0, 0.0, 1.0]),
        ]
        await store.upsert(docs)

        results = await store.search(query_embedding=[1.0, 0.0, 0.0], top_k=2)
        assert len(results) == 2
        assert results[0].id == "1"  # exact match should be first
        assert results[0].score > results[1].score

    @pytest.mark.asyncio
    async def test_search_with_metadata_filter(self, store):
        docs = [
            VectorDocument(id="1", content="a", embedding=[1.0, 0.0], metadata={"type": "doc"}),
            VectorDocument(id="2", content="b", embedding=[0.9, 0.1], metadata={"type": "code"}),
        ]
        await store.upsert(docs)

        results = await store.search(
            query_embedding=[1.0, 0.0],
            filter_metadata={"type": "code"},
        )
        assert len(results) == 1
        assert results[0].id == "2"

    @pytest.mark.asyncio
    async def test_delete(self, store):
        await store.upsert([VectorDocument(id="1", content="x", embedding=[1.0])])
        count = await store.delete(["1"])
        assert count == 1
        assert await store.get(["1"]) == []

    @pytest.mark.asyncio
    async def test_collections(self, store):
        await store.create_collection("test_col")
        cols = await store.list_collections()
        assert "test_col" in cols

        await store.delete_collection("test_col")
        cols = await store.list_collections()
        assert "test_col" not in cols

    @pytest.mark.asyncio
    async def test_health_check(self, store):
        assert await store.health_check() is True


# ── Pipeline Integration Tests ─────────────────────────────

class TestRAGPipeline:
    @pytest.fixture
    def pipeline(self):
        # Reset singletons for test isolation
        import app.core.ai_orchestration.rag.pipeline as p
        import app.core.ai_orchestration.rag.vector_store_contract as vs
        import app.core.ai_orchestration.rag.embedder as emb

        p._pipeline = None
        vs._vector_store = None
        emb._embedder = None

        # Use local embedder (hash-based, no API calls)
        return RAGPipeline(
            embedding_config=EmbeddingConfig(
                provider=EmbeddingProvider.LOCAL,
                dimension=64,
            ),
        )

    @pytest.mark.asyncio
    async def test_ingest_document(self, pipeline):
        result = await pipeline.ingest(IngestRequest(
            content=SAMPLE_TEXT,
            source_id="doc-1",
            collection="test",
            metadata={"author": "tester"},
        ))

        assert result.source_id == "doc-1"
        assert result.collection == "test"
        assert result.chunks_created > 0

    @pytest.mark.asyncio
    async def test_retrieve_after_ingest(self, pipeline):
        # Text must be long enough to pass min_chunk_size (50 tokens ≈ 200 chars)
        long_text = (
            "Python is a versatile programming language that is widely used across many domains. "
            "It is commonly used for web development with frameworks like Django and Flask. "
            "Data scientists rely on Python for data analysis, machine learning, and visualization. "
            "Python is also used for automation, scripting, DevOps, and building AI applications. "
            "Its rich ecosystem of libraries makes it one of the most popular languages worldwide."
        )
        await pipeline.ingest(IngestRequest(
            content=long_text,
            source_id="python-doc",
            collection="test",
        ))

        results = await pipeline.retrieve(
            query="What is Python used for?",
            collection="test",
            top_k=3,
            min_score=-1.0,  # Accept any score (hash-based embedder has random similarity)
        )

        assert len(results) > 0
        assert all(isinstance(r.score, float) for r in results)

    @pytest.mark.asyncio
    async def test_collection_management(self, pipeline):
        await pipeline.create_collection("my_col")
        cols = await pipeline.list_collections()
        assert "my_col" in cols

        await pipeline.delete_collection("my_col")
        cols = await pipeline.list_collections()
        assert "my_col" not in cols

    @pytest.mark.asyncio
    async def test_ingest_empty_text(self, pipeline):
        result = await pipeline.ingest(IngestRequest(
            content="",
            source_id="empty",
        ))
        assert result.chunks_created == 0
