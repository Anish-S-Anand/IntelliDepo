"""
Intelli Platform - FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
import logging
from pathlib import Path
import sys


def _preload_installed_cryptography() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    original_sys_path = sys.path.copy()
    try:
        sys.path = [entry for entry in sys.path if Path(entry or ".").resolve() != backend_root]
        import cryptography  # noqa: F401
    finally:
        sys.path = original_sys_path


_preload_installed_cryptography()

from fastapi import FastAPI

from app.config import settings
from app.database import Base, check_db_health, engine
import app.shared.models  # noqa: F401
from app.shared.middleware.handlers import setup_middleware
from app.core.analytics.sentiment_router import router as sentiment_router
from app.core.ai_orchestration.agent_router import router as agent_router
from app.core.ai_orchestration.explainability_router import router as xai_router
from app.core.ai_orchestration.prompts.router import router as prompts_router
from app.core.ai_orchestration.rag.router import router as rag_router
from app.core.ai_orchestration.router import router as ai_router
from app.core.auth.encryption_router import router as encryption_router
from app.core.auth.rbac_router import router as rbac_router
from app.core.auth.router import router as auth_router
from app.core.auth.sessions.router import router as sessions_router
from app.core.auth.api_keys.router import router as api_keys_router
from app.core.auth.mfa.router import router as mfa_router
from app.core.auth.oauth.router import router as oauth_router
from app.core.gateway.realtime import router as realtime_router
from app.core.notifications.router import router as notifications_router
from app.core.data_infra.router import router as vector_router
from app.core.observability.audit_router import router as audit_router
from app.core.observability import audit as audit_module  # noqa: F401
from app.core.observability.monitoring import router as monitoring_router
from app.stream.data.sample_data_api import router as stream_data_router
import app.stream.macropulse  # noqa: F401
from app.stream.macropulse.router import router as macropulse_router
from app.stream.macropulse.ingestion.api.alert_engine import router as alerts_router
from app.stream.macropulse.ingestion.api.guardrails_runtime import router as guardrails_router
from app.stream.macropulse.ingestion.api.routes.dashboard import router as dashboard_router
from app.stream.macropulse.ingestion.api.routes.hitl import router as hitl_router
from app.stream.macropulse.ingestion.api.routes.tenant import router as tenant_router
from app.stream.scenario.api import router as scenario_router
import app.stream.scenario.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.core.auth.rbac import seed_default_roles
    from app.database import async_session

    async with async_session() as db:
        await seed_default_roles(db)
    # Seed stream sample data (STR-API-1)
    from app.stream.data.service import StreamDataService
    async with async_session() as db:
        await StreamDataService(db).seed_if_empty()
    # Initialize vector store (DATA-5.2)
    from app.core.data_infra.vector_db import init_vector_store
    await init_vector_store()
    # Seed MacroPulse market docs index (Day 1 — Pranisree)
    from app.stream.macropulse.vector_setup import validate_and_seed_index
    await validate_and_seed_index()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Intelli Platform - AI-native enterprise suite by Fidelis Digital",
    lifespan=lifespan,
)

setup_middleware(app)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}


@app.get("/health/db")
async def db_health_check():
    return await check_db_health()


app.include_router(auth_router)
app.include_router(rbac_router)
app.include_router(encryption_router)
app.include_router(sessions_router)
app.include_router(api_keys_router)
app.include_router(mfa_router)
app.include_router(oauth_router)
app.include_router(ai_router)
app.include_router(agent_router)
app.include_router(prompts_router)
app.include_router(xai_router)
app.include_router(rag_router)
app.include_router(notifications_router)
app.include_router(sentiment_router)
app.include_router(monitoring_router)
app.include_router(audit_router)
app.include_router(realtime_router)

if settings.ENABLE_DEPOT_MODULES:
    from app.depot.vision.camera import router as camera_router
    from app.depot.vision.detection import router as detection_router
    from app.depot.vision.perimeter import router as perimeter_router
    from app.depot.vision.counting import router as counting_router
    from app.depot.vision.cluster import router as cluster_router
    from app.depot.vision.sequencing import router as sequencing_router
    from app.depot.vision.colour_analysis import router as colour_router
    from app.depot.vision.tracking import router as tracking_router
    from app.depot.inventory.core import router as inventory_router
    from app.depot.gate.lpr import router as gate_lpr_router

    app.include_router(camera_router)
    app.include_router(detection_router)
    app.include_router(perimeter_router)
    app.include_router(counting_router)
    app.include_router(cluster_router)
    app.include_router(sequencing_router)
    app.include_router(colour_router)
    app.include_router(tracking_router)
    app.include_router(inventory_router)
    app.include_router(gate_lpr_router)

    # IntelliOps modules
    from app.depot.ops.live_monitoring import router as ops_monitoring_router
    app.include_router(ops_monitoring_router)

from app.core.data_infra.storage_router import router as storage_router

app.include_router(vector_router)
app.include_router(storage_router)
app.include_router(stream_data_router)
app.include_router(macropulse_router)
app.include_router(tenant_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(hitl_router, prefix="/api")
app.include_router(guardrails_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(scenario_router)

from app.stream.competelens.earnings_api import router as earnings_router

app.include_router(earnings_router)
