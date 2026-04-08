"""
Tests for AI-7.2: Multi-Agent Framework

Tests agent lifecycle, task delegation, inter-agent messaging,
and pipeline execution using mock LLM providers.
"""
import pytest

from app.core.ai_orchestration.agent_models import (
    AgentCapability,
    AgentConfig,
    AgentStatus,
    PipelineConfig,
    PipelineStep,
    TaskPriority,
    TaskStatus,
)
from app.core.ai_orchestration.agent_framework import Agent, AgentOrchestrator
from app.core.ai_orchestration.llm_engine import LLMEngine
from app.core.ai_orchestration.models import (
    LLMProvider,
    LLMRequest,
    LLMResponse,
    TokenUsage,
)
from app.core.ai_orchestration.providers import BaseLLMProvider


# ── Mock Provider ──────────────────────────────────────────


class MockProvider(BaseLLMProvider):
    provider = LLMProvider.OPENAI

    async def generate(self, request: LLMRequest) -> LLMResponse:
        return LLMResponse(
            content=f"Mock response to: {request.messages[-1].content[:50]}",
            model="mock-model",
            provider=self.provider,
            usage=TokenUsage(prompt_tokens=10, completion_tokens=20, total_tokens=30),
            latency_ms=5.0,
        )

    async def health_check(self) -> bool:
        return True


def make_engine() -> LLMEngine:
    engine = LLMEngine()
    engine.register_provider(MockProvider())
    return engine


SUMMARIZER_CONFIG = AgentConfig(
    agent_type="summarizer",
    display_name="Summarizer Agent",
    system_prompt="You are a summarization agent. Summarize the given text concisely.",
    capabilities=[AgentCapability.SUMMARIZATION],
)

ANALYZER_CONFIG = AgentConfig(
    agent_type="analyzer",
    display_name="Analyzer Agent",
    system_prompt="You are an analysis agent. Analyze the given data and provide insights.",
    capabilities=[AgentCapability.ANALYSIS],
)


# ── Agent Lifecycle Tests ──────────────────────────────────


class TestAgentLifecycle:
    def test_spawn_agent(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        agent = orch.spawn_agent("summarizer")
        assert agent.agent_type == "summarizer"
        assert agent.status == AgentStatus.IDLE

    def test_spawn_unregistered_type_raises(self):
        orch = AgentOrchestrator(engine=make_engine())
        with pytest.raises(ValueError, match="Unknown agent type"):
            orch.spawn_agent("nonexistent")

    def test_destroy_agent(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        agent = orch.spawn_agent("summarizer")

        assert orch.destroy_agent(agent.agent_id) is True
        assert orch.get_agent(agent.agent_id) is None

    def test_destroy_nonexistent_returns_false(self):
        orch = AgentOrchestrator(engine=make_engine())
        assert orch.destroy_agent("fake-id") is False

    def test_list_agents(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        orch.register_agent_type(ANALYZER_CONFIG)

        orch.spawn_agent("summarizer")
        orch.spawn_agent("analyzer")

        agents = orch.list_agents()
        assert len(agents) == 2

    def test_get_registered_types(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        orch.register_agent_type(ANALYZER_CONFIG)

        types = orch.get_registered_types()
        assert "summarizer" in types
        assert "analyzer" in types

    def test_agent_reset(self):
        engine = make_engine()
        agent = Agent(config=SUMMARIZER_CONFIG, engine=engine)
        agent.state.conversation_history = [{"role": "user", "content": "hi"}]
        agent.state.status = AgentStatus.RUNNING

        agent.reset()
        assert agent.status == AgentStatus.IDLE
        assert agent.state.conversation_history == []


# ── Task Delegation Tests ──────────────────────────────────


class TestTaskDelegation:
    @pytest.mark.asyncio
    async def test_delegate_task(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        task = await orch.delegate_task(
            agent_type="summarizer",
            task_name="summarize_doc",
            task_description="Summarize this quarterly report.",
        )

        assert task.status == TaskStatus.COMPLETED
        assert "response" in task.output_data
        assert task.output_data["tokens"] == 30

    @pytest.mark.asyncio
    async def test_delegate_with_input_data(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        task = await orch.delegate_task(
            agent_type="summarizer",
            task_name="summarize",
            task_description="Summarize the following text",
            input_data={"text": "A very long document..."},
        )

        assert task.status == TaskStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_reuse_idle_agent(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        # First task spawns an agent
        await orch.delegate_task(
            agent_type="summarizer",
            task_name="task1",
            task_description="First task",
            reuse_agent=True,
        )
        assert len(orch.list_agents()) == 1

        # Second task reuses the same agent
        await orch.delegate_task(
            agent_type="summarizer",
            task_name="task2",
            task_description="Second task",
            reuse_agent=True,
        )
        assert len(orch.list_agents()) == 1

    @pytest.mark.asyncio
    async def test_no_reuse_spawns_new(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        await orch.delegate_task(
            agent_type="summarizer",
            task_name="task1",
            task_description="First",
            reuse_agent=False,
        )
        await orch.delegate_task(
            agent_type="summarizer",
            task_name="task2",
            task_description="Second",
            reuse_agent=False,
        )
        assert len(orch.list_agents()) == 2

    @pytest.mark.asyncio
    async def test_delegate_to_specific_agent(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        agent = orch.spawn_agent("summarizer")

        task = await orch.delegate_to_agent_id(
            agent_id=agent.agent_id,
            task_name="specific_task",
            task_description="Do this specific thing",
        )
        assert task.status == TaskStatus.COMPLETED
        assert task.assigned_to == agent.agent_id

    @pytest.mark.asyncio
    async def test_task_history(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        for i in range(3):
            await orch.delegate_task(
                agent_type="summarizer",
                task_name=f"task_{i}",
                task_description=f"Task number {i}",
            )

        history = orch.get_task_history()
        assert len(history) == 3


# ── Inter-Agent Communication Tests ────────────────────────


class TestInterAgentComm:
    @pytest.mark.asyncio
    async def test_send_message(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        orch.register_agent_type(ANALYZER_CONFIG)

        agent_a = orch.spawn_agent("summarizer")
        agent_b = orch.spawn_agent("analyzer")

        received = []
        agent_b.on_message(lambda msg: received.append(msg))

        await orch.send_message(
            from_agent_id=agent_a.agent_id,
            to_agent_id=agent_b.agent_id,
            content="Here is the summary for analysis",
        )

        assert len(received) == 1
        assert received[0].content == "Here is the summary for analysis"

    @pytest.mark.asyncio
    async def test_broadcast(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        agents = [orch.spawn_agent("summarizer") for _ in range(3)]
        received_counts = {a.agent_id: [] for a in agents}

        for agent in agents:
            agent.on_message(lambda msg, aid=agent.agent_id: received_counts[aid].append(msg))

        msgs = await orch.broadcast(
            from_id=agents[0].agent_id,
            content="System-wide update",
        )

        # Should send to 2 agents (not the sender)
        assert len(msgs) == 2


# ── Pipeline Tests ─────────────────────────────────────────


class TestPipeline:
    @pytest.mark.asyncio
    async def test_sequential_pipeline(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        orch.register_agent_type(ANALYZER_CONFIG)

        pipeline = PipelineConfig(
            name="summarize-then-analyze",
            steps=[
                PipelineStep(
                    agent_type="summarizer",
                    task_name="summarize",
                    task_description="Summarize the document",
                ),
                PipelineStep(
                    agent_type="analyzer",
                    task_name="analyze",
                    task_description="Analyze the summary",
                    input_mapping={"text": "$step.0.response"},
                ),
            ],
        )

        results = await orch.run_pipeline(pipeline)
        assert len(results) == 2
        assert all(t.status == TaskStatus.COMPLETED for t in results)

    @pytest.mark.asyncio
    async def test_parallel_pipeline(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)
        orch.register_agent_type(ANALYZER_CONFIG)

        pipeline = PipelineConfig(
            name="parallel-then-combine",
            steps=[
                PipelineStep(
                    agent_type="summarizer",
                    task_name="summarize",
                    task_description="Summarize doc A",
                ),
                PipelineStep(
                    agent_type="analyzer",
                    task_name="analyze",
                    task_description="Analyze doc B",
                ),
            ],
            parallel_groups=[[0, 1]],
        )

        results = await orch.run_pipeline(pipeline)
        assert len(results) == 2
        assert all(t.status == TaskStatus.COMPLETED for t in results)


# ── Stats Tests ────────────────────────────────────────────


class TestStats:
    @pytest.mark.asyncio
    async def test_orchestrator_stats(self):
        orch = AgentOrchestrator(engine=make_engine())
        orch.register_agent_type(SUMMARIZER_CONFIG)

        await orch.delegate_task(
            agent_type="summarizer",
            task_name="task1",
            task_description="Do something",
        )

        stats = orch.get_stats()
        assert stats["registered_types"] == 1
        assert stats["live_agents"] == 1
        assert stats["total_tasks"] == 1
        assert stats["total_tokens"] == 60
