"""
Tests for AI-7.5: Explainability Engine (XAI)

Tests cover:
- Confidence scoring and level classification
- Heuristic explanation generation
- Source citation scoring
- Audit trail logging, querying, and flagging
- Cache management
- LLM-based explanation parsing
"""
import pytest

from app.core.ai_orchestration.explainability import ExplainabilityEngine
from app.core.ai_orchestration.explainability_models import (
    BiasCheckResult,
    ConfidenceLevel,
    ConfidenceScore,
    DecisionFactor,
    ExplanationRequest,
    ExplanationResult,
    ExplanationType,
    ReasoningStep,
    SourceCitation,
)


@pytest.fixture
def engine():
    """Create a fresh ExplainabilityEngine with no LLM (heuristic-only)."""
    return ExplainabilityEngine(llm_engine=None)


@pytest.fixture
def sample_request():
    return ExplanationRequest(
        response_id="resp-001",
        response_content="The quarterly revenue increased by 12% due to strong retail performance.",
        prompt="Analyze the quarterly financial performance.",
        sources=[
            SourceCitation(
                title="Q3 Financial Report",
                content_snippet="Revenue grew 12% YoY driven by retail expansion in MENA.",
                source_type="document",
                relevance_score=0.9,
            ),
        ],
        explanation_types=[
            ExplanationType.REASONING_TRACE,
            ExplanationType.CONFIDENCE_BREAKDOWN,
        ],
    )


# ── Confidence Level Classification ───────────────────────


class TestConfidenceLevel:
    def test_high_confidence(self):
        assert ExplainabilityEngine._confidence_to_level(0.85) == ConfidenceLevel.HIGH
        assert ExplainabilityEngine._confidence_to_level(0.80) == ConfidenceLevel.HIGH
        assert ExplainabilityEngine._confidence_to_level(1.0) == ConfidenceLevel.HIGH

    def test_medium_confidence(self):
        assert ExplainabilityEngine._confidence_to_level(0.5) == ConfidenceLevel.MEDIUM
        assert ExplainabilityEngine._confidence_to_level(0.79) == ConfidenceLevel.MEDIUM

    def test_low_confidence(self):
        assert ExplainabilityEngine._confidence_to_level(0.3) == ConfidenceLevel.LOW
        assert ExplainabilityEngine._confidence_to_level(0.49) == ConfidenceLevel.LOW

    def test_very_low_confidence(self):
        assert ExplainabilityEngine._confidence_to_level(0.0) == ConfidenceLevel.VERY_LOW
        assert ExplainabilityEngine._confidence_to_level(0.29) == ConfidenceLevel.VERY_LOW


# ── Heuristic Explanation ─────────────────────────────────


class TestHeuristicExplanation:
    def test_generates_reasoning_steps(self, engine, sample_request):
        explanation = ExplanationResult(
            response_id=sample_request.response_id,
            confidence=ConfidenceScore(),
        )
        engine._generate_heuristic_explanation(sample_request, explanation)

        assert len(explanation.reasoning_steps) >= 2
        assert explanation.reasoning_steps[0].step_number == 1

    def test_confidence_with_sources(self, engine, sample_request):
        explanation = ExplanationResult(
            response_id=sample_request.response_id,
            confidence=ConfidenceScore(),
        )
        engine._generate_heuristic_explanation(sample_request, explanation)

        # With sources, source_quality should be 0.7
        assert explanation.confidence.factors["source_quality"] == 0.7
        assert explanation.confidence.overall > 0.0

    def test_confidence_without_sources(self, engine):
        request = ExplanationRequest(
            response_id="resp-no-src",
            response_content="Short answer.",
            prompt="Question?",
            sources=[],
        )
        explanation = ExplanationResult(
            response_id=request.response_id,
            confidence=ConfidenceScore(),
        )
        engine._generate_heuristic_explanation(request, explanation)

        # Without sources, source_quality should be 0.3
        assert explanation.confidence.factors["source_quality"] == 0.3


# ── Source Scoring ────────────────────────────────────────


class TestSourceScoring:
    def test_scores_unscored_sources(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(),
            sources=[
                SourceCitation(
                    title="Test",
                    content_snippet="A" * 200,
                    relevance_score=0.0,
                ),
            ],
        )
        engine._score_sources(explanation)
        assert explanation.sources[0].relevance_score == 1.0

    def test_preserves_prescored_sources(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(),
            sources=[
                SourceCitation(
                    title="Test",
                    content_snippet="Short",
                    relevance_score=0.95,
                ),
            ],
        )
        engine._score_sources(explanation)
        assert explanation.sources[0].relevance_score == 0.95


# ── Confidence Recomputation ──────────────────────────────


class TestConfidenceComputation:
    def test_adjusts_for_sources(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(
                overall=0.5,
                factors={"source_quality": 0.5, "model_certainty": 0.7},
            ),
            sources=[
                SourceCitation(
                    title="A", content_snippet="...", relevance_score=0.9
                ),
            ],
        )
        engine._compute_confidence(explanation)
        assert explanation.confidence.factors["source_quality"] == 0.9

    def test_adjusts_for_bias_checks(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(
                overall=0.8,
                factors={"model_certainty": 0.8},
            ),
            bias_checks=[
                BiasCheckResult(check_name="test", passed=False, severity="medium"),
            ],
        )
        engine._compute_confidence(explanation)
        assert "bias_free" in explanation.confidence.factors
        assert explanation.confidence.factors["bias_free"] == 0.0


# ── Audit Trail ───────────────────────────────────────────


class TestAuditTrail:
    def test_log_decision(self, engine):
        explanation = ExplanationResult(
            response_id="resp-audit",
            confidence=ConfidenceScore(overall=0.75, level=ConfidenceLevel.MEDIUM),
            model_used="gpt-4o",
        )
        entry = engine.log_decision(
            user_id="user-1",
            response_id="resp-audit",
            explanation=explanation,
            prompt_summary="Test prompt",
            response_summary="Test response",
        )
        assert entry.user_id == "user-1"
        assert entry.confidence_score == 0.75
        assert entry.confidence_level == ConfidenceLevel.MEDIUM
        assert not entry.flagged

    def test_flag_decision(self, engine):
        explanation = ExplanationResult(
            response_id="resp-flag",
            confidence=ConfidenceScore(overall=0.3, level=ConfidenceLevel.LOW),
        )
        entry = engine.log_decision(
            user_id="user-1",
            response_id="resp-flag",
            explanation=explanation,
            prompt_summary="...",
            response_summary="...",
        )

        flagged = engine.flag_decision(entry.id, "Suspicious low confidence")
        assert flagged is not None
        assert flagged.flagged is True
        assert flagged.flag_reason == "Suspicious low confidence"

    def test_flag_nonexistent_returns_none(self, engine):
        assert engine.flag_decision("nonexistent", "reason") is None

    def test_query_audit_log(self, engine):
        for i in range(5):
            explanation = ExplanationResult(
                response_id=f"resp-{i}",
                confidence=ConfidenceScore(overall=0.5, level=ConfidenceLevel.MEDIUM),
            )
            engine.log_decision(
                user_id="user-1" if i < 3 else "user-2",
                response_id=f"resp-{i}",
                explanation=explanation,
                prompt_summary="...",
                response_summary="...",
            )

        all_entries = engine.get_audit_log()
        assert len(all_entries) == 5

        user1_entries = engine.get_audit_log(user_id="user-1")
        assert len(user1_entries) == 3

    def test_query_flagged_only(self, engine):
        for i in range(3):
            explanation = ExplanationResult(
                response_id=f"resp-{i}",
                confidence=ConfidenceScore(overall=0.5, level=ConfidenceLevel.MEDIUM),
            )
            entry = engine.log_decision(
                user_id="user-1",
                response_id=f"resp-{i}",
                explanation=explanation,
                prompt_summary="...",
                response_summary="...",
            )
            if i == 1:
                engine.flag_decision(entry.id, "flag reason")

        flagged = engine.get_audit_log(flagged_only=True)
        assert len(flagged) == 1

    def test_audit_stats(self, engine):
        for i in range(4):
            explanation = ExplanationResult(
                response_id=f"resp-{i}",
                confidence=ConfidenceScore(
                    overall=0.2 * (i + 1),
                    level=ExplainabilityEngine._confidence_to_level(0.2 * (i + 1)),
                ),
            )
            entry = engine.log_decision(
                user_id="user-1",
                response_id=f"resp-{i}",
                explanation=explanation,
                prompt_summary="...",
                response_summary="...",
            )
            if i == 0:
                engine.flag_decision(entry.id, "low confidence")

        stats = engine.get_audit_stats()
        assert stats["total_decisions"] == 4
        assert stats["flagged_decisions"] == 1
        assert stats["avg_confidence"] > 0

    def test_empty_audit_stats(self, engine):
        stats = engine.get_audit_stats()
        assert stats["total_decisions"] == 0


# ── Cache Management ──────────────────────────────────────


class TestCacheManagement:
    def test_get_cached_explanation(self, engine):
        import time
        explanation = ExplanationResult(
            response_id="cached-1",
            confidence=ConfidenceScore(overall=0.8),
        )
        engine._explanation_cache["cached-1"] = (time.monotonic(), explanation)

        result = engine.get_cached_explanation("cached-1")
        assert result is not None
        assert result.response_id == "cached-1"

    def test_cache_miss_returns_none(self, engine):
        assert engine.get_cached_explanation("nonexistent") is None

    def test_clear_cache(self, engine):
        import time
        engine._explanation_cache["a"] = (time.monotonic(), ExplanationResult(
            response_id="a", confidence=ConfidenceScore()
        ))
        engine._explanation_cache["b"] = (time.monotonic(), ExplanationResult(
            response_id="b", confidence=ConfidenceScore()
        ))

        count = engine.clear_cache()
        assert count == 2
        assert engine.get_cached_explanation("a") is None


# ── JSON Parsing ──────────────────────────────────────────


class TestJSONParsing:
    def test_parse_valid_json(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(),
        )
        json_content = '''{
            "reasoning_steps": [
                {"step_number": 1, "description": "Analyzed data", "evidence": "From report", "confidence": 0.9}
            ],
            "confidence": {
                "overall": 0.85,
                "factors": {"source_quality": 0.9, "model_certainty": 0.8}
            },
            "decision_factors": [
                {"factor_name": "Revenue data", "weight": 0.7, "value": "12% growth", "impact": "positive"}
            ],
            "bias_checks": [
                {"check_name": "Confirmation bias", "passed": true, "details": "No issues", "severity": "none"}
            ],
            "summary": "Response is well-supported by financial data."
        }'''

        engine._parse_explanation_response(json_content, explanation)

        assert len(explanation.reasoning_steps) == 1
        assert explanation.reasoning_steps[0].confidence == 0.9
        assert explanation.confidence.overall == 0.85
        assert len(explanation.decision_factors) == 1
        assert explanation.decision_factors[0].impact == "positive"
        assert len(explanation.bias_checks) == 1
        assert explanation.bias_checks[0].passed is True
        assert "well-supported" in explanation.summary

    def test_parse_json_in_code_block(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(),
        )
        content = '```json\n{"reasoning_steps": [], "confidence": {"overall": 0.7, "factors": {}}, "decision_factors": [], "bias_checks": [], "summary": "Test"}\n```'

        engine._parse_explanation_response(content, explanation)
        assert explanation.confidence.overall == 0.7

    def test_parse_invalid_json_does_not_crash(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(),
        )
        engine._parse_explanation_response("not valid json", explanation)
        # Should not raise, just log warning
        assert len(explanation.reasoning_steps) == 0

    def test_clamps_confidence_values(self, engine):
        explanation = ExplanationResult(
            response_id="test",
            confidence=ConfidenceScore(),
        )
        json_content = '{"reasoning_steps": [{"step_number": 1, "description": "test", "confidence": 5.0}], "confidence": {"overall": -0.5, "factors": {}}, "decision_factors": [], "bias_checks": [], "summary": ""}'

        engine._parse_explanation_response(json_content, explanation)
        assert explanation.reasoning_steps[0].confidence == 1.0
        assert explanation.confidence.overall == 0.0


# ── Model Validation ──────────────────────────────────────


class TestModels:
    def test_source_citation_defaults(self):
        src = SourceCitation(title="Test", content_snippet="Content")
        assert src.source_type == "document"
        assert src.relevance_score == 0.0

    def test_reasoning_step_defaults(self):
        step = ReasoningStep(step_number=1, description="Step 1")
        assert step.evidence == ""
        assert step.confidence == 0.0

    def test_decision_factor_defaults(self):
        factor = DecisionFactor(factor_name="Test", value="val")
        assert factor.weight == 0.0
        assert factor.impact == "neutral"

    def test_explanation_request_defaults(self):
        req = ExplanationRequest(
            response_id="r1",
            response_content="content",
            prompt="prompt",
        )
        assert len(req.explanation_types) == 2
        assert ExplanationType.REASONING_TRACE in req.explanation_types
