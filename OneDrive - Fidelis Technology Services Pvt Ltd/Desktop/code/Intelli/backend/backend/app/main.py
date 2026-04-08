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
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, check_db_health, engine
import app.shared.models  # noqa: F401
from app.core.analytics.sentiment_router import router as sentiment_router
from app.core.ai_orchestration.agent_router import router as agent_router
from app.core.ai_orchestration.explainability_router import router as xai_router
from app.core.ai_orchestration.prompts.router import router as prompts_router
from app.core.ai_orchestration.rag.router import router as rag_router
from app.core.ai_orchestration.router import router as ai_router
from app.core.auth.encryption_router import router as encryption_router
from app.core.auth.rbac_router import router as rbac_router
from app.core.auth.router import router as auth_router
from app.core.gateway.realtime import router as realtime_router
from app.core.notifications.router import router as notifications_router
from app.core.data_infra.router import router as vector_router
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

    # Create ingestion-layer tables (separate Base)
    from app.stream.macropulse.ingestion.db.session import Base as IngestionBase, get_engine as get_ingestion_engine
    import app.stream.macropulse.ingestion.models.alerts  # noqa: F401
    import app.stream.macropulse.ingestion.models.commodity_prices  # noqa: F401
    import app.stream.macropulse.ingestion.models.fx_rates  # noqa: F401
    import app.stream.macropulse.ingestion.models.guardrail_violations  # noqa: F401
    import app.stream.macropulse.ingestion.models.hitl_queue  # noqa: F401
    import app.stream.macropulse.ingestion.models.macro_rates  # noqa: F401
    import app.stream.macropulse.ingestion.models.news_articles  # noqa: F401
    import app.stream.macropulse.ingestion.models.residency_violations  # noqa: F401
    import app.stream.macropulse.ingestion.models.tenant_profile  # noqa: F401
    ingestion_engine = get_ingestion_engine("DEFAULT")
    async with ingestion_engine.begin() as conn:
        await conn.run_sync(IngestionBase.metadata.create_all)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}


@app.get("/health/db")
async def db_health_check():
    return await check_db_health()


app.include_router(auth_router)
app.include_router(rbac_router)
app.include_router(encryption_router)
app.include_router(ai_router)
app.include_router(agent_router)
app.include_router(prompts_router)
app.include_router(xai_router)
app.include_router(rag_router)
app.include_router(notifications_router)
app.include_router(sentiment_router)
app.include_router(monitoring_router)
app.include_router(realtime_router)

if settings.ENABLE_DEPOT_MODULES:
    from app.depot.vision.camera import router as camera_router
    from app.depot.vision.detection import router as detection_router
    from app.depot.vision.perimeter import router as perimeter_router
    from app.depot.inventory.core import router as inventory_router

    app.include_router(camera_router)
    app.include_router(detection_router)
    app.include_router(perimeter_router)
    app.include_router(inventory_router)

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
