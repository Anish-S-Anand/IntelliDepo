"""
Intelli Platform — Built-in Agent Tools
Feature: AI-7.2-tools

Pre-registered tools: web search, vector DB query, code execution, data retrieval.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx

from app.core.ai_orchestration.tools.registry import tool_registry

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────
# web_search tool
# ────────────────────────────────────────────────────────────────


@tool_registry.register(
    name="web_search",
    description="Search the web for information using DuckDuckGo Instant API",
    parameters_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
            },
            "num_results": {
                "type": "integer",
                "description": "Number of results to return (default 5)",
                "default": 5,
            },
        },
        "required": ["query"],
    },
)
async def web_search(query: str, num_results: int = 5) -> dict:
    """Search the web for information."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.duckduckgo.com",
                params={"q": query, "format": "json"},
                timeout=5.0,
            )
            data = response.json()

            # Extract results from DuckDuckGo API response
            results = []
            if data.get("RelatedTopics"):
                for item in data["RelatedTopics"][:num_results]:
                    if "FirstURL" in item:
                        results.append(
                            {
                                "title": item.get("Text", query),
                                "url": item["FirstURL"],
                            }
                        )

            return {
                "query": query,
                "results": results,
                "success": len(results) > 0,
            }
    except Exception as e:
        logger.error("Web search failed for query '%s': %s", query, e)
        return {
            "query": query,
            "results": [],
            "success": False,
            "error": str(e),
        }


# ────────────────────────────────────────────────────────────────
# vector_db_query tool
# ────────────────────────────────────────────────────────────────


@tool_registry.register(
    name="vector_db_query",
    description="Query vector database for semantically similar past agent outcomes",
    parameters_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The semantic search query",
            },
            "agent_type": {
                "type": "string",
                "description": "Filter by agent type",
            },
            "top_k": {
                "type": "integer",
                "description": "Number of results to return (default 5)",
                "default": 5,
            },
        },
        "required": ["query", "agent_type"],
    },
)
async def vector_db_query(query: str, agent_type: str, top_k: int = 5) -> dict:
    """Query the vector database for similar outcomes (requires VectorMemory to be initialized)."""
    try:
        from app.core.ai_orchestration.learning.vector_memory import get_vector_memory

        memory = get_vector_memory()
        if not memory:
            return {
                "query": query,
                "agent_type": agent_type,
                "results": [],
                "error": "Vector database not configured",
            }

        results = await memory.retrieve_similar(query, agent_type, top_k=top_k)
        return {
            "query": query,
            "agent_type": agent_type,
            "results": results,
            "success": len(results) > 0,
        }
    except Exception as e:
        logger.error(
            "Vector DB query failed for agent_type '%s': %s", agent_type, e
        )
        return {
            "query": query,
            "agent_type": agent_type,
            "results": [],
            "success": False,
            "error": str(e),
        }


# ────────────────────────────────────────────────────────────────
# code_executor tool
# ────────────────────────────────────────────────────────────────


@tool_registry.register(
    name="code_executor",
    description="Execute Python code in a sandboxed subprocess",
    parameters_schema={
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Python code to execute",
            },
            "timeout": {
                "type": "integer",
                "description": "Timeout in seconds (default 10)",
                "default": 10,
            },
        },
        "required": ["code"],
    },
)
async def code_executor(code: str, timeout: int = 10) -> dict:
    """Execute Python code and return output."""
    try:
        # Create subprocess to run the code
        process = await asyncio.create_subprocess_exec(
            "python",
            "-c",
            code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            return {
                "success": False,
                "error": f"Execution timed out after {timeout} seconds",
                "stdout": "",
                "stderr": "",
                "exit_code": -1,
            }

        return {
            "success": process.returncode == 0,
            "stdout": stdout.decode("utf-8", errors="replace"),
            "stderr": stderr.decode("utf-8", errors="replace"),
            "exit_code": process.returncode,
        }
    except Exception as e:
        logger.error("Code execution failed: %s", e)
        return {
            "success": False,
            "error": str(e),
            "stdout": "",
            "stderr": "",
            "exit_code": -1,
        }


# ────────────────────────────────────────────────────────────────
# data_retrieval tool
# ────────────────────────────────────────────────────────────────

# Whitelist of tables that agents can query
ALLOWED_TABLES = {
    "users",
    "ai_agent_states",
    "ai_agent_tasks",
    "ai_task_outcomes",
}


@tool_registry.register(
    name="data_retrieval",
    description="Retrieve structured data from the database (read-only, whitelisted tables)",
    parameters_schema={
        "type": "object",
        "properties": {
            "table": {
                "type": "string",
                "description": f"Table name (allowed: {', '.join(ALLOWED_TABLES)})",
            },
            "filters": {
                "type": "object",
                "description": "Filters as JSON object, e.g. {\"status\": \"completed\"}",
                "default": {},
            },
            "limit": {
                "type": "integer",
                "description": "Maximum rows to return (default 20, max 100)",
                "default": 20,
            },
        },
        "required": ["table"],
    },
)
async def data_retrieval(table: str, filters: dict | None = None, limit: int = 20) -> dict:
    """Retrieve data from the database."""
    try:
        # Security: whitelist tables
        if table not in ALLOWED_TABLES:
            return {
                "success": False,
                "error": f"Table '{table}' not allowed. Allowed: {ALLOWED_TABLES}",
                "data": [],
            }

        limit = min(limit, 100)  # Cap at 100 rows
        filters = filters or {}

        from sqlalchemy import text, select

        from app.database import async_session

        async with async_session() as db:
            # Build dynamic query (simplified, safe version)
            query = f"SELECT * FROM {table}"
            where_clauses = []

            for key, value in filters.items():
                # Basic sanitization: ensure key is alphanumeric
                if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", key):
                    continue
                where_clauses.append(f"{key} = :fv_{key}")

            if where_clauses:
                query += " WHERE " + " AND ".join(where_clauses)

            query += f" LIMIT {limit}"

            # Execute query
            result = await db.execute(text(query), {f"fv_{k}": v for k, v in filters.items()})
            rows = result.fetchall()

            return {
                "success": True,
                "table": table,
                "filters": filters,
                "rows": [dict(row._mapping) for row in rows],
                "count": len(rows),
            }
    except Exception as e:
        logger.error("Data retrieval failed for table '%s': %s", table, e)
        return {
            "success": False,
            "error": str(e),
            "data": [],
        }


def register_builtin_tools() -> None:
    """Initialize all built-in tools (called at app startup)."""
    logger.info(
        "Registered %d built-in tools: %s",
        len(tool_registry.list_tools()),
        [t.name for t in tool_registry.list_tools()],
    )
