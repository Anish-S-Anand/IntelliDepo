"""
Intelli Platform — Domain-Specific Agent Types
Feature: AI-7.2-domain-agents

Pre-configured agent blueprints for specific business domains.
"""
from app.core.ai_orchestration.agent_models import AgentCapability, AgentConfig
from app.stream.macropulse.agent import get_macropulse_agent_config

# Pre-configured agent types for different domains
DOMAIN_AGENT_CONFIGS = [
    AgentConfig(
        agent_type="supervisor",
        display_name="Supervisor Agent",
        system_prompt=(
            "You are a supervisor AI agent. Your role is to evaluate candidate responses to tasks, "
            "assess their correctness, completeness, and quality. If the candidate response is adequate, "
            "confirm it. Otherwise, provide an improved version based on best practices. Be objective and fair."
        ),
        capabilities=[AgentCapability.REASONING, AgentCapability.ANALYSIS],
        model="gpt-4o",
        temperature=0.3,
        max_tokens=2048,
        confidence_threshold=0.85,
    ),
    AgentConfig(
        agent_type="recruiter_screener",
        display_name="Recruiter Screening Agent",
        system_prompt=(
            "You are an expert HR screening agent for IntelliRecruit. You analyze candidate profiles, "
            "extract key qualifications, score candidates against job requirements, and provide structured "
            "hiring recommendations with clear reasoning."
        ),
        capabilities=[
            AgentCapability.EXTRACTION,
            AgentCapability.CLASSIFICATION,
            AgentCapability.ANALYSIS,
        ],
        enabled_tools=["vector_db_query", "data_retrieval"],
        model="gpt-4o",
        temperature=0.5,
        max_tokens=2048,
        confidence_threshold=0.75,
    ),
    AgentConfig(
        agent_type="inventory_optimizer",
        display_name="Inventory Optimization Agent",
        system_prompt=(
            "You are a supply chain and inventory optimization agent for IntelliDepot. You analyze stock levels, "
            "demand forecasts, and reorder thresholds to generate actionable optimization recommendations. "
            "Focus on cost reduction and service level improvement."
        ),
        capabilities=[AgentCapability.ANALYSIS, AgentCapability.REASONING],
        enabled_tools=["data_retrieval"],
        model="gpt-4o",
        temperature=0.4,
        max_tokens=2048,
        confidence_threshold=0.80,
    ),
    AgentConfig(
        agent_type="menu_analyst",
        display_name="Menu & Demand Analyst",
        system_prompt=(
            "You are a restaurant analytics agent for IntelliCafe. You analyze sales data, "
            "predict demand patterns, optimize menu pricing, and flag low-performing items. "
            "Provide data-driven recommendations for menu optimization."
        ),
        capabilities=[AgentCapability.ANALYSIS, AgentCapability.CLASSIFICATION],
        enabled_tools=["data_retrieval"],
        model="gpt-4o",
        temperature=0.4,
        max_tokens=2048,
        confidence_threshold=0.72,
    ),
    AgentConfig(
        agent_type="document_extractor",
        display_name="Document Extraction Agent",
        system_prompt=(
            "You are a structured data extraction specialist. Given raw document text "
            "(contracts, invoices, reports, emails), you extract named entities, key fields, and "
            "structured data in JSON format. Be precise and complete in your extraction."
        ),
        capabilities=[AgentCapability.EXTRACTION],
        enabled_tools=["web_search"],
        model="gpt-4o",
        temperature=0.3,
        max_tokens=2048,
        confidence_threshold=0.78,
    ),
    AgentConfig(
        agent_type="code_assistant",
        display_name="Code Assistant Agent",
        system_prompt=(
            "You are an expert software engineering agent. You write, review, debug, and explain code. "
            "You prefer Python and TypeScript. Follow PEP 8 and best practices. Always prefer clarity and maintainability."
        ),
        capabilities=[AgentCapability.CODE_GENERATION],
        enabled_tools=["code_executor", "web_search"],
        model="gpt-4o",
        temperature=0.3,
        max_tokens=4096,
        confidence_threshold=0.70,
    ),
    get_macropulse_agent_config(),
]


def register_default_agent_types(orchestrator) -> None:
    """Register all domain agent types with the orchestrator at startup."""
    for config in DOMAIN_AGENT_CONFIGS:
        orchestrator.register_agent_type(config)
    print(
        f"Registered {len(DOMAIN_AGENT_CONFIGS)} domain agent types: "
        f"{[c.agent_type for c in DOMAIN_AGENT_CONFIGS]}"
    )
