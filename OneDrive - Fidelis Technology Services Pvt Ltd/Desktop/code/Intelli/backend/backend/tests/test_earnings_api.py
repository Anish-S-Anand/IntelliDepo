"""
Tests for STR-API-3: Earnings Transcript Backend

Tests the NLP analysis pipeline (metrics extraction, risk flags, sentiment,
management tone) and the API endpoints using mock data.
"""
import pytest

from app.stream.competelens.earnings_service import (
    _split_into_sections,
    _extract_metrics,
    _detect_risk_flags,
    _classify_management_tone,
)
from app.stream.competelens.sample_transcripts import SAMPLE_TRANSCRIPTS


# ── Unit Tests: NLP Helpers ────────────────────────────────


class TestSplitIntoSections:
    def test_splits_by_double_newline(self):
        text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here."
        sections = _split_into_sections(text)
        assert len(sections) == 3
        assert sections[0]["text"] == "First paragraph here."

    def test_skips_short_sections(self):
        text = "Good morning.\n\nThis is a real paragraph with enough content to keep.\n\nOk."
        sections = _split_into_sections(text)
        # "Good morning." and "Ok." are < 20 chars, should be skipped
        assert len(sections) == 1

    def test_empty_text(self):
        assert _split_into_sections("") == []


class TestExtractMetrics:
    def test_extracts_revenue(self):
        text = "Revenue was $1.15 billion, up 23% year-over-year."
        metrics = _extract_metrics(text)
        metric_names = [m["metric"] for m in metrics]
        assert "Revenue" in metric_names
        assert "Growth Rate" in metric_names

    def test_extracts_eps(self):
        text = "We achieved non-GAAP EPS of $1.42, beating consensus."
        metrics = _extract_metrics(text)
        assert any(m["metric"] == "EPS" for m in metrics)

    def test_extracts_margin(self):
        text = "Gross margins expanded to 62%, reflecting improved scale."
        metrics = _extract_metrics(text)
        assert any(m["metric"] == "Margin" for m in metrics)

    def test_extracts_arr(self):
        text = "Annual recurring revenue reached $3.8 billion."
        metrics = _extract_metrics(text)
        assert any(m["metric"] == "ARR" for m in metrics)

    def test_extracts_retention(self):
        text = "Net revenue retention remained best-in-class at 135%."
        metrics = _extract_metrics(text)
        assert any(m["metric"] == "Net Retention" for m in metrics)

    def test_no_metrics(self):
        text = "The weather was nice today."
        metrics = _extract_metrics(text)
        assert metrics == []


class TestDetectRiskFlags:
    def test_detects_challenging_conditions(self):
        text = "This was a challenging quarter for our business."
        flags = _detect_risk_flags(text)
        assert len(flags) >= 1
        assert any("Challenging" in f["flag"] for f in flags)

    def test_detects_missed_guidance(self):
        text = "Revenue was below our guidance of $800 million."
        flags = _detect_risk_flags(text)
        assert any("Missed" in f["flag"] for f in flags)

    def test_detects_decline(self):
        text = "Same-store sales declined 4.2% in the quarter."
        flags = _detect_risk_flags(text)
        assert any("decline" in f["flag"].lower() for f in flags)

    def test_detects_dividend_suspension(self):
        text = "We have suspended our dividend to prioritize debt reduction."
        flags = _detect_risk_flags(text)
        assert any("Dividend" in f["flag"] for f in flags)

    def test_detects_deal_slippage(self):
        text = "Two large deals slipping into next quarter."
        flags = _detect_risk_flags(text)
        assert any("slippage" in f["flag"].lower() for f in flags)

    def test_no_flags_in_positive_text(self):
        text = "We delivered excellent results with strong momentum."
        flags = _detect_risk_flags(text)
        assert flags == []


class TestManagementTone:
    def test_optimistic(self):
        assert _classify_management_tone([0.5, 0.4, 0.3, 0.6]) == "optimistic"

    def test_cautiously_optimistic(self):
        assert _classify_management_tone([0.2, 0.15, 0.1, 0.2]) == "cautiously optimistic"

    def test_neutral(self):
        assert _classify_management_tone([0.05, -0.05, 0.0]) == "neutral"

    def test_cautious(self):
        assert _classify_management_tone([-0.2, -0.15, -0.1]) == "cautious"

    def test_concerned(self):
        assert _classify_management_tone([-0.5, -0.4, -0.3]) == "concerned"

    def test_empty(self):
        assert _classify_management_tone([]) == "neutral"


# ── Sample Data Tests ──────────────────────────────────────


class TestSampleTranscripts:
    def test_has_five_transcripts(self):
        assert len(SAMPLE_TRANSCRIPTS) == 5

    def test_all_have_required_fields(self):
        for t in SAMPLE_TRANSCRIPTS:
            assert "company_name" in t
            assert "ticker" in t
            assert "fiscal_quarter" in t
            assert "fiscal_year" in t
            assert "transcript_text" in t
            assert len(t["transcript_text"]) > 100

    def test_unique_tickers(self):
        tickers = [t["ticker"] for t in SAMPLE_TRANSCRIPTS]
        assert len(tickers) == len(set(tickers))

    def test_metrics_extractable_from_samples(self):
        """Every sample transcript should yield at least some metrics."""
        for t in SAMPLE_TRANSCRIPTS:
            metrics = _extract_metrics(t["transcript_text"])
            assert len(metrics) > 0, f"No metrics found in {t['ticker']}"

    def test_sections_extractable_from_samples(self):
        """Every transcript should split into multiple sections."""
        for t in SAMPLE_TRANSCRIPTS:
            sections = _split_into_sections(t["transcript_text"])
            assert len(sections) >= 3, f"Too few sections in {t['ticker']}"


# ── Integration: Full Pipeline on Sample ───────────────────


class TestRetailMaxRiskFlags:
    """RetailMax should have the most risk flags (struggling retailer)."""

    def test_retailmax_has_risk_flags(self):
        rmax = next(t for t in SAMPLE_TRANSCRIPTS if t["ticker"] == "RMAX")
        flags = _detect_risk_flags(rmax["transcript_text"])
        assert len(flags) >= 3, f"Expected 3+ risk flags for RMAX, got {len(flags)}"

    def test_cloudsync_has_few_risk_flags(self):
        csyn = next(t for t in SAMPLE_TRANSCRIPTS if t["ticker"] == "CSYN")
        flags = _detect_risk_flags(csyn["transcript_text"])
        # CloudSync is doing great, shouldn't have many flags
        assert len(flags) <= 2
