"""
Intelli Platform — Explainability Engine (XAI)
Feature: AI-7.5

Transparent AI reasoning, decision audit trails, confidence scoring,
source citation, and bias detection for all AI-generated outputs.

Dependencies: AI-7.1 (LLM Orchestration Engine) — BUILT
"""
from __future__ import annotations

import logging
import time
from collections import OrderedDict
from datetime import datetime, timezone

from app.core.ai_orchestration.explainability_models import (
    BiasCheckResult,
    ConfidenceLevel,
    ConfidenceScore,
    DecisionFactor,
    ExplanationAuditEntry,
    ExplanationRequest,
    ExplanationResult,
    ExplanationType,
    ReasoningStep,
    SourceCitation,
)
from app.core.ai_orchestration.llm_engine import LLMEngine, get_llm_engine
from app.core.ai_orchestration.models import LLMRequest, Message, MessageRole

logger = logging.getLogger(__name__)

# Confidence thresholds
CONFIDENCE_THRESHOLDS = {
    ConfidenceLevel.HIGH: 0.8,
    ConfidenceLevel.MEDIUM: 0.5,
    ConfidenceLevel.LOW: 0.3,
}

# System prompt for the explainability meta-agent
XAI_SYSTEM_PROMPT = """You are an AI Explainability Engine. Your job is to analyze an AI-generated response and produce a structured explanation.

Given the original prompt and the AI's response, you must:

1. REASONING TRACE: Break down the logical steps the AI likely followed to arrive at its answer. Each step should have a description and confidence level (0.0-1.0).

2. CONFIDENCE ASSESSMENT: Rate the overall confidence of the response on a scale of 0.0-1.0, considering:
   - source_quality: How well-supported is the response by available data?
   - model_certainty: How definitive vs hedging is the language?
   - data_coverage: How completely does the response address the prompt?
   - consistency: Does the response contradict itself?

3. DECISION FACTORS: Identify the key factors that influenced the response and their relative importance.

4. BIAS CHECK: Flag any potential biases (confirmation bias, anchoring, recency bias, etc.).

Respond in this exact JSON format:
{
  "reasoning_steps": [
    {"step_number": 1, "description": "...", "evidence": "...", "confidence": 0.0}
  ],
  "confidence": {
    "overall": 0.0,
    "factors": {"source_quality": 0.0, "model_certainty": 0.0, "data_coverage": 0.0, "consistency": 0.0}
  },
  "decision_factors": [
    {"factor_name": "...", "weight": 0.0, "value": "...", "impact": "positive|negative|neutral"}
  ],
  "bias_checks": [
    {"check_name": "...", "passed": true, "details": "...", "severity": "none|low|medium|high"}
  ],
  "summary": "A 1-2 sentence plain-English explanation of why the AI gave this response."
}"""


class ExplainabilityEngine:
    """
    Core engine for generating transparent explanations of AI decisions.

    Features:
    - Reasoning trace decomposition
    - Multi-factor confidence scoring
    - Source citation tracking
    - Bias detection
    - Decision audit trails
    """

    CACHE_MAX_SIZE: int = 500
    CACHE_TTL_SECONDS: float = 3600.0  # 1 hour

    def __init__(self, llm_engine: LLMEngine | None = None):
        self._engine = llm_engine or get_llm_engine()
        self._audit_log: list[ExplanationAuditEntry] = []
        self._explanation_cache: OrderedDict[str, tuple[float, ExplanationResult]] = OrderedDict()

    # ── Core Explanation ───────────────────────────────────

    async def explain(self, request: ExplanationRequest) -> ExplanationResult:
        """
        Generate a full explanation for an AI response.

        Calls the LLM meta-agent to analyze the original prompt/response
        pair and produces structured reasoning, confidence, and bias data.
        """
        start = time.monotonic()

        # Check cache (with TTL)
        cached = self._get_from_cache(request.response_id)
        if cached is not None:
            return cached

        explanation = ExplanationResult(
            response_id=request.response_id,
            sources=request.sources,
            confidence=ConfidenceScore(),
        )

        # Run requested explanation types
        if ExplanationType.REASONING_TRACE in request.explanation_types:
            await self._generate_llm_explanation(request, explanation)

        if ExplanationType.SOURCE_CITATION in request.explanation_types:
            self._score_sources(explanation)

        # Always compute confidence
        self._compute_confidence(explanation)

        explanation.latency_ms = (time.monotonic() - start) * 1000
        explanation.model_used = request.model or "default"

        # Cache and return (with LRU eviction)
        self._put_in_cache(request.response_id, explanation)
        logger.info(
            "Generated explanation for response %s (confidence=%.2f, %.0fms)",
            request.response_id[:8],
            explanation.confidence.overall,
            explanation.latency_ms,
        )

        return explanation

    async def _generate_llm_explanation(
        self, request: ExplanationRequest, explanation: ExplanationResult
    ) -> None:
        """Use the LLM to generate reasoning trace, factors, and bias checks."""
        user_content = (
            f"Original Prompt:\n{request.prompt}\n\n"
            f"AI Response:\n{request.response_content}"
        )

        if request.sources:
            sources_text = "\n".join(
                f"- [{s.source_type}] {s.title}: {s.content_snippet}"
                for s in request.sources
            )
            user_content += f"\n\nAvailable Sources:\n{sources_text}"

        llm_request = LLMRequest(
            messages=[
                Message(role=MessageRole.SYSTEM, content=XAI_SYSTEM_PROMPT),
                Message(role=MessageRole.USER, content=user_content),
            ],
            temperature=0.2,  # Low temperature for analytical tasks
            max_tokens=2048,
            model=request.model,
        )

        try:
            response = await self._engine.generate(llm_request)
            self._parse_explanation_response(response.content, explanation)
            explanation.model_used = response.model
        except Exception as e:
            logger.error("XAI LLM call failed: %s", e)
            # Fall back to heuristic explanation
            self._generate_heuristic_explanation(request, explanation)

    def _parse_explanation_response(
        self, content: str, explanation: ExplanationResult
    ) -> None:
        """Parse the LLM's JSON explanation into structured models."""
        import json

        # Extract JSON from response (handle markdown code blocks)
        json_str = content
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0]

        try:
            data = json.loads(json_str.strip())
        except json.JSONDecodeError:
            logger.warning("Failed to parse XAI JSON, using heuristic fallback")
            return

        # Reasoning steps
        for step in data.get("reasoning_steps", []):
            explanation.reasoning_steps.append(
                ReasoningStep(
                    step_number=step.get("step_number", 0),
                    description=step.get("description", ""),
                    evidence=step.get("evidence", ""),
                    confidence=min(max(step.get("confidence", 0.5), 0.0), 1.0),
                )
            )

        # Confidence
        conf_data = data.get("confidence", {})
        factors = conf_data.get("factors", {})
        overall = min(max(conf_data.get("overall", 0.5), 0.0), 1.0)
        explanation.confidence = ConfidenceScore(
            overall=overall,
            level=self._confidence_to_level(overall),
            factors={k: min(max(v, 0.0), 1.0) for k, v in factors.items()},
        )

        # Decision factors
        for factor in data.get("decision_factors", []):
            explanation.decision_factors.append(
                DecisionFactor(
                    factor_name=factor.get("factor_name", ""),
                    weight=min(max(factor.get("weight", 0.5), 0.0), 1.0),
                    value=factor.get("value", ""),
                    impact=factor.get("impact", "neutral"),
                )
            )

        # Bias checks
        for check in data.get("bias_checks", []):
            explanation.bias_checks.append(
                BiasCheckResult(
                    check_name=check.get("check_name", ""),
                    passed=check.get("passed", True),
                    details=check.get("details", ""),
                    severity=check.get("severity", "none"),
                )
            )

        explanation.summary = data.get("summary", "")

    def _generate_heuristic_explanation(
        self, request: ExplanationRequest, explanation: ExplanationResult
    ) -> None:
        """Generate a basic explanation using heuristics when LLM call fails."""
        explanation.reasoning_steps = [
            ReasoningStep(
                step_number=1,
                description="Analyzed the user's prompt to understand the request",
                confidence=0.8,
            ),
            ReasoningStep(
                step_number=2,
                description="Generated response based on available context and model knowledge",
                confidence=0.6,
            ),
        ]

        # Score based on response length and source availability
        has_sources = len(request.sources) > 0
        response_length = len(request.response_content)

        source_quality = 0.7 if has_sources else 0.3
        data_coverage = min(response_length / 500, 1.0)
        overall = (source_quality + data_coverage + 0.5) / 3

        explanation.confidence = ConfidenceScore(
            overall=round(overall, 2),
            level=self._confidence_to_level(overall),
            factors={
                "source_quality": round(source_quality, 2),
                "model_certainty": 0.5,
                "data_coverage": round(data_coverage, 2),
                "consistency": 0.5,
            },
        )

        explanation.summary = (
            "Explanation generated using heuristics (LLM analysis unavailable)."
        )

    # ── Confidence Scoring ─────────────────────────────────

    def _compute_confidence(self, explanation: ExplanationResult) -> None:
        """Recompute confidence from all available signals."""
        factors = dict(explanation.confidence.factors)

        # Adjust source quality based on actual source scores
        if explanation.sources:
            avg_relevance = sum(s.relevance_score for s in explanation.sources) / len(
                explanation.sources
            )
            factors["source_quality"] = round(avg_relevance, 2)

        # Adjust based on bias check results
        failed_checks = sum(1 for b in explanation.bias_checks if not b.passed)
        if explanation.bias_checks:
            bias_penalty = failed_checks / len(explanation.bias_checks)
            factors["bias_free"] = round(1.0 - bias_penalty, 2)

        # Recalculate overall as weighted average
        if factors:
            weights = {
                "source_quality": 0.3,
                "model_certainty": 0.3,
                "data_coverage": 0.2,
                "consistency": 0.1,
                "bias_free": 0.1,
            }
            total_weight = sum(weights.get(k, 0.1) for k in factors)
            weighted_sum = sum(
                factors[k] * weights.get(k, 0.1) for k in factors
            )
            overall = round(weighted_sum / total_weight, 2) if total_weight > 0 else 0.5
        else:
            overall = explanation.confidence.overall

        explanation.confidence = ConfidenceScore(
            overall=overall,
            level=self._confidence_to_level(overall),
            factors=factors,
        )

    def _score_sources(self, explanation: ExplanationResult) -> None:
        """Score source citations by relevance if not already scored."""
        for source in explanation.sources:
            if source.relevance_score == 0.0:
                # Basic heuristic: score by content length as a proxy
                source.relevance_score = min(len(source.content_snippet) / 200, 1.0)

    @staticmethod
    def _confidence_to_level(score: float) -> ConfidenceLevel:
        if score >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.HIGH]:
            return ConfidenceLevel.HIGH
        if score >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.MEDIUM]:
            return ConfidenceLevel.MEDIUM
        if score >= CONFIDENCE_THRESHOLDS[ConfidenceLevel.LOW]:
            return ConfidenceLevel.LOW
        return ConfidenceLevel.VERY_LOW

    # ── Audit Trail ────────────────────────────────────────

    def log_decision(
        self,
        user_id: str,
        response_id: str,
        explanation: ExplanationResult,
        prompt_summary: str,
        response_summary: str,
    ) -> ExplanationAuditEntry:
        """Record an AI decision and its explanation in the audit log."""
        entry = ExplanationAuditEntry(
            user_id=user_id,
            response_id=response_id,
            explanation_id=explanation.id,
            prompt_summary=prompt_summary[:500],
            response_summary=response_summary[:500],
            confidence_score=explanation.confidence.overall,
            confidence_level=explanation.confidence.level,
            model_used=explanation.model_used,
        )
        self._audit_log.append(entry)
        logger.info(
            "Audit entry created: user=%s response=%s confidence=%.2f",
            user_id,
            response_id[:8],
            explanation.confidence.overall,
        )
        return entry

    def flag_decision(
        self, audit_entry_id: str, reason: str
    ) -> ExplanationAuditEntry | None:
        """Flag an audited decision for review."""
        for entry in self._audit_log:
            if entry.id == audit_entry_id:
                entry.flagged = True
                entry.flag_reason = reason
                logger.warning(
                    "Decision flagged: %s — %s", audit_entry_id[:8], reason
                )
                return entry
        return None

    def get_audit_log(
        self,
        user_id: str | None = None,
        flagged_only: bool = False,
        limit: int = 100,
    ) -> list[ExplanationAuditEntry]:
        """Query the audit log with optional filters."""
        entries = self._audit_log
        if user_id:
            entries = [e for e in entries if e.user_id == user_id]
        if flagged_only:
            entries = [e for e in entries if e.flagged]
        return entries[-limit:]

    def get_audit_stats(self) -> dict:
        """Return summary statistics of the audit log."""
        if not self._audit_log:
            return {
                "total_decisions": 0,
                "flagged_decisions": 0,
                "avg_confidence": 0.0,
                "confidence_distribution": {},
            }

        total = len(self._audit_log)
        flagged = sum(1 for e in self._audit_log if e.flagged)
        avg_conf = sum(e.confidence_score for e in self._audit_log) / total

        distribution = {}
        for level in ConfidenceLevel:
            count = sum(
                1 for e in self._audit_log if e.confidence_level == level
            )
            distribution[level.value] = count

        return {
            "total_decisions": total,
            "flagged_decisions": flagged,
            "flag_rate": round(flagged / total, 4) if total else 0.0,
            "avg_confidence": round(avg_conf, 4),
            "confidence_distribution": distribution,
        }

    # ── Cache Management ───────────────────────────────────

    def get_cached_explanation(
        self, response_id: str
    ) -> ExplanationResult | None:
        """Retrieve a cached explanation by response ID."""
        return self._get_from_cache(response_id)

    def clear_cache(self) -> int:
        """Clear the explanation cache. Returns number of entries cleared."""
        count = len(self._explanation_cache)
        self._explanation_cache.clear()
        return count

    # ── Cache Internals (LRU + TTL) ───────────────────────

    def _get_from_cache(self, key: str) -> ExplanationResult | None:
        entry = self._explanation_cache.get(key)
        if entry is None:
            return None
        ts, result = entry
        if (time.monotonic() - ts) > self.CACHE_TTL_SECONDS:
            self._explanation_cache.pop(key, None)
            return None
        self._explanation_cache.move_to_end(key)
        return result

    def _put_in_cache(self, key: str, result: ExplanationResult) -> None:
        self._explanation_cache[key] = (time.monotonic(), result)
        self._explanation_cache.move_to_end(key)
        while len(self._explanation_cache) > self.CACHE_MAX_SIZE:
            self._explanation_cache.popitem(last=False)


# ── Singleton Factory ──────────────────────────────────────

_xai_instance: ExplainabilityEngine | None = None


def get_explainability_engine() -> ExplainabilityEngine:
    """Get or create the singleton explainability engine."""
    global _xai_instance
    if _xai_instance is None:
        _xai_instance = ExplainabilityEngine()
    return _xai_instance
