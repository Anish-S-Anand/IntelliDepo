"""
Intelli Platform — Rate Limiting Service
Feature: AUTH-6.2

Redis-backed sliding window rate limiter for login, registration, and other endpoints.
"""
import redis.asyncio as aioredis
from fastapi import HTTPException, status, Request
from fastapi.responses import Response


class RateLimiter:
    """Redis-based sliding window rate limiter."""

    @staticmethod
    async def check(
        redis: aioredis.Redis,
        key: str,
        limit: int,
        window: int,
    ) -> tuple[bool, int]:
        """Check rate limit using sliding window algorithm.

        Args:
            redis: Redis async client
            key: Unique key for rate limiting (e.g., "login:192.168.1.1")
            limit: Max requests allowed
            window: Time window in seconds

        Returns:
            (is_allowed, retry_after_seconds)
        """
        current_count = await redis.incr(key)

        if current_count == 1:
            # First request in this window, set expiry
            await redis.expire(key, window)
            return True, 0
        elif current_count <= limit:
            # Within limit
            return True, 0
        else:
            # Over limit — get TTL for Retry-After header
            ttl = await redis.ttl(key)
            retry_after = max(1, ttl)  # At least 1 second
            return False, retry_after


async def rate_limit_dependency(
    request: Request,
    redis: aioredis.Redis,
    limit: int,
    window: int,
) -> None:
    """FastAPI dependency for rate limiting.

    Usage:
        @app.post("/login")
        async def login(
            body: LoginRequest,
            _: None = Depends(lambda r=Depends(get_redis): rate_limit_dependency(request, r, 5, 60))
        ):
            ...
    """
    # Use client IP as key component
    client_ip = request.client.host if request.client else "unknown"
    key = f"rl:{request.url.path}:{client_ip}"

    allowed, retry_after = await RateLimiter.check(redis, key, limit, window)

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def create_rate_limit_dependency(limit: int, window: int):
    """Factory to create a rate limit dependency with specific limits.

    Usage:
        from app.core.auth.rate_limiting.limiter import create_rate_limit_dependency
        from app.core.redis_client import get_redis

        login_rate_limit = create_rate_limit_dependency(5, 60)  # 5 per 60 seconds

        @app.post("/login")
        async def login(
            body: LoginRequest,
            _: None = Depends(login_rate_limit),
            db: AsyncSession = Depends(get_db),
        ):
            ...
    """

    async def _rate_limit(request: Request, redis=Depends(get_redis)):
        await rate_limit_dependency(request, redis, limit, window)

    return _rate_limit


# Common rate limit factories
def get_redis():
    """Placeholder — should be replaced with actual dependency."""
    from app.core.redis_client import get_redis as _get_redis
    return _get_redis()
