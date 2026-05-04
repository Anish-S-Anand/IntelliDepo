"""
Intelli Platform — Sentiment Analysis Engine
Feature: ANLY-6.22 [ORANGE — MVP Scope]

MVP Scope: English-only, basic positive/negative/neutral classification.
Full version (post-MVP): multi-language, context-aware, trend tracking, scoring.

Supports two backends:
  1. LLM-based (via AI-7.1) — more accurate, uses API credits
  2. Rule-based (keyword scoring) — free, offline, fast
"""
from __future__ import annotations

import logging
import re
from enum import Enum

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ── Models ─────────────────────────────────────────────────

class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class SentimentResult(BaseModel):
    """Result of sentiment analysis on a single text."""
    text: str
    sentiment: Sentiment
    confidence: float = Field(ge=0.0, le=1.0)
    scores: dict[str, float] = Field(default_factory=dict)
    method: str = "rule_based"  # "rule_based" or "llm"


class BatchSentimentResult(BaseModel):
    """Result of sentiment analysis on multiple texts."""
    results: list[SentimentResult]
    summary: dict[str, int] = Field(default_factory=dict)


# ── Rule-Based Analyzer ───────────────────────────────────

# Curated word lists for basic sentiment detection
_POSITIVE_WORDS = frozenset({
    "good", "great", "excellent", "amazing", "wonderful", "fantastic", "awesome",
    "love", "loved", "loving", "like", "liked", "enjoy", "enjoyed", "enjoying",
    "happy", "glad", "pleased", "satisfied", "delighted", "thrilled", "excited",
    "beautiful", "perfect", "best", "better", "impressive", "outstanding",
    "brilliant", "superb", "remarkable", "exceptional", "magnificent",
    "helpful", "useful", "valuable", "efficient", "effective", "reliable",
    "fast", "quick", "smooth", "easy", "simple", "clear", "clean",
    "recommend", "recommended", "praise", "praised", "thank", "thanks",
    "success", "successful", "win", "won", "achieve", "achieved",
    "improve", "improved", "improvement", "progress", "growth",
    "strong", "strength", "advantage", "benefit", "positive", "optimistic",
    "profit", "profitable", "gain", "gains", "increase", "increased",
})

_NEGATIVE_WORDS = frozenset({
    "bad", "terrible", "horrible", "awful", "worst", "worse", "poor",
    "hate", "hated", "hating", "dislike", "disliked", "despise",
    "angry", "annoyed", "frustrated", "disappointed", "unhappy", "upset",
    "sad", "depressed", "miserable", "painful", "suffering",
    "ugly", "broken", "failed", "failure", "failing", "error", "bug",
    "slow", "difficult", "hard", "complicated", "confusing", "unclear",
    "useless", "worthless", "waste", "wasted", "wasteful",
    "problem", "issue", "trouble", "concern", "risk", "threat", "danger",
    "loss", "losses", "decline", "declined", "decrease", "decreased", "drop",
    "weak", "weakness", "disadvantage", "negative", "pessimistic",
    "damage", "damaged", "harm", "harmful", "destroy", "destroyed",
    "reject", "rejected", "deny", "denied", "refuse", "refused",
    "complaint", "complain", "criticized", "criticism", "blame",
    "delay", "delayed", "late", "overdue", "miss", "missed", "missing",
})

_NEGATORS = frozenset({
    "not", "no", "never", "neither", "nor", "don't", "doesn't", "didn't",
    "won't", "wouldn't", "couldn't", "shouldn't", "isn't", "aren't",
    "wasn't", "weren't", "hasn't", "haven't", "hadn't", "cannot",
})

_INTENSIFIERS = frozenset({
    "very", "really", "extremely", "incredibly", "absolutely", "completely",
    "totally", "highly", "deeply", "strongly", "particularly", "especially",
})


def _tokenize(text: str) -> list[str]:
    """Simple whitespace + punctuation tokenizer."""
    return re.findall(r"[a-z']+", text.lower())


def analyze_sentiment_rule_based(text: str) -> SentimentResult:
    """
    Analyze sentiment using keyword scoring with negation handling.
    Returns positive/negative/neutral with a confidence score.
    """
    tokens = _tokenize(text)
    if not tokens:
        return SentimentResult(
            text=text,
            sentiment=Sentiment.NEUTRAL,
            confidence=1.0,
            scores={"positive": 0.0, "negative": 0.0, "neutral": 1.0},
            method="rule_based",
        )

    pos_score = 0.0
    neg_score = 0.0
    is_negated = False
    intensifier = 1.0

    for i, token in enumerate(tokens):
        # Check for negation
        if token in _NEGATORS:
            is_negated = True
            continue

        # Check for intensifiers
        if token in _INTENSIFIERS:
            intensifier = 1.5
            continue

        weight = 1.0 * intensifier

        if token in _POSITIVE_WORDS:
            if is_negated:
                neg_score += weight
            else:
                pos_score += weight
        elif token in _NEGATIVE_WORDS:
            if is_negated:
                pos_score += weight
            else:
                neg_score += weight

        # Reset modifiers after applying to a sentiment word
        if token in _POSITIVE_WORDS or token in _NEGATIVE_WORDS:
            is_negated = False
            intensifier = 1.0

    total = pos_score + neg_score
    if total == 0:
        return SentimentResult(
            text=text,
            sentiment=Sentiment.NEUTRAL,
            confidence=0.5,
            scores={"positive": 0.0, "negative": 0.0, "neutral": 1.0},
            method="rule_based",
        )

    pos_ratio = pos_score / total
    neg_ratio = neg_score / total

    # Determine sentiment with thresholds
    if pos_ratio > 0.6:
        sentiment = Sentiment.POSITIVE
        confidence = min(pos_ratio, 0.95)
    elif neg_ratio > 0.6:
        sentiment = Sentiment.NEGATIVE
        confidence = min(neg_ratio, 0.95)
    else:
        sentiment = Sentiment.NEUTRAL
        confidence = 1.0 - abs(pos_ratio - neg_ratio)

    return SentimentResult(
        text=text,
        sentiment=sentiment,
        confidence=round(confidence, 3),
        scores={
            "positive": round(pos_ratio, 3),
            "negative": round(neg_ratio, 3),
            "neutral": round(1.0 - max(pos_ratio, neg_ratio), 3),
        },
        method="rule_based",
    )


# ── LLM-Based Analyzer ────────────────────────────────────

async def analyze_sentiment_llm(text: str) -> SentimentResult:
    """
    Analyze sentiment using the LLM engine (AI-7.1).
    More accurate but uses API credits.
    """
    from app.core.ai_orchestration.llm_engine import get_llm_engine
    from app.core.ai_orchestration.models import LLMRequest, Message, MessageRole

    engine = get_llm_engine()

    prompt = f"""Classify the sentiment of the following text as exactly one of: positive, negative, or neutral.

Also provide a confidence score between 0.0 and 1.0.

Respond in exactly this format (no other text):
sentiment: <positive|negative|neutral>
confidence: <0.0-1.0>

Text: {text}"""

    request = LLMRequest(
        messages=[
            Message(role=MessageRole.SYSTEM, content="You are a sentiment analysis classifier. Respond only in the exact format requested."),
            Message(role=MessageRole.USER, content=prompt),
        ],
        temperature=0.0,
        max_tokens=50,
    )

    try:
        response = await engine.generate(request)
        content = response.content.strip().lower()

        # Parse response
        sentiment = Sentiment.NEUTRAL
        confidence = 0.5

        for line in content.split("\n"):
            line = line.strip()
            if line.startswith("sentiment:"):
                val = line.split(":", 1)[1].strip()
                if val in ("positive", "negative", "neutral"):
                    sentiment = Sentiment(val)
            elif line.startswith("confidence:"):
                try:
                    confidence = float(line.split(":", 1)[1].strip())
                    confidence = max(0.0, min(1.0, confidence))
                except ValueError:
                    confidence = 0.5

        return SentimentResult(
            text=text,
            sentiment=sentiment,
            confidence=round(confidence, 3),
            scores={sentiment.value: confidence},
            method="llm",
        )

    except Exception as e:
        logger.warning("LLM sentiment analysis failed, falling back to rule-based: %s", e)
        return analyze_sentiment_rule_based(text)


# ── Public API ─────────────────────────────────────────────

async def analyze_sentiment(
    text: str,
    use_llm: bool = False,
) -> SentimentResult:
    """
    Analyze sentiment of a single text.

    Args:
        text: The text to analyze.
        use_llm: If True, use AI-7.1 LLM engine (more accurate, costs tokens).
                 If False, use rule-based analysis (free, fast).
    """
    if use_llm:
        return await analyze_sentiment_llm(text)
    return analyze_sentiment_rule_based(text)


async def analyze_sentiment_batch(
    texts: list[str],
    use_llm: bool = False,
) -> BatchSentimentResult:
    """
    Analyze sentiment of multiple texts.
    Returns individual results plus a summary count.
    """
    results = []
    for text in texts:
        result = await analyze_sentiment(text, use_llm=use_llm)
        results.append(result)

    summary = {"positive": 0, "negative": 0, "neutral": 0}
    for r in results:
        summary[r.sentiment.value] += 1

    return BatchSentimentResult(results=results, summary=summary)
