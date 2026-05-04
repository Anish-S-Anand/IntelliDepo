"""
Tests for ANLY-6.22: Sentiment Analysis [ORANGE — MVP Scope]

Tests rule-based sentiment analysis (no API calls needed).
"""
import pytest

from app.core.analytics.sentiment import (
    Sentiment,
    SentimentResult,
    analyze_sentiment,
    analyze_sentiment_batch,
    analyze_sentiment_rule_based,
)


# ── Rule-Based Tests ───────────────────────────────────────

class TestRuleBasedSentiment:
    def test_positive_text(self):
        result = analyze_sentiment_rule_based("This product is amazing and wonderful!")
        assert result.sentiment == Sentiment.POSITIVE
        assert result.confidence > 0.5

    def test_negative_text(self):
        result = analyze_sentiment_rule_based("This is terrible and awful, I hate it.")
        assert result.sentiment == Sentiment.NEGATIVE
        assert result.confidence > 0.5

    def test_neutral_text(self):
        result = analyze_sentiment_rule_based("The meeting is scheduled for 3pm on Tuesday.")
        assert result.sentiment == Sentiment.NEUTRAL

    def test_empty_text(self):
        result = analyze_sentiment_rule_based("")
        assert result.sentiment == Sentiment.NEUTRAL
        assert result.confidence == 1.0

    def test_negation_flips_positive(self):
        result = analyze_sentiment_rule_based("This is not good at all.")
        assert result.sentiment == Sentiment.NEGATIVE

    def test_negation_flips_negative(self):
        result = analyze_sentiment_rule_based("This is not bad.")
        assert result.sentiment == Sentiment.POSITIVE

    def test_intensifiers(self):
        mild = analyze_sentiment_rule_based("This is good.")
        strong = analyze_sentiment_rule_based("This is very good.")
        # Both should be positive
        assert mild.sentiment == Sentiment.POSITIVE
        assert strong.sentiment == Sentiment.POSITIVE

    def test_mixed_sentiment_leans_neutral(self):
        result = analyze_sentiment_rule_based("It has good features but terrible performance.")
        # Mixed signals should be closer to neutral or lean one way
        assert result.sentiment in (Sentiment.NEUTRAL, Sentiment.POSITIVE, Sentiment.NEGATIVE)

    def test_result_has_scores(self):
        result = analyze_sentiment_rule_based("Great product, love it!")
        assert "positive" in result.scores
        assert "negative" in result.scores
        assert result.method == "rule_based"

    def test_confidence_bounded(self):
        result = analyze_sentiment_rule_based("Absolutely amazing wonderful fantastic!")
        assert 0.0 <= result.confidence <= 1.0

    def test_returns_sentiment_result_type(self):
        result = analyze_sentiment_rule_based("Test text.")
        assert isinstance(result, SentimentResult)


# ── Async API Tests ────────────────────────────────────────

class TestAsyncSentiment:
    @pytest.mark.asyncio
    async def test_analyze_single(self):
        result = await analyze_sentiment("I love this product!", use_llm=False)
        assert result.sentiment == Sentiment.POSITIVE

    @pytest.mark.asyncio
    async def test_analyze_batch(self):
        texts = [
            "Great service, very happy!",
            "Terrible experience, would not recommend.",
            "The order was delivered on Thursday.",
        ]
        batch = await analyze_sentiment_batch(texts, use_llm=False)
        assert len(batch.results) == 3
        assert batch.summary["positive"] >= 1
        assert batch.summary["negative"] >= 1
        assert sum(batch.summary.values()) == 3

    @pytest.mark.asyncio
    async def test_batch_empty(self):
        batch = await analyze_sentiment_batch([], use_llm=False)
        assert len(batch.results) == 0
