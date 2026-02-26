from fastapi import APIRouter

from ..auth.loader import get_auth_backend

router = APIRouter(tags=["auth"])


@router.get("/auth/config")
async def auth_config() -> dict[str, object]:
    """Return auth configuration for the frontend.

    In OSS mode (no plugin), returns ``{method: "none", required: false}``.
    When a premium plugin is loaded it provides its own config (e.g. OAuth).
    """
    backend = get_auth_backend()
    if backend is None:
        return {"method": "none", "required": False}
    return backend.get_auth_config()
