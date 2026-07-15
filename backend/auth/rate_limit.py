"""In-memory sliding-window rate limiter for the login endpoint.

Scope: POC only. Not distributed-safe — resets on server restart.
Limit: 5 attempts per 60s window per IP.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

WINDOW_SECONDS = 60
MAX_ATTEMPTS = 5

_attempts: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def check_and_record(ip: str) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds).

    Records an attempt if allowed. Retry-after is 0 when allowed.
    """
    now = time.time()
    cutoff = now - WINDOW_SECONDS
    with _lock:
        q = _attempts[ip]
        # drop expired entries
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= MAX_ATTEMPTS:
            retry_after = int(WINDOW_SECONDS - (now - q[0])) + 1
            return False, retry_after
        q.append(now)
        return True, 0


def reset_ip(ip: str) -> None:
    with _lock:
        _attempts.pop(ip, None)
