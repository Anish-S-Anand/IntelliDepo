"""
Intelli Platform — Common Middleware
Feature: SHARED-2

CORS, request ID tracking, rate limiting, structured error handling, and metrics.
"""
import time
import uuid
import logging
from collections import defaultdict

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)


# ── Rate Limiter (in-memory, per-IP) ────────────────────────

class RateLimiter:
    """Simple sliding-window rate limiter keyed by IP address."""

    def __init__(self, max_requests: int = 100, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        window_start = now - self.window_seconds
        # Prune old entries
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        if len(self._requests[key]) >= self.max_requests:
            return False
        self._requests[key].append(now)
        return True

    def remaining(self, key: str) -> int:
        now = time.monotonic()
        window_start = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        return max(0, self.max_requests - len(self._requests[key]))


rate_limiter = RateLimiter(max_requests=100, window_seconds=60.0)


# ── Middleware Functions ─────────────────────────────────────

async def request_id_middleware(request: Request, call_next):
    """Adds a unique Request-ID to every request/response header for tracing."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    start_time = time.monotonic()
    response = await call_next(request)
    latency_ms = (time.monotonic() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{latency_ms:.2f}ms"

    # Record metrics if monitoring is available
    try:
        from app.core.observability.monitoring import metrics
        metrics.record_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=latency_ms,
        )
    except ImportError:
        pass

    logger.debug(
        "%s %s %d %.0fms [%s]",
        request.method, request.url.path, response.status_code, latency_ms, request_id[:8],
    )

    return response


async def rate_limit_middleware(request: Request, call_next):
    """Rate-limit requests by client IP address."""
    # Skip rate limiting for health checks
    if request.url.path.startswith("/health"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"

    if not rate_limiter.is_allowed(client_ip):
        logger.warning("Rate limit exceeded for IP %s on %s", client_ip, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please retry later."},
            headers={
                "Retry-After": str(int(rate_limiter.window_seconds)),
                "X-RateLimit-Limit": str(rate_limiter.max_requests),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(rate_limiter.max_requests)
    response.headers["X-RateLimit-Remaining"] = str(rate_limiter.remaining(client_ip))
    return response


async def error_handling_middleware(request: Request, call_next):
    """Catch unhandled exceptions and return structured JSON error responses."""
    try:
        return await call_next(request)
    except Exception as e:
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception("Unhandled error on %s %s [%s]: %s", request.method, request.url.path, request_id, e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "request_id": request_id,
            },
        )


# ── Setup Function ───────────────────────────────────────────

def setup_middleware(app: FastAPI):
    """Configure all global middleware in the correct order.

    Order matters: outermost middleware runs first.
    Error handling → Rate limiting → Request ID → CORS
    """
    # Error handling wraps everything
    app.middleware("http")(error_handling_middleware)

    # Rate limiting
    app.middleware("http")(rate_limit_middleware)

    # Request ID and latency tracking
    app.middleware("http")(request_id_middleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
