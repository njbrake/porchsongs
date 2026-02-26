import importlib
from typing import Any

from ..config import settings
from .base import AuthBackend

_backend: AuthBackend | None = None


def get_auth_backend() -> AuthBackend | None:
    """Return the singleton auth backend instance, or None in OSS mode."""
    global _backend
    if _backend is not None:
        return _backend

    if settings.premium_plugin:
        module = importlib.import_module(settings.premium_plugin)
        factory: Any = module.get_auth_backend
        _backend = factory()

    return _backend


def reset_auth_backend() -> None:
    """Reset the singleton (for testing)."""
    global _backend
    _backend = None
