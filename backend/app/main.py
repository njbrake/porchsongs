import logging
from importlib.metadata import version as pkg_version
from pathlib import Path
from typing import ClassVar

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import inspect, text
from starlette.types import ASGIApp, Receive, Scope, Send

from .config import settings
from .database import Base, engine
from .routers import profiles, rewrite, songs

load_dotenv()

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


def _run_migrations() -> None:
    """Add new columns to existing tables if they don't exist yet."""
    inspector = inspect(engine)

    # Migrate songs table
    if "songs" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("songs")}
        with engine.begin() as conn:
            if "status" not in existing:
                conn.execute(text('ALTER TABLE songs ADD COLUMN status TEXT DEFAULT "draft"'))
                logger.info("Migrated songs: added 'status' column")
            if "current_version" not in existing:
                conn.execute(text("ALTER TABLE songs ADD COLUMN current_version INTEGER DEFAULT 1"))
                logger.info("Migrated songs: added 'current_version' column")
            if "folder" not in existing:
                conn.execute(text("ALTER TABLE songs ADD COLUMN folder TEXT"))
                logger.info("Migrated songs: added 'folder' column")

    # Migrate profiles table
    if "profiles" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("profiles")}
        with engine.begin() as conn:
            if "description" not in existing:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN description TEXT"))
                logger.info("Migrated profiles: added 'description' column")


_run_migrations()

try:
    __version__ = pkg_version("porchsongs")
except Exception:
    __version__ = "0.0.0-dev"

app = FastAPI(title="porchsongs", version=__version__)


class OptionalBearerAuth:
    """Pure ASGI middleware gating /api/ routes behind a bearer token.

    Uses raw ASGI instead of BaseHTTPMiddleware so StreamingResponse / SSE
    is not buffered.
    """

    _PUBLIC_PATHS: ClassVar[set[str]] = {"/api/auth-required", "/api/login", "/api/health"}

    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self._app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        if settings.app_secret and path.startswith("/api/") and path not in self._PUBLIC_PATHS:
            headers = dict(scope.get("headers", []))
            auth = headers.get(b"authorization", b"").decode()
            expected = f"Bearer {settings.app_secret}"
            if auth != expected:
                response = JSONResponse(status_code=401, content={"detail": "Unauthorized"})
                await response(scope, receive, send)
                return

        await self._app(scope, receive, send)


app.add_middleware(OptionalBearerAuth)

app.add_middleware(
    CORSMiddleware,  # type: ignore[arg-type]
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router, prefix="/api")
app.include_router(songs.router, prefix="/api")
app.include_router(rewrite.router, prefix="/api")


class LoginRequest(BaseModel):
    password: str


@app.get("/api/auth-required")
async def auth_required() -> dict[str, bool]:
    """Check whether the server requires authentication."""
    return {"required": settings.app_secret is not None}


@app.post("/api/login")
async def login(body: LoginRequest) -> JSONResponse:
    """Validate a password against APP_SECRET and return the token."""
    if not settings.app_secret or body.password != settings.app_secret:
        return JSONResponse(status_code=401, content={"detail": "Invalid password"})
    return JSONResponse(content={"ok": True, "token": settings.app_secret})


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Public health-check endpoint for container orchestration."""
    return {"status": "ok", "version": __version__}


# Serve the React build output (frontend/dist) if it exists, otherwise serve frontend/ directly.
# Client-side routes (/library, /profile, /rewrite) need to return index.html so the SPA
# can handle routing. StaticFiles(html=True) only does this for "/", not sub-paths, so we
# add explicit fallback routes for the known SPA paths before mounting static files.
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
_static_dir = (
    frontend_dist if frontend_dist.exists() else (frontend_dir if frontend_dir.exists() else None)
)

if _static_dir is not None:
    _index_html = _static_dir / "index.html"

    @app.get("/rewrite")
    @app.get("/library")
    @app.get("/library/{rest:path}")
    @app.get("/profile")
    async def _spa_fallback() -> HTMLResponse:
        """Serve index.html for SPA client-side routes."""
        return HTMLResponse(_index_html.read_text())

    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="frontend")
