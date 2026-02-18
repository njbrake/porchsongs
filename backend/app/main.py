import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from starlette.middleware.base import BaseHTTPMiddleware

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

    # Migrate profiles table
    if "profiles" in inspector.get_table_names():
        existing = {col["name"] for col in inspector.get_columns("profiles")}
        with engine.begin() as conn:
            if "description" not in existing:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN description TEXT"))
                logger.info("Migrated profiles: added 'description' column")


_run_migrations()

app = FastAPI(title="porchsongs", version="1.0.0")


class OptionalBearerAuth(BaseHTTPMiddleware):
    """Gate /api/ routes behind a bearer token when APP_SECRET is configured."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        # Only gate /api/ routes
        if settings.app_secret and request.url.path.startswith("/api/"):
            auth = request.headers.get("authorization", "")
            expected = f"Bearer {settings.app_secret}"
            if auth != expected:
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        return await call_next(request)  # type: ignore[call-arg]


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

# Serve the React build output (frontend/dist) if it exists, otherwise serve frontend/ directly.
# Client-side routes (/library, /profile, /rewrite) need to return index.html so the SPA
# can handle routing. StaticFiles(html=True) only does this for "/", not sub-paths, so we
# add explicit fallback routes for the known SPA paths before mounting static files.
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
_static_dir = frontend_dist if frontend_dist.exists() else (frontend_dir if frontend_dir.exists() else None)

if _static_dir is not None:
    _index_html = _static_dir / "index.html"

    @app.get("/rewrite")
    @app.get("/library")
    @app.get("/profile")
    async def _spa_fallback() -> HTMLResponse:
        """Serve index.html for SPA client-side routes."""
        return HTMLResponse(_index_html.read_text())

    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="frontend")
