"""
Simple in-memory rate limiter.
No external dependencies — uses a dict with timestamps.
"""

import time
import asyncio
from collections import defaultdict
from typing import Dict, Tuple


class RateLimiter:
    """
    Sliding-window rate limiter per key (IP, user_id, etc.).

    Usage:
        limiter = RateLimiter()
        ok, wait = limiter.check("login:127.0.0.1", max_requests=5, window_sec=60)
        if not ok:
            raise HTTPException(429, f"Too many requests. Try again in {wait}s")
    """

    def __init__(self):
        self._store: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def check(
        self,
        key: str,
        max_requests: int = 10,
        window_sec: int = 60,
    ) -> Tuple[bool, int]:
        """
        Check if request is within rate limit.

        Args:
            key: Unique identifier (e.g. "login:1.2.3.4")
            max_requests: Max requests allowed in the window
            window_sec: Time window in seconds

        Returns:
            (allowed: bool, retry_after_seconds: int)
        """
        now = time.time()
        async with self._lock:
            timestamps = self._store[key]

            cutoff = now - window_sec
            self._store[key] = [t for t in timestamps if t > cutoff]

            if len(self._store[key]) >= max_requests:
                oldest = min(self._store[key])
                retry_after = int(window_sec - (now - oldest))
                return False, max(retry_after, 1)

            self._store[key].append(now)
        return True, 0

    async def cleanup(self):
        """Remove expired entries periodically."""
        now = time.time()
        async with self._lock:
            for key in list(self._store.keys()):
                self._store[key] = [t for t in self._store[key] if t > now - 300]
                if not self._store[key]:
                    del self._store[key]


rate_limiter = RateLimiter()
