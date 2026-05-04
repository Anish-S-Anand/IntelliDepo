"""
Intelli Platform — Tool Registry
Feature: AI-7.2-tools

Registry for LLM function calling / tool use.
"""
from __future__ import annotations

import inspect
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class Tool:
    """Represents a tool/function that an AI agent can invoke."""

    def __init__(
        self,
        name: str,
        description: str,
        func: Callable,
        parameters_schema: dict,
    ):
        self.name = name
        self.description = description
        self.func = func
        self.parameters_schema = parameters_schema

    async def execute(self, **kwargs) -> Any:
        """Execute the tool function, handling both async and sync functions."""
        if inspect.iscoroutinefunction(self.func):
            return await self.func(**kwargs)
        return self.func(**kwargs)

    def to_openai_spec(self) -> dict:
        """Return OpenAI function calling specification."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters_schema,
            },
        }

    def to_anthropic_spec(self) -> dict:
        """Return Anthropic tool specification."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters_schema,
        }


class ToolRegistry:
    """Manages tool registration and retrieval."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(
        self, name: str, description: str, parameters_schema: dict
    ):
        """Decorator to register a function as a tool."""

        def decorator(func: Callable) -> Callable:
            self._tools[name] = Tool(name, description, func, parameters_schema)
            logger.info("Registered tool: %s", name)
            return func

        return decorator

    def get(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def list_tools(self) -> list[Tool]:
        """List all registered tools."""
        return list(self._tools.values())

    def get_tools_for_agent(self, enabled_tools: list[str]) -> list[Tool]:
        """Get tools filtered by agent's enabled_tools list."""
        return [self._tools[t] for t in enabled_tools if t in self._tools]


# Global tool registry singleton
tool_registry = ToolRegistry()
