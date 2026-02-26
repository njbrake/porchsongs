from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session

from ..models import User


class AuthBackend(ABC):
    """Abstract auth backend. Premium plugins implement their own."""

    @abstractmethod
    def get_auth_config(self) -> dict[str, Any]:
        """Return auth config for the frontend (method, required, etc.)."""

    @abstractmethod
    def authenticate_login(self, db: Session, credentials: dict[str, str]) -> User:
        """Validate credentials and return the authenticated User (or raise)."""

    def on_user_created(self, db: Session, user: User) -> None:  # noqa: B027
        """Hook called after a new user is created. Override to add default data."""
