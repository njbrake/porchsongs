import hmac
from datetime import UTC, datetime
from typing import Any

import bcrypt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Profile, User
from .base import AuthBackend

LOCAL_EMAIL = "local@porchsongs.local"


def _verify_password(plain: str, stored: str) -> bool:
    """Compare plain password against stored value.

    If ``stored`` looks like a bcrypt hash (starts with ``$2``), use bcrypt.
    Otherwise fall back to constant-time plaintext comparison.
    """
    if stored.startswith("$2"):
        return bcrypt.checkpw(plain.encode(), stored.encode())
    return hmac.compare_digest(plain, stored)


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


class AppSecretBackend(AuthBackend):
    """OSS single-user auth backend gated by APP_SECRET env var."""

    def get_auth_config(self) -> dict[str, Any]:
        return {
            "method": "password",
            "required": settings.app_secret is not None,
        }

    def authenticate_login(self, db: Session, credentials: dict[str, str]) -> User:
        password = credentials.get("password", "")
        if not settings.app_secret or not _verify_password(password, settings.app_secret):
            raise HTTPException(status_code=401, detail="Invalid password")
        return self._get_or_create_local_user(db)

    def on_user_created(self, db: Session, user: User) -> None:
        """Create a default profile for the local user."""
        profile = Profile(
            user_id=user.id,
            name="Default",
            is_default=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(profile)
        db.commit()

    def get_local_user(self, db: Session) -> User:
        """Get or create the local user (for zero-config dev mode)."""
        return self._get_or_create_local_user(db)

    def _get_or_create_local_user(self, db: Session) -> User:
        user = db.query(User).filter(User.email == LOCAL_EMAIL).first()
        if user:
            return user
        user = User(
            email=LOCAL_EMAIL,
            name="Local User",
            role="admin",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        self.on_user_created(db, user)
        return user
