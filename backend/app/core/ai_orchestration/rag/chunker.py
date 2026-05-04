"""
Intelli Platform — Document Chunking Engine
Feature: AI-7.3

Splits documents into semantically meaningful chunks for embedding and retrieval.
Supports multiple strategies: fixed-size, sentence-based, recursive, and semantic.
"""
from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from enum import Enum

from pydantic import BaseModel, Field


class ChunkStrategy(str, Enum):
    FIXED = "fixed"
    SENTENCE = "sentence"
    RECURSIVE = "recursive"
    PARAGRAPH = "paragraph"


class Chunk(BaseModel):
    """A single chunk of text from a document."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    index: int = 0  # position in original document
    metadata: dict = Field(default_factory=dict)
    source_id: str = ""  # ID of the source document
    char_start: int = 0
    char_end: int = 0
    token_estimate: int = 0


class ChunkerConfig(BaseModel):
    strategy: ChunkStrategy = ChunkStrategy.RECURSIVE
    chunk_size: int = 512  # target tokens per chunk
    chunk_overlap: int = 50  # overlap tokens between chunks
    min_chunk_size: int = 50  # discard chunks smaller than this


class BaseChunker(ABC):
    @abstractmethod
    def chunk(self, text: str, source_id: str = "", metadata: dict | None = None) -> list[Chunk]:
        """Split text into chunks."""


class RecursiveChunker(BaseChunker):
    """
    Recursively splits text using hierarchical separators.
    Tries to split at paragraph boundaries first, then sentences,
    then words, to maintain semantic coherence.
    """

    SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "]

    def __init__(self, config: ChunkerConfig | None = None):
        self.config = config or ChunkerConfig()
        # Rough estimate: 1 token ≈ 4 characters
        self._char_limit = self.config.chunk_size * 4
        self._overlap_chars = self.config.chunk_overlap * 4
        self._min_chars = self.config.min_chunk_size * 4

    def chunk(self, text: str, source_id: str = "", metadata: dict | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        raw_chunks = self._split_recursive(text, self.SEPARATORS)

        # Merge small chunks and add overlap
        merged = self._merge_with_overlap(raw_chunks, text)

        chunks = []
        for i, (content, start, end) in enumerate(merged):
            if len(content.strip()) < self._min_chars:
                continue
            chunks.append(Chunk(
                content=content.strip(),
                index=i,
                source_id=source_id,
                metadata=metadata or {},
                char_start=start,
                char_end=end,
                token_estimate=len(content) // 4,
            ))

        return chunks

    def _split_recursive(self, text: str, separators: list[str]) -> list[str]:
        if not separators or len(text) <= self._char_limit:
            return [text]

        sep = separators[0]
        parts = text.split(sep)

        result = []
        for part in parts:
            if len(part) <= self._char_limit:
                result.append(part)
            else:
                result.extend(self._split_recursive(part, separators[1:]))

        return result

    def _merge_with_overlap(
        self, parts: list[str], original: str
    ) -> list[tuple[str, int, int]]:
        """Merge small parts up to chunk_size and add overlap between chunks."""
        if not parts:
            return []

        merged: list[tuple[str, int, int]] = []
        current = ""
        current_start = 0
        offset = 0

        for part in parts:
            if current and len(current) + len(part) > self._char_limit:
                merged.append((current, current_start, current_start + len(current)))
                # Start new chunk with overlap from end of previous
                overlap = current[-self._overlap_chars:] if self._overlap_chars else ""
                current_start = current_start + len(current) - len(overlap)
                current = overlap + part
            else:
                if not current:
                    current_start = offset
                current += part

            offset += len(part)

        if current.strip():
            merged.append((current, current_start, current_start + len(current)))

        return merged


class SentenceChunker(BaseChunker):
    """Splits text into chunks at sentence boundaries."""

    SENTENCE_PATTERN = re.compile(r'(?<=[.!?])\s+')

    def __init__(self, config: ChunkerConfig | None = None):
        self.config = config or ChunkerConfig(strategy=ChunkStrategy.SENTENCE)
        self._char_limit = self.config.chunk_size * 4
        self._overlap_chars = self.config.chunk_overlap * 4
        self._min_chars = self.config.min_chunk_size * 4

    def chunk(self, text: str, source_id: str = "", metadata: dict | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        sentences = self.SENTENCE_PATTERN.split(text)
        chunks = []
        current = ""
        current_start = 0
        offset = 0
        idx = 0

        for sentence in sentences:
            if current and len(current) + len(sentence) > self._char_limit:
                if len(current.strip()) >= self._min_chars:
                    chunks.append(Chunk(
                        content=current.strip(),
                        index=idx,
                        source_id=source_id,
                        metadata=metadata or {},
                        char_start=current_start,
                        char_end=current_start + len(current),
                        token_estimate=len(current) // 4,
                    ))
                    idx += 1
                current = current[-self._overlap_chars:] if self._overlap_chars else ""
                current_start = offset - len(current)

            if not current:
                current_start = offset
            current += sentence + " "
            offset += len(sentence) + 1

        if current.strip() and len(current.strip()) >= self._min_chars:
            chunks.append(Chunk(
                content=current.strip(),
                index=idx,
                source_id=source_id,
                metadata=metadata or {},
                char_start=current_start,
                char_end=current_start + len(current),
                token_estimate=len(current) // 4,
            ))

        return chunks


class ParagraphChunker(BaseChunker):
    """Splits text at paragraph boundaries (double newlines)."""

    def __init__(self, config: ChunkerConfig | None = None):
        self.config = config or ChunkerConfig(strategy=ChunkStrategy.PARAGRAPH)
        self._min_chars = self.config.min_chunk_size * 4

    def chunk(self, text: str, source_id: str = "", metadata: dict | None = None) -> list[Chunk]:
        if not text.strip():
            return []

        paragraphs = re.split(r'\n\s*\n', text)
        chunks = []
        offset = 0

        for i, para in enumerate(paragraphs):
            para = para.strip()
            if len(para) < self._min_chars:
                offset += len(para) + 2
                continue
            chunks.append(Chunk(
                content=para,
                index=i,
                source_id=source_id,
                metadata=metadata or {},
                char_start=offset,
                char_end=offset + len(para),
                token_estimate=len(para) // 4,
            ))
            offset += len(para) + 2

        return chunks


def get_chunker(config: ChunkerConfig | None = None) -> BaseChunker:
    """Factory for chunkers."""
    config = config or ChunkerConfig()
    match config.strategy:
        case ChunkStrategy.RECURSIVE:
            return RecursiveChunker(config)
        case ChunkStrategy.SENTENCE:
            return SentenceChunker(config)
        case ChunkStrategy.PARAGRAPH:
            return ParagraphChunker(config)
        case _:
            return RecursiveChunker(config)
