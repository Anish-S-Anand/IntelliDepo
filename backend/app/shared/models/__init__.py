"""
Intelli Platform — Model Registry

Import all models here so Alembic and Base.metadata can discover them.
Add new models as they are built.
"""
from app.shared.models.user import User  # noqa: F401
from app.shared.models.rbac import Role, Permission  # noqa: F401

# AI Orchestration (Layer 7)
from app.core.ai_orchestration.prompts.models import (  # noqa: F401
    PromptTemplate,
    PromptVersion,
    PromptExperiment,
)
from app.core.ai_orchestration.persistence.models import (  # noqa: F401
    PersistedAgentState,
    PersistedTask,
    TaskOutcome,
)

# Observability (Layer 6)
from app.core.observability.audit import AuditLog  # noqa: F401

# Auth enterprise models (Layer 6)
from app.core.auth.sessions.models import Session as AuthSession  # noqa: F401
from app.core.auth.api_keys.models import APIKey  # noqa: F401
from app.core.auth.oauth.models import OAuthAccount  # noqa: F401

# Intelli Stream
from app.stream.data.models import CompanyFinancial, ClientPortfolio  # noqa: F401
from app.stream.competelens.models import EarningsTranscript  # noqa: F401
from app.stream.scenario.models import Scenario, SensitivityConfig  # noqa: F401

# Intelli Depot
from app.depot.vision.camera import Camera  # noqa: F401
from app.depot.vision.detection import DetectionModel, DetectionRun, DetectedObject  # noqa: F401
from app.depot.vision.perimeter import PerimeterZone, PerimeterBreach  # noqa: F401
from app.depot.inventory.core import SKU, InventoryItem, StockMovement  # noqa: F401

__all__ = [
    "User", "Role", "Permission",
    "PromptTemplate", "PromptVersion", "PromptExperiment",
    "PersistedAgentState", "PersistedTask", "TaskOutcome",
    "AuditLog",
    "AuthSession", "APIKey", "OAuthAccount",
    "CompanyFinancial", "ClientPortfolio", "EarningsTranscript",
    "Scenario", "SensitivityConfig",
    "Camera", "DetectionModel", "DetectionRun", "DetectedObject",
    "PerimeterZone", "PerimeterBreach",
    "SKU", "InventoryItem", "StockMovement",
]
