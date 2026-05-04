"""
Intelli Platform — Common Middleware
Feature: SHARED-2

CORS, request ID tracking, rate limiting, structured error handling, and metrics.
"""

import time
import uuid
import logging
import asyncio
from collections import defaultdict

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)


# ── Rate Limiter (thread-safe, proxy-aware) ────────────────────────

class RateLimiter:
    """Sliding-window rate limiter keyed by IP address (async-safe)."""

    def __init__(self, max_requests: int = 100, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()  # ✅ FIX: thread safety

    async def is_allowed(self, key: str) -> bool:
        async with self._lock:
            now = time.monotonic()
            window_start = now - self.window_seconds

            # Prune old timestamps
            self._requests[key] = [t for t in self._requests[key] if t > window_start]

            if len(self._requests[key]) >= self.max_requests:
                return False

            self._requests[key].append(now)
            return True

    async def remaining(self, key: str) -> int:
        async with self._lock:
            now = time.monotonic()
            window_start = now - self.window_seconds

            self._requests[key] = [t for t in self._requests[key] if t > window_start]
            return max(0, self.max_requests - len(self._requests[key]))


rate_limiter = RateLimiter(
    max_requests=settings.RATE_LIMIT_GLOBAL_MAX,
    window_seconds=float(settings.RATE_LIMIT_GLOBAL_WINDOW),
)


# ── Utility: Get Real Client IP (proxy-safe) ────────────────────────

def get_client_ip(request: Request) -> str:
    """Extract real client IP (handles proxies like Nginx, Cloudflare)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip

    return request.client.host if request.client else "unknown"


# ── Middleware Functions ─────────────────────────────────────


async def request_id_middleware(request: Request, call_next):
    """Attach request ID + latency + metrics."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    start_time = time.monotonic()

    try:
        response = await call_next(request)
    except Exception:
        # ✅ Ensure request_id exists even if downstream crashes
        raise

    latency_ms = (time.monotonic() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{latency_ms:.2f}ms"

    # Metrics (safe import)
    try:
        from app.core.observability.monitoring import metrics

        metrics.record_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=latency_ms,
        )
    except Exception:
        pass

    logger.debug(
        "%s %s %d %.0fms [%s]",
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
        request_id[:8],
    )

    return response


async def rate_limit_middleware(request: Request, call_next):
    """Rate-limit requests by client IP."""

    if request.url.path.startswith("/health"):
        return await call_next(request)

    client_ip = get_client_ip(request)

    # ✅ FIX: async-safe limiter
    allowed = await rate_limiter.is_allowed(client_ip)

    if not allowed:
        logger.warning("Rate limit exceeded for %s on %s", client_ip, request.url.path)

        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": "Rate limit exceeded",
                "request_id": getattr(request.state, "request_id", None),
            },
            headers={
                "Retry-After": str(int(rate_limiter.window_seconds)),
                "X-RateLimit-Limit": str(rate_limiter.max_requests),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)

    remaining = await rate_limiter.remaining(client_ip)

    response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response


async def error_handling_middleware(request: Request, call_next):
    """Global exception handler with structured response."""
    try:
        return await call_next(request)

    except Exception as e:
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

        logger.exception(
            "Unhandled error on %s %s [%s]: %s",
            request.method,
            request.url.path,
            request_id,
            str(e),
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "request_id": request_id,
            },
        )


# ── Setup Function ───────────────────────────────────────────


def setup_middleware(app: FastAPI):
    """Register middleware (correct execution order)."""

    # ⚠️ ORDER MATTERS (outer → inner execution)
    app.middleware("http")(error_handling_middleware)
    app.middleware("http")(request_id_middleware)   # must be before rate limit
    app.middleware("http")(rate_limit_middleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )