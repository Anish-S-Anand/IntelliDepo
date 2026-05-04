"""
Intelli Platform — Rate Limiting Service
Feature: AUTH-6.2

In-memory sliding window rate limiter.
"""
import time
from collections import defaultdict
from fastapi import HTTPException, status, Request, Depends


# In-memory store: key -> list of timestamps
_rate_store: dict[str, list[float]] = defaultdict(list)


class RateLimiter:
    """In-memory sliding window rate limiter."""

    @staticmethod
    def check(
        key: str,
        limit: int,
        window: int,
    ) -> tuple[bool, int]:
        now = time.time()
        cutoff = now - window

        # Remove expired entries
        _rate_store[key] = [t for t in _rate_store[key] if t > cutoff]

        if len(_rate_store[key]) < limit:
            _rate_store[key].append(now)
            return True, 0
        else:
            oldest = _rate_store[key][0]
            retry_after = max(1, int(oldest + window - now))
            return False, retry_after


def create_rate_limit_dependency(limit: int, window: int):
    """Factory to create a rate limit dependency with specific limits."""

    async def _rate_limit(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        key = f"rl:{request.url.path}:{client_ip}"

        allowed, retry_after = RateLimiter.check(key, limit, window)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )

    return _rate_limit
