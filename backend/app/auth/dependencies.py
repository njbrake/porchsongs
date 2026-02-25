from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from .app_secret import AppSecretBackend
from .loader import get_auth_backend
from .tokens import decode_access_token


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the current user from the request.

    Special case: if auth_backend is app_secret and APP_SECRET is not set,
    auto-return the local user (zero-config dev mode).
    """
    backend = get_auth_backend()

    # Zero-config dev mode: no APP_SECRET set with app_secret backend
    if isinstance(backend, AppSecretBackend) and not settings.app_secret:
        return backend.get_local_user(db)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header[7:]

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user
