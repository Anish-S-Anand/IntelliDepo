"""
Redis client stub for testing.
This module provides a minimal Redis client interface for the application.
"""

_redis_client = None


async def get_redis():
    """Get the Redis client instance."""
    return _redis_client
