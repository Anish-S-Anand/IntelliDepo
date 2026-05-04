"""
Intelli Platform — Earnings Transcript Analysis Service
Feature: STR-API-3

NLP pipeline that processes earnings call transcripts:
1. Ingests transcript into RAG (AI-7.3) for semantic search
2. Extracts key themes, sentiment timeline, management tone
3. Caches results in DB for instant frontend retrieval
"""
from __future__ import annotations

import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_orchestration.rag import (
    IngestRequest,
    RAGPipeline,
    RAGRequest,
    get_rag_pipeline,
)
from app.core.analytics.sentiment import (
    SentimentResult,
    analyze_sentiment,
)
from app.stream.competelens.models import EarningsTranscript

logger = logging.getLogger(__name__)

COLLECTION_NAME = "earnings-transcripts"


def _split_into_sections(text: str) -> list[dict]:
    """Split transcript into logical sections for sentiment timeline."""
    paragraphs = [p.strip() for p in text.strip().split("\n\n") if p.strip()]
    sections = []
    for i, para in enumerate(paragraphs):
        if len(para) < 20:
            continue
        sections.append({
            "index": i,
            "text": para,
            "label": f"Section {i + 1}",
        })
    return sections


def _extract_metrics(text: str) -> list[dict]:
    """Extract financial metrics mentioned in the transcript."""
    metrics = []
    patterns = [
        (r"[Rr]evenue\s+(?:was\s+|of\s+)?\$?([\d,.]+)\s*(billion|million|B|M)", "Revenue"),
        (r"(?:EPS|earnings per share)\s+(?:of\s+)?\$?([\d,.]+)", "EPS"),
        (r"[Mm]argin[s]?\s+(?:of\s+|at\s+|was\s+|were\s+|expanded\s+(?:to\s+|[\d]+\s+basis.*?to\s+)?)([\d,.]+)\s*%", "Margin"),
        (r"(?:grew|growth|up)\s+([\d,.]+)\s*%", "Growth Rate"),
        (r"(?:ARR|annual recurring revenue)\s+(?:of\s+|reached\s+)?\$?([\d,.]+)\s*(billion|million|B|M)", "ARR"),
        (r"EBITDA\s+(?:margin\s+)?(?:of\s+|at\s+|was\s+)?([\d,.]+)\s*%", "EBITDA Margin"),
        (r"(?:net\s+)?(?:revenue\s+)?retention\s+(?:rate\s+)?(?:of\s+|at\s+|was\s+|remained\s+)?(?:[\w-]+\s+(?:at\s+))?([\d,.]+)\s*%", "Net Retention"),
        (r"free\s+cash\s+flow\s+(?:of\s+|was\s+)?\$?([\d,.]+)\s*(billion|million|B|M)", "Free Cash Flow"),
    ]
    for pattern, metric_name in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            value = match.group(1).replace(",", "")
            unit = match.group(2) if match.lastindex >= 2 else ""
            metrics.append({
                "metric": metric_name,
                "value": value,
                "unit": unit,
                "context": text[max(0, match.start() - 30):match.end() + 30].strip(),
            })
    return metrics


def _detect_risk_flags(text: str) -> list[dict]:
    """Detect risk-related language in the transcript."""
    risk_patterns = [
        (r"(?:challenging|difficult|tough)\s+(?:quarter|environment|market)", "Challenging conditions"),
        (r"(?:miss|missed|below)\s+(?:our\s+)?(?:guidance|expectations|consensus)", "Missed guidance"),
        (r"(?:declined?|fell|dropped|decreased)\s+[\d,.]+\s*%", "Metric decline"),
        (r"(?:headwind|pressure|concern|risk)", "Risk language"),
        (r"(?:debt|leverage)\s+(?:ratio|stands|of)\s+[\d,.]+", "Leverage concern"),
        (r"(?:suspended|cut|reduced)\s+(?:our\s+)?dividend", "Dividend action"),
        (r"(?:inventory|excess)\s+(?:levels?\s+)?(?:above|elevated)", "Inventory concerns"),
        (r"(?:slipping|delayed|elongat)", "Deal/timeline slippage"),
    ]
    flags = []
    for pattern, label in risk_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            flags.append({
                "flag": label,
                "context": text[max(0, match.start() - 40):match.end() + 40].strip(),
            })
    return flags


def _classify_management_tone(sentiment_scores: list[float]) -> str:
    """Classify overall management tone from section sentiments."""
    if not sentiment_scores:
        return "neutral"
    avg = sum(sentiment_scores) / len(sentiment_scores)
    if avg > 0.3:
        return "optimistic"
    elif avg > 0.1:
        return "cautiously optimistic"
    elif avg > -0.1:
        return "neutral"
    elif avg > -0.3:
        return "cautious"
    else:
        return "concerned"


async def analyze_transcript(
    transcript_text: str,
    company_name: str,
    ticker: str,
    fiscal_quarter: str,
    fiscal_year: int,
    db: AsyncSession,
    use_rag: bool = True,
) -> EarningsTranscript:
    """
    Full NLP analysis pipeline for an earnings transcript.

    Steps:
    1. Split into sections and run sentiment on each
    2. Extract key metrics and risk flags
    3. Ingest into RAG for semantic Q&A
    4. Cache results in DB
    """
    # 1. Sentiment timeline
    sections = _split_into_sections(transcript_text)
    sentiment_timeline = []
    sentiment_scores = []

    for section in sections:
        result: SentimentResult = await analyze_sentiment(section["text"])
        score = result.scores.get("positive", 0.5) - result.scores.get("negative", 0.5)
        sentiment_scores.append(score)
        sentiment_timeline.append({
            "section": section["label"],
            "sentiment": result.sentiment.value,
            "confidence": result.confidence,
            "score": round(score, 3),
            "preview": section["text"][:120] + "..." if len(section["text"]) > 120 else section["text"],
        })

    # 2. Overall sentiment
    overall = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0.0

    # 3. Key themes (top sections by absolute sentiment deviation)
    sorted_sections = sorted(
        zip(sections, sentiment_timeline),
        key=lambda x: abs(x[1]["score"]),
        reverse=True,
    )
    key_themes = []
    for section, timeline_entry in sorted_sections[:5]:
        key_themes.append({
            "theme": section["text"][:80].strip(),
            "sentiment": timeline_entry["sentiment"],
            "score": timeline_entry["score"],
        })

    # 4. Extract metrics and risk flags
    metrics = _extract_metrics(transcript_text)
    risk_flags = _detect_risk_flags(transcript_text)

    # 5. Management tone
    tone = _classify_management_tone(sentiment_scores)

    # 6. Summary (first 2 and last section as proxy — no LLM needed for demo)
    summary_parts = []
    if len(sections) >= 2:
        summary_parts.append(sections[0]["text"][:200])
        summary_parts.append(sections[1]["text"][:200])
    if len(sections) >= 3:
        summary_parts.append(sections[-1]["text"][:200])
    summary = " ".join(summary_parts)

    # 7. Ingest into RAG for semantic search
    collection_name = f"{COLLECTION_NAME}-{ticker.lower()}"
    if use_rag:
        try:
            pipeline = get_rag_pipeline()
            await pipeline.ingest(IngestRequest(
                content=transcript_text,
                source_id=f"{ticker}-{fiscal_quarter}-{fiscal_year}",
                collection=collection_name,
                metadata={
                    "company": company_name,
                    "ticker": ticker,
                    "quarter": fiscal_quarter,
                    "year": fiscal_year,
                },
            ))
            is_ingested = True
        except Exception as e:
            logger.warning("RAG ingestion failed for %s: %s", ticker, e)
            is_ingested = False
    else:
        is_ingested = False

    # 8. Save to DB
    transcript = EarningsTranscript(
        company_name=company_name,
        ticker=ticker,
        fiscal_quarter=fiscal_quarter,
        fiscal_year=fiscal_year,
        transcript_text=transcript_text,
        key_themes=key_themes,
        sentiment_timeline=sentiment_timeline,
        overall_sentiment=round(overall, 3),
        summary=summary,
        key_metrics_mentioned=metrics,
        management_tone=tone,
        risk_flags=risk_flags,
        is_ingested=is_ingested,
        collection_name=collection_name if is_ingested else None,
    )
    db.add(transcript)
    await db.commit()
    await db.refresh(transcript)

    logger.info(
        "Analyzed transcript: %s %s %d — %d sections, %d metrics, %d risk flags, tone=%s",
        ticker, fiscal_quarter, fiscal_year, len(sections), len(metrics), len(risk_flags), tone,
    )

    return transcript


async def query_transcript(
    ticker: str,
    question: str,
    db: AsyncSession,
) -> dict:
    """Ask a question about a company's earnings transcript using RAG."""
    # Find the transcript
    stmt = select(EarningsTranscript).where(
        EarningsTranscript.ticker == ticker,
        EarningsTranscript.is_ingested == True,  # noqa: E712
    ).order_by(EarningsTranscript.fiscal_year.desc())
    result = await db.execute(stmt)
    transcript = result.scalar_one_or_none()

    if not transcript or not transcript.collection_name:
        return {
            "answer": f"No ingested transcript found for {ticker}.",
            "sources": [],
        }

    pipeline = get_rag_pipeline()
    rag_response = await pipeline.query(RAGRequest(
        query=question,
        collection=transcript.collection_name,
        top_k=5,
        temperature=0.3,
    ))

    return {
        "answer": rag_response.answer,
        "sources": [
            {"content": s.content[:200], "score": s.score}
            for s in rag_response.sources
        ],
        "company": transcript.company_name,
        "quarter": transcript.fiscal_quarter,
        "model": rag_response.model,
    }


async def seed_sample_transcripts(db: AsyncSession) -> list[EarningsTranscript]:
    """Pre-process all sample transcripts and cache results."""
    from app.stream.competelens.sample_transcripts import SAMPLE_TRANSCRIPTS

    results = []
    for sample in SAMPLE_TRANSCRIPTS:
        # Check if already seeded
        stmt = select(EarningsTranscript).where(
            EarningsTranscript.ticker == sample["ticker"],
            EarningsTranscript.fiscal_quarter == sample["fiscal_quarter"],
        )
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            logger.info("Transcript already seeded: %s %s", sample["ticker"], sample["fiscal_quarter"])
            continue

        transcript = await analyze_transcript(
            transcript_text=sample["transcript_text"],
            company_name=sample["company_name"],
            ticker=sample["ticker"],
            fiscal_quarter=sample["fiscal_quarter"],
            fiscal_year=sample["fiscal_year"],
            db=db,
            use_rag=False,  # Skip RAG for seed — can be ingested on-demand
        )
        results.append(transcript)

    logger.info("Seeded %d sample transcripts", len(results))
    return results
