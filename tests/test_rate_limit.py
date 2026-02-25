"""Tests for the sliding-window rate limiter."""

import time
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.auth.rate_limit import RateLimiter


def _make_request(ip: str = "1.2.3.4", forwarded: str | None = None) -> MagicMock:
    """Create a mock Request with the given client IP."""
    request = MagicMock()
    request.client = MagicMock()
    request.client.host = ip

    headers: dict[str, str] = {}
    if forwarded is not None:
        headers["X-Forwarded-For"] = forwarded
    request.headers = headers

    return request


def test_requests_under_limit_pass() -> None:
    """Requests below the max_attempts threshold should pass without error."""
    limiter = RateLimiter(max_attempts=5, window_seconds=60)
    request = _make_request()

    for _ in range(5):
        limiter.check(request)  # should not raise


def test_request_at_limit_raises_429() -> None:
    """The request that exceeds max_attempts should raise 429."""
    limiter = RateLimiter(max_attempts=3, window_seconds=60)
    request = _make_request()

    for _ in range(3):
        limiter.check(request)

    with pytest.raises(HTTPException) as exc_info:
        limiter.check(request)
    assert exc_info.value.status_code == 429


def test_old_attempts_pruned_after_window(monkeypatch: pytest.MonkeyPatch) -> None:
    """Requests pass again after the sliding window expires."""
    limiter = RateLimiter(max_attempts=2, window_seconds=1)
    request = _make_request()

    # Use up the limit
    limiter.check(request)
    limiter.check(request)

    with pytest.raises(HTTPException):
        limiter.check(request)

    # Advance time past the window by manipulating the stored timestamps
    # Set all recorded times to well in the past
    ip = limiter._client_ip(request)
    limiter._attempts[ip] = [time.monotonic() - 10]

    # Now a new request should pass (old entries pruned)
    limiter.check(request)


def test_x_forwarded_for_used() -> None:
    """X-Forwarded-For header is used for IP extraction."""
    limiter = RateLimiter(max_attempts=1, window_seconds=60)

    req1 = _make_request(ip="10.0.0.1", forwarded="203.0.113.50, 10.0.0.1")
    req2 = _make_request(ip="10.0.0.1", forwarded="198.51.100.99, 10.0.0.1")

    # Both come from the same request.client.host but different X-Forwarded-For
    limiter.check(req1)

    with pytest.raises(HTTPException):
        limiter.check(req1)  # same forwarded IP → blocked

    limiter.check(req2)  # different forwarded IP → passes


def test_missing_client_falls_back_to_unknown() -> None:
    """When request.client is None, IP falls back to 'unknown'."""
    limiter = RateLimiter(max_attempts=1, window_seconds=60)
    request = MagicMock()
    request.client = None
    request.headers = {}

    limiter.check(request)  # passes

    with pytest.raises(HTTPException):
        limiter.check(request)  # second attempt from "unknown" → blocked


def test_independent_ips_have_independent_limits() -> None:
    """Different IPs have separate rate limit counters."""
    limiter = RateLimiter(max_attempts=2, window_seconds=60)

    req_a = _make_request(ip="10.0.0.1")
    req_b = _make_request(ip="10.0.0.2")

    limiter.check(req_a)
    limiter.check(req_a)

    with pytest.raises(HTTPException):
        limiter.check(req_a)  # IP A exhausted

    # IP B should still be fine
    limiter.check(req_b)
    limiter.check(req_b)
