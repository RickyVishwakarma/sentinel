"""Per-tenant rate limiting (owned by the Gateway, Module M2).

Two backends behind one interface:
  * InMemoryRateLimiter (default) — a fixed-window counter, fine for a single
    process / local dev.
  * RedisRateLimiter               — shared window across replicas (RATE_LIMITER=redis).
"""

from __future__ import annotations

import threading
import time

from app.config import get_settings


class RateLimiter:
    def allow(self, tenant_id: str, limit_per_minute: int) -> bool:  # pragma: no cover
        raise NotImplementedError


class InMemoryRateLimiter(RateLimiter):
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: dict[tuple[str, int], int] = {}

    def allow(self, tenant_id: str, limit_per_minute: int) -> bool:
        window = int(time.time() // 60)
        key = (tenant_id, window)
        with self._lock:
            count = self._buckets.get(key, 0) + 1
            self._buckets[key] = count
            # Opportunistically drop stale windows so the dict doesn't grow.
            for k in [k for k in self._buckets if k[1] < window]:
                del self._buckets[k]
        return count <= limit_per_minute


class RedisRateLimiter(RateLimiter):
    def __init__(self) -> None:
        import redis  # optional dependency

        self._r = redis.from_url(get_settings().redis_url)

    def allow(self, tenant_id: str, limit_per_minute: int) -> bool:
        window = int(time.time() // 60)
        key = f"ratelimit:{tenant_id}:{window}"
        count = self._r.incr(key)
        if count == 1:
            self._r.expire(key, 60)
        return count <= limit_per_minute


_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = (
            RedisRateLimiter() if get_settings().rate_limiter == "redis" else InMemoryRateLimiter()
        )
    return _limiter
