import secrets
from datetime import UTC, datetime, timedelta

import jwt

from ..config import settings


def create_access_token(user_id: int, email: str, role: str) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expiry_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token() -> tuple[str, datetime]:
    """Create a random refresh token and its expiry datetime."""
    token = secrets.token_hex(32)
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)
    return token, expires_at


def decode_access_token(token: str) -> dict[str, str]:
    """Decode and validate a JWT access token. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
