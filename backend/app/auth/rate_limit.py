"""Simple in-memory rate limiter for auth endpoints."""

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    """Sliding-window rate limiter keyed by client IP."""

    def __init__(self, max_attempts: int = 10, window_seconds: int = 60) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def check(self, request: Request) -> None:
        """Raise 429 if the client has exceeded the rate limit."""
        ip = self._client_ip(request)
        now = time.monotonic()
        cutoff = now - self.window_seconds

        # Prune old entries
        self._attempts[ip] = [t for t in self._attempts[ip] if t > cutoff]

        if len(self._attempts[ip]) >= self.max_attempts:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please try again later.",
            )

        self._attempts[ip].append(now)


# Shared instance for auth endpoints: 10 attempts per 60 seconds
auth_rate_limiter = RateLimiter(max_attempts=10, window_seconds=60)
