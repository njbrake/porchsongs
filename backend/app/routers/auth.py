from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.loader import get_auth_backend
from ..auth.rate_limit import auth_rate_limiter
from ..auth.tokens import create_access_token, create_refresh_token
from ..database import get_db
from ..models import RefreshToken, User
from ..schemas import (
    LoginRequest,
    OkResponse,
    RefreshRequest,
    RefreshResponse,
    TokenResponse,
    UserOut,
)

router = APIRouter(tags=["auth"])


@router.get("/auth/config")
async def auth_config() -> dict[str, object]:
    """Return auth configuration for the frontend."""
    backend = get_auth_backend()
    return backend.get_auth_config()


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate and return JWT + refresh token."""
    auth_rate_limiter.check(request)
    backend = get_auth_backend()
    user = backend.authenticate_login(db, {"password": body.password})

    access_token = create_access_token(user.id, user.email, user.role)
    refresh_token_str, expires_at = create_refresh_token()

    rt = RefreshToken(
        token=refresh_token_str,
        user_id=user.id,
        expires_at=expires_at,
    )
    db.add(rt)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        user=UserOut.model_validate(user),
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: Session = Depends(get_db),
) -> RefreshResponse:
    """Exchange a refresh token for a new JWT + new refresh token (rotation)."""
    auth_rate_limiter.check(request)
    rt = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == body.refresh_token,
            RefreshToken.revoked.is_(False),
        )
        .first()
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    if not rt or rt.expires_at.replace(tzinfo=None) < now:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Revoke old token
    rt.revoked = True

    user = db.query(User).filter(User.id == rt.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Issue new tokens
    access_token = create_access_token(user.id, user.email, user.role)
    new_refresh_str, new_expires_at = create_refresh_token()

    new_rt = RefreshToken(
        token=new_refresh_str,
        user_id=user.id,
        expires_at=new_expires_at,
    )
    db.add(new_rt)
    db.commit()

    return RefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_str,
    )


@router.post("/auth/logout", response_model=OkResponse)
async def logout(
    body: RefreshRequest,
    db: Session = Depends(get_db),
) -> OkResponse:
    """Revoke a refresh token."""
    rt = db.query(RefreshToken).filter(RefreshToken.token == body.refresh_token).first()
    if rt:
        rt.revoked = True
        db.commit()
    return OkResponse(ok=True)


@router.get("/auth/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return current user info."""
    return current_user
