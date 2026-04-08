"""
Intelli Platform — LLM Provider Adapters
Feature: AI-7.1

Unified interface for OpenAI, Anthropic, and local model providers.
Each adapter normalizes requests/responses to the common LLM format.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod

from app.core.ai_orchestration.models import (
    LLMProvider,
    LLMRequest,
    LLMResponse,
    Message,
    TokenUsage,
)


class BaseLLMProvider(ABC):
    """Abstract base for all LLM provider adapters."""

    provider: LLMProvider

    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Send a request and return a unified response."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider API is reachable."""


class OpenAIProvider(BaseLLMProvider):
    """Adapter for OpenAI API (GPT-4o, GPT-4, etc.)."""

    provider = LLMProvider.OPENAI

    def __init__(self, api_key: str):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        import math
        model = request.model or "gpt-4o"
        messages = [{"role": m.role.value, "content": m.content} for m in request.messages]

        start = time.perf_counter()
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            logprobs=True,
            top_logprobs=5,
        )
        latency_ms = (time.perf_counter() - start) * 1000

        choice = response.choices[0]
        usage = response.usage

        # Extract confidence from log probabilities
        confidence_score = 0.5
        confidence_method = "default"
        if choice.logprobs and choice.logprobs.content:
            lp_values = [
                t.logprob
                for t in choice.logprobs.content[:20]
                if t.logprob is not None
            ]
            if lp_values:
                mean_logprob = sum(lp_values) / len(lp_values)
                confidence_score = round(max(0.0, min(1.0, math.exp(mean_logprob))), 4)
                confidence_method = "logprobs"

        return LLMResponse(
            content=choice.message.content or "",
            model=response.model,
            provider=self.provider,
            usage=TokenUsage(
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            ),
            latency_ms=latency_ms,
            confidence_score=confidence_score,
            confidence_method=confidence_method,
        )

    async def health_check(self) -> bool:
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False


class AnthropicProvider(BaseLLMProvider):
    """Adapter for Anthropic API (Claude models)."""

    provider = LLMProvider.ANTHROPIC

    def __init__(self, api_key: str):
        from anthropic import AsyncAnthropic
        self.client = AsyncAnthropic(api_key=api_key)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.model or "claude-sonnet-4-20250514"

        # Anthropic separates system messages from the conversation
        system_msg = ""
        conversation: list[dict] = []
        for m in request.messages:
            if m.role.value == "system":
                system_msg = m.content
            else:
                conversation.append({"role": m.role.value, "content": m.content})

        # Append confidence self-assessment prompt to the last user message
        if conversation and conversation[-1]["role"] == "user":
            conversation[-1]["content"] += (
                "\n\n[Confidence: Reply ONLY with a decimal 0.00–1.00 representing "
                "your confidence in the above answer, placed after a newline at the end.]"
            )

        start = time.perf_counter()
        kwargs: dict = {
            "model": model,
            "messages": conversation,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
        }
        if system_msg:
            kwargs["system"] = system_msg

        response = await self.client.messages.create(**kwargs)
        latency_ms = (time.perf_counter() - start) * 1000

        content = response.content[0].text if response.content else ""

        # Extract confidence score from the end of the response
        confidence_score = 0.5
        confidence_method = "default"
        lines = content.strip().split("\n")
        if lines:
            last_line = lines[-1].strip()
            try:
                conf_val = float(last_line)
                if 0.0 <= conf_val <= 1.0:
                    confidence_score = round(conf_val, 4)
                    confidence_method = "self_assessment"
                    # Remove the confidence line from displayed content
                    content = "\n".join(lines[:-1]).strip()
            except ValueError:
                pass  # Fall back to default confidence

        return LLMResponse(
            content=content,
            model=response.model,
            provider=self.provider,
            usage=TokenUsage(
                prompt_tokens=response.usage.input_tokens,
                completion_tokens=response.usage.output_tokens,
                total_tokens=response.usage.input_tokens + response.usage.output_tokens,
            ),
            latency_ms=latency_ms,
            confidence_score=confidence_score,
            confidence_method=confidence_method,
        )

    async def health_check(self) -> bool:
        try:
            await self.client.messages.create(
                model="claude-haiku-4-5-20241022",
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True
        except Exception:
            return False


class LocalProvider(BaseLLMProvider):
    """Adapter for local/self-hosted models (Ollama, vLLM, etc.) via OpenAI-compatible API."""

    provider = LLMProvider.LOCAL

    def __init__(self, base_url: str = "http://localhost:11434/v1", api_key: str = "local"):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.model or "llama3"
        messages = [{"role": m.role.value, "content": m.content} for m in request.messages]

        # Append confidence self-assessment prompt to the last message if it's a user message
        if messages and messages[-1]["role"] == "user":
            messages[-1]["content"] += (
                "\n\n[Confidence: Reply ONLY with a decimal 0.00–1.00 representing "
                "your confidence in the above answer, placed after a newline at the end.]"
            )

        start = time.perf_counter()
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        latency_ms = (time.perf_counter() - start) * 1000

        choice = response.choices[0]
        usage = response.usage
        content = choice.message.content or ""

        # Extract confidence score from the end of the response
        confidence_score = 0.5
        confidence_method = "default"
        lines = content.strip().split("\n")
        if lines:
            last_line = lines[-1].strip()
            try:
                conf_val = float(last_line)
                if 0.0 <= conf_val <= 1.0:
                    confidence_score = round(conf_val, 4)
                    confidence_method = "self_assessment"
                    # Remove the confidence line from displayed content
                    content = "\n".join(lines[:-1]).strip()
            except ValueError:
                pass  # Fall back to default confidence

        return LLMResponse(
            content=content,
            model=response.model or model,
            provider=self.provider,
            usage=TokenUsage(
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            ),
            latency_ms=latency_ms,
            confidence_score=confidence_score,
            confidence_method=confidence_method,
        )

    async def health_check(self) -> bool:
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False
