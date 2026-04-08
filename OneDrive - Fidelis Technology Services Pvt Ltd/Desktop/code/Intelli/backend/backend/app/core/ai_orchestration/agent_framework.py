"""
Intelli Platform — Multi-Agent Framework
Feature: AI-7.2

Core framework for agent lifecycle management, task delegation,
inter-agent communication, and pipeline orchestration.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.core.ai_orchestration.agent_models import (
    AgentConfig,
    AgentMessage,
    AgentState,
    AgentStatus,
    PipelineConfig,
    Task,
    TaskPriority,
    TaskStatus,
)
from app.core.ai_orchestration.llm_engine import LLMEngine, get_llm_engine
from app.core.ai_orchestration.models import LLMRequest, Message, MessageRole

logger = logging.getLogger(__name__)


class Agent:
    """
    A single AI agent that can receive tasks, call the LLM, and communicate
    with other agents via the message bus.
    """

    def __init__(
        self,
        config: AgentConfig,
        engine: LLMEngine,
        learning_service=None,
        orchestrator_ref=None,
    ):
        self.state = AgentState(config=config)
        self._engine = engine
        self._message_handlers: list[callable] = []
        self._learning_service = learning_service  # SelfLearningService (optional)
        self._orchestrator_ref = orchestrator_ref  # AgentOrchestrator reference (weak)

    @property
    def agent_id(self) -> str:
        return self.state.agent_id

    @property
    def agent_type(self) -> str:
        return self.state.config.agent_type

    @property
    def status(self) -> AgentStatus:
        return self.state.status

    # ── Task Execution ─────────────────────────────────────

    async def execute_task(self, task: Task) -> Task:
        """Execute a task by building a prompt and calling the LLM."""
        self.state.status = AgentStatus.RUNNING
        self.state.current_task = task.id
        self.state.last_active = datetime.now(timezone.utc)
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.now(timezone.utc)
        task.assigned_to = self.agent_id

        timeout = self.state.config.timeout_seconds
        retries = 0
        max_retries = self.state.config.max_retries

        while retries <= max_retries:
            try:
                response = await asyncio.wait_for(
                    self._call_llm(task), timeout=timeout
                )
                task.output_data = {
                    "response": response.content,
                    "model": response.model,
                    "tokens": response.usage.total_tokens,
                    "cost_usd": response.cost_usd,
                    "confidence_score": response.confidence_score,
                    "confidence_method": response.confidence_method,
                }
                task.confidence_score = response.confidence_score
                task.status = TaskStatus.COMPLETED
                task.completed_at = datetime.now(timezone.utc)

                # Track usage
                self.state.total_tokens_used += response.usage.total_tokens
                self.state.total_cost_usd += response.cost_usd
                self.state.completed_tasks.append(task.id)

                # Add to conversation history for context continuity
                self.state.conversation_history.append(
                    {"role": "user", "content": task.description}
                )
                self.state.conversation_history.append(
                    {"role": "assistant", "content": response.content}
                )

                logger.info(
                    "Agent %s completed task %s in %.0fms (confidence=%.2f)",
                    self.agent_id[:8],
                    task.name,
                    task.duration_ms or 0,
                    response.confidence_score,
                )

                # Check confidence threshold and escalate if needed
                if response.confidence_score < self.state.config.confidence_threshold:
                    task = await self._handle_low_confidence(task, response)
                    break

                break

            except Exception as e:
                retries += 1
                task.retries = retries
                logger.warning(
                    "Agent %s task %s attempt %d failed: %s",
                    self.agent_id[:8],
                    task.name,
                    retries,
                    e,
                )
                if retries > max_retries:
                    task.status = TaskStatus.FAILED
                    task.error = str(e)
                    task.completed_at = datetime.now(timezone.utc)
                    self.state.status = AgentStatus.FAILED
                    break
                await asyncio.sleep(0.5 * retries)  # backoff

        if task.status == TaskStatus.COMPLETED:
            self.state.status = AgentStatus.IDLE
        self.state.current_task = None

        # Record outcome for self-learning (non-blocking)
        if self._learning_service and task.status == TaskStatus.COMPLETED:
            asyncio.create_task(
                self._learning_service.record_outcome(task, self.agent_type)
            )

        return task

    async def _call_llm(self, task: Task) -> object:
        """Build messages from agent config + task and call the LLM engine."""
        # Prepare system prompt with learning context
        system_content = self.state.config.system_prompt
        if self._learning_service:
            learning_ctx = await self._learning_service.build_learning_context(
                task.description, self.agent_type
            )
            if learning_ctx:
                system_content = f"{system_content}\n\n{learning_ctx}"

        messages = [Message(role=MessageRole.SYSTEM, content=system_content)]

        # Include recent conversation history for context
        for msg in self.state.conversation_history[-10:]:
            messages.append(
                Message(role=MessageRole(msg["role"]), content=msg["content"])
            )

        # Build the user message from task
        user_content = task.description
        if task.input_data:
            input_str = "\n".join(f"- {k}: {v}" for k, v in task.input_data.items())
            user_content = f"{task.description}\n\nInput:\n{input_str}"

        messages.append(Message(role=MessageRole.USER, content=user_content))

        # Prepare tools if enabled
        tools = None
        if self.state.config.enabled_tools:
            from app.core.ai_orchestration.tools.registry import tool_registry

            tools = [
                tool_registry.get(t).to_openai_spec()
                for t in self.state.config.enabled_tools
                if tool_registry.get(t)
            ]

        request = LLMRequest(
            messages=messages,
            model=self.state.config.model,
            temperature=self.state.config.temperature,
            max_tokens=self.state.config.max_tokens,
            tools=tools,
        )

        return await self._engine.generate(request)

    async def _handle_low_confidence(self, task: Task, initial_response) -> Task:
        """
        Three-step escalation when confidence is below threshold:
        1. Retry with fallback_model
        2. Escalate to supervisor agent
        3. Return best available result
        """
        best_response = initial_response
        best_score = initial_response.confidence_score

        # Step 1: Try fallback model if configured
        if self.state.config.fallback_model:
            logger.info(
                "Retrying task %s with fallback model: %s",
                task.id[:8],
                self.state.config.fallback_model,
            )
            try:
                # Build messages from conversation
                messages = [
                    Message(role=MessageRole.SYSTEM, content=self.state.config.system_prompt)
                ]
                for msg in self.state.conversation_history[-5:]:
                    messages.append(
                        Message(role=MessageRole(msg["role"]), content=msg["content"])
                    )
                user_content = task.description
                if task.input_data:
                    input_str = "\n".join(f"- {k}: {v}" for k, v in task.input_data.items())
                    user_content = f"{task.description}\n\nInput:\n{input_str}"
                messages.append(Message(role=MessageRole.USER, content=user_content))

                alt_request = LLMRequest(
                    messages=messages,
                    model=self.state.config.fallback_model,
                    temperature=self.state.config.temperature,
                    max_tokens=self.state.config.max_tokens,
                )
                alt_response = await self._engine.generate(alt_request)

                if alt_response.confidence_score >= self.state.config.confidence_threshold:
                    logger.info(
                        "Fallback model achieved sufficient confidence: %.2f",
                        alt_response.confidence_score,
                    )
                    return self._apply_response_to_task(task, alt_response)

                if alt_response.confidence_score > best_score:
                    best_response = alt_response
                    best_score = alt_response.confidence_score
            except Exception as e:
                logger.warning("Fallback model attempt failed: %s", e)

        # Step 2: Escalate to supervisor agent
        if self._orchestrator_ref:
            logger.info("Escalating task %s to supervisor", task.id[:8])
            try:
                supervisor_task = await self._orchestrator_ref.escalate_to_supervisor(
                    task, best_response
                )
                if (
                    supervisor_task.confidence_score
                    and supervisor_task.confidence_score >= self.state.config.confidence_threshold
                ):
                    logger.info("Supervisor improved confidence to: %.2f", supervisor_task.confidence_score)
                    supervisor_task.output_data["escalated"] = True
                    return supervisor_task

                if supervisor_task.confidence_score and supervisor_task.confidence_score > best_score:
                    return supervisor_task
            except Exception as e:
                logger.warning("Supervisor escalation failed: %s", e)

        # Step 3: Return best available
        logger.warning(
            "Returning best available response with confidence: %.2f",
            best_score,
        )
        return self._apply_response_to_task(task, best_response)

    def _apply_response_to_task(self, task: Task, response) -> Task:
        """Apply LLM response to task and update metadata."""
        task.output_data = {
            "response": response.content,
            "model": response.model,
            "tokens": response.usage.total_tokens,
            "cost_usd": response.cost_usd,
            "confidence_score": response.confidence_score,
            "confidence_method": response.confidence_method,
        }
        task.confidence_score = response.confidence_score
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)

        # Update agent state
        self.state.total_tokens_used += response.usage.total_tokens
        self.state.total_cost_usd += response.cost_usd
        self.state.completed_tasks.append(task.id)
        self.state.conversation_history.append({"role": "user", "content": task.description})
        self.state.conversation_history.append(
            {"role": "assistant", "content": response.content}
        )

        return task

    # ── Messaging ──────────────────────────────────────────

    def on_message(self, handler: callable) -> None:
        """Register a handler for incoming messages."""
        self._message_handlers.append(handler)

    async def receive_message(self, message: AgentMessage) -> None:
        """Process an incoming message from another agent."""
        for handler in self._message_handlers:
            result = handler(message)
            if asyncio.iscoroutine(result):
                await result

    def reset(self) -> None:
        """Reset agent to idle state, clearing conversation history."""
        self.state.status = AgentStatus.IDLE
        self.state.current_task = None
        self.state.conversation_history = []


class AgentOrchestrator:
    """
    Manages the lifecycle of agents, routes tasks, handles delegation,
    and runs multi-agent pipelines.
    """

    def __init__(
        self,
        engine: LLMEngine | None = None,
        persistence_service=None,
        learning_service=None,
    ):
        self._engine = engine or get_llm_engine()
        self._agent_registry: dict[str, AgentConfig] = {}   # agent_type -> config
        self._live_agents: dict[str, Agent] = {}             # agent_id -> Agent
        self._message_bus: list[AgentMessage] = []
        self._task_history: list[Task] = []
        self._persistence_service = persistence_service
        self._learning_service = learning_service

    # ── Agent Registry ─────────────────────────────────────

    def register_agent_type(self, config: AgentConfig) -> None:
        """Register an agent blueprint that can be spawned on demand."""
        self._agent_registry[config.agent_type] = config
        logger.info("Registered agent type: %s", config.agent_type)

    def get_registered_types(self) -> list[str]:
        """List all registered agent types."""
        return list(self._agent_registry.keys())

    # ── Lifecycle ──────────────────────────────────────────

    def spawn_agent(self, agent_type: str) -> Agent:
        """Create a new live agent instance from a registered type."""
        if agent_type not in self._agent_registry:
            raise ValueError(
                f"Unknown agent type '{agent_type}'. "
                f"Registered: {list(self._agent_registry.keys())}"
            )

        config = self._agent_registry[agent_type]
        agent = Agent(
            config=config,
            engine=self._engine,
            learning_service=self._learning_service,
            orchestrator_ref=self,
        )
        self._live_agents[agent.agent_id] = agent
        logger.info(
            "Spawned agent %s (type=%s)", agent.agent_id[:8], agent_type
        )
        return agent

    def get_agent(self, agent_id: str) -> Agent | None:
        """Get a live agent by ID."""
        return self._live_agents.get(agent_id)

    def destroy_agent(self, agent_id: str) -> bool:
        """Remove a live agent instance."""
        if agent_id in self._live_agents:
            agent = self._live_agents.pop(agent_id)
            agent.state.status = AgentStatus.CANCELLED
            logger.info("Destroyed agent %s", agent_id[:8])
            return True
        return False

    def list_agents(self) -> list[AgentState]:
        """List all live agents and their states."""
        return [a.state for a in self._live_agents.values()]

    def get_idle_agent(self, agent_type: str) -> Agent | None:
        """Find an idle agent of a given type, or return None."""
        for agent in self._live_agents.values():
            if (
                agent.agent_type == agent_type
                and agent.status == AgentStatus.IDLE
            ):
                return agent
        return None

    # ── Task Delegation ────────────────────────────────────

    async def delegate_task(
        self,
        agent_type: str,
        task_name: str,
        task_description: str,
        input_data: dict | None = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        reuse_agent: bool = True,
        db=None,
    ) -> Task:
        """
        Delegate a task to an agent of the specified type.
        Reuses an idle agent if available, otherwise spawns a new one.
        Optionally persists task to database if db session provided.
        """
        # Find or spawn an agent
        agent = None
        if reuse_agent:
            agent = self.get_idle_agent(agent_type)
        if agent is None:
            agent = self.spawn_agent(agent_type)

        task = Task(
            name=task_name,
            description=task_description,
            input_data=input_data or {},
            priority=priority,
        )

        result = await agent.execute_task(task)
        self._task_history.append(result)

        # Persist task if persistence service and db session available
        if self._persistence_service and db:
            await self._persistence_service.save_task(db, result, agent_type)

        return result

    async def delegate_to_agent_id(
        self,
        agent_id: str,
        task_name: str,
        task_description: str,
        input_data: dict | None = None,
    ) -> Task:
        """Delegate a task to a specific live agent by ID."""
        agent = self._live_agents.get(agent_id)
        if agent is None:
            raise ValueError(f"No live agent with id '{agent_id}'")

        task = Task(
            name=task_name,
            description=task_description,
            input_data=input_data or {},
        )

        result = await agent.execute_task(task)
        self._task_history.append(result)
        return result

    async def escalate_to_supervisor(self, original_task: Task, candidate_response) -> Task:
        """
        Escalate a low-confidence task to a supervisor agent for evaluation and improvement.
        """
        supervisor = self.get_idle_agent("supervisor") or self.spawn_agent("supervisor")

        eval_task = Task(
            name=f"evaluate_{original_task.id[:8]}",
            description=(
                f"Original task: {original_task.description}\n\n"
                f"Candidate response (confidence {candidate_response.confidence_score:.2f}):\n"
                f"{candidate_response.content}\n\n"
                f"Evaluate and either confirm as-is or provide an improved response."
            ),
            input_data=original_task.input_data,
            priority=original_task.priority,
        )

        result = await supervisor.execute_task(eval_task)
        result.output_data["escalated"] = True
        self._task_history.append(result)
        return result

    # ── Inter-Agent Communication ──────────────────────────

    async def send_message(
        self,
        from_agent_id: str,
        to_agent_id: str,
        content: str,
        message_type: str = "text",
        metadata: dict | None = None,
    ) -> AgentMessage:
        """Send a message from one agent to another."""
        message = AgentMessage(
            from_agent=from_agent_id,
            to_agent=to_agent_id,
            content=content,
            message_type=message_type,
            metadata=metadata or {},
        )
        self._message_bus.append(message)

        # Deliver to target agent
        target = self._live_agents.get(to_agent_id)
        if target:
            await target.receive_message(message)

        return message

    async def broadcast(
        self, from_id: str, content: str, message_type: str = "text"
    ) -> list[AgentMessage]:
        """Broadcast a message to all live agents."""
        messages = []
        for agent_id in self._live_agents:
            if agent_id != from_id:
                msg = await self.send_message(
                    from_id, agent_id, content, message_type
                )
                messages.append(msg)
        return messages

    # ── Pipeline Execution ─────────────────────────────────

    async def run_pipeline(self, pipeline: PipelineConfig) -> list[Task]:
        """
        Execute a multi-step pipeline of agents.

        Steps run sequentially by default. If parallel_groups is specified,
        steps within a group run concurrently.
        """
        results: list[Task] = []
        step_outputs: dict[int, dict] = {}

        if pipeline.parallel_groups:
            # Run groups in order; steps within a group run in parallel
            for group in pipeline.parallel_groups:
                group_tasks = []
                for step_idx in group:
                    if step_idx >= len(pipeline.steps):
                        continue
                    step = pipeline.steps[step_idx]
                    input_data = self._resolve_inputs(step.input_mapping, step_outputs)
                    group_tasks.append(
                        (step_idx, step, input_data)
                    )

                coros = [
                    self.delegate_task(
                        agent_type=s.agent_type,
                        task_name=s.task_name,
                        task_description=s.task_description,
                        input_data=inp,
                    )
                    for _, s, inp in group_tasks
                ]
                group_results = await asyncio.gather(*coros, return_exceptions=True)

                for (step_idx, _, _), result in zip(group_tasks, group_results):
                    if isinstance(result, Exception):
                        failed = Task(
                            name=pipeline.steps[step_idx].task_name,
                            description=pipeline.steps[step_idx].task_description,
                            status=TaskStatus.FAILED,
                            error=str(result),
                        )
                        results.append(failed)
                        step_outputs[step_idx] = {}
                    else:
                        results.append(result)
                        step_outputs[step_idx] = result.output_data
        else:
            # Sequential execution
            for i, step in enumerate(pipeline.steps):
                input_data = self._resolve_inputs(step.input_mapping, step_outputs)
                task = await self.delegate_task(
                    agent_type=step.agent_type,
                    task_name=step.task_name,
                    task_description=step.task_description,
                    input_data=input_data,
                )
                results.append(task)
                step_outputs[i] = task.output_data

                # Stop pipeline on failure
                if task.status == TaskStatus.FAILED:
                    logger.error(
                        "Pipeline '%s' failed at step %d: %s",
                        pipeline.name,
                        i,
                        task.error,
                    )
                    break

        return results

    def _resolve_inputs(
        self, mapping: dict[str, str], step_outputs: dict[int, dict]
    ) -> dict:
        """
        Resolve input mappings like {"text": "$step.0.response"} to actual values
        from prior step outputs.
        """
        resolved = {}
        for key, ref in mapping.items():
            if ref.startswith("$step."):
                parts = ref.split(".")
                if len(parts) >= 3:
                    step_idx = int(parts[1])
                    field = ".".join(parts[2:])
                    outputs = step_outputs.get(step_idx, {})
                    resolved[key] = outputs.get(field, "")
                else:
                    resolved[key] = ref
            else:
                resolved[key] = ref
        return resolved

    # ── Info ───────────────────────────────────────────────

    def get_task_history(self, limit: int = 50) -> list[Task]:
        """Return recent completed/failed tasks."""
        return self._task_history[-limit:]

    def get_stats(self) -> dict:
        """Return orchestrator-level stats."""
        agents = list(self._live_agents.values())
        return {
            "registered_types": len(self._agent_registry),
            "live_agents": len(agents),
            "agents_by_status": {
                s.value: sum(1 for a in agents if a.status == s)
                for s in AgentStatus
            },
            "total_tasks": len(self._task_history),
            "total_tokens": sum(a.state.total_tokens_used for a in agents),
            "total_cost_usd": round(
                sum(a.state.total_cost_usd for a in agents), 6
            ),
            "messages_exchanged": len(self._message_bus),
        }


# ── Singleton ──────────────────────────────────────────────

_orchestrator_instance: AgentOrchestrator | None = None


def get_agent_orchestrator() -> AgentOrchestrator:
    """Get or create the singleton agent orchestrator with services."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        from app.core.ai_orchestration.learning.vector_memory import get_vector_memory
        from app.core.ai_orchestration.persistence.service import AgentPersistenceService

        persistence = AgentPersistenceService()
        vector_memory = get_vector_memory()

        # Learning service will be set up later when db session is available
        _orchestrator_instance = AgentOrchestrator(
            persistence_service=persistence,
            learning_service=None,
        )
    return _orchestrator_instance
