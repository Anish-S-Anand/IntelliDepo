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
    if settings.ENABLE_STREAM_MODULES:
        # Seed stream sample data (STR-API-1)
        from app.stream.data.service import StreamDataService
        async with async_session() as db:
            await StreamDataService(db).seed_if_empty()
    # Initialize vector store (DATA-5.2)
    from app.core.data_infra.vector_db import init_vector_store
    await init_vector_store()
    # Seed MacroPulse market docs index (Day 1 — Pranisree)
    if settings.ENABLE_STREAM_MODULES:
        from app.stream.macropulse.vector_setup import validate_and_seed_index
        await validate_and_seed_index()
    # Seed Depot demo data (cameras, gates, vehicles, zones, etc.) if tables are empty
    if settings.ENABLE_DEPOT_MODULES:
        try:
            from app.depot.seed import seed_database
            from app.config import settings as _s
            await seed_database(_s.DATABASE_URL)
        except Exception as e:
            logging.getLogger("intelli.depot.seed").warning(f"Depot seed skipped: {e}")
        # Auto-reconnect cameras in parallel with 5s timeout each
        try:
            from app.depot.vision.camera import Camera, stream_connect
            from sqlalchemy import select
            import asyncio as _asyncio
            _cam_log = logging.getLogger("intelli.depot.vision")
            async with async_session() as db:
                result = await db.execute(select(Camera).where(Camera.is_active == True))
                cams = result.scalars().all()
            _cam_log.info(f"Auto-reconnecting {len(cams)} camera(s) on startup…")

            async def _reconnect_one(cam):
                try:
                    ok = await stream_connect(str(cam.id), cam.stream_url, cam.zone or "")
                    _cam_log.info(f"  {'✓' if ok else '✗'} {cam.name}")
                except Exception as ce:
                    _cam_log.warning(f"  ✗ {cam.name}: {ce}")

            # Run camera reconnects in the background — don't block startup
            async def _reconnect_all():
                await _asyncio.gather(*[_reconnect_one(c) for c in cams])
            _asyncio.create_task(_reconnect_all())
        except Exception as e:
            logging.getLogger("intelli.depot.vision").warning(f"Camera auto-reconnect skipped: {e}")
        # Log available local depot videos
        try:
            from app.depot.vision.video_library import list_available_videos
            available = [v for v in list_available_videos() if v["available"]]
            logging.getLogger("intelli.depot.video_library").info(
                f"Local depot videos: {len(available)} available"
            )
        except Exception as e:
            logging.getLogger("intelli.depot.video_library").warning(f"Video library check skipped: {e}")
        # Start real-time bag counting pipeline
        try:
            from app.depot.vision.realtime_counter import start_realtime_counting
            _asyncio.create_task(start_realtime_counting())
            logging.getLogger("intelli.depot.realtime_counter").info("Real-time counting pipeline auto-started")
        except Exception as e:
            logging.getLogger("intelli.depot.realtime_counter").warning(f"Real-time counting start skipped: {e}")
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

    from app.depot.vision.realtime_counter import router as realtime_counter_router
    from app.depot.vision.training import router as training_router
    app.include_router(realtime_counter_router)
    app.include_router(training_router)

    # IntelliOps modules
    from app.depot.ops.live_monitoring import router as ops_monitoring_router
    from app.depot.ops.operations import router as ops_operations_router
    from app.depot.ops.scorecards import router as ops_scorecards_router
    from app.depot.ops.incidents import router as ops_incidents_router
    from app.depot.ops.fleet_yard import router as ops_fleet_router
    app.include_router(ops_monitoring_router)
    app.include_router(ops_operations_router)
    app.include_router(ops_scorecards_router)
    app.include_router(ops_incidents_router)
    app.include_router(ops_fleet_router)

from app.core.data_infra.storage_router import router as storage_router

app.include_router(vector_router)
app.include_router(storage_router)
if settings.ENABLE_STREAM_MODULES:
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
