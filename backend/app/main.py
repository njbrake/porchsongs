import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from .config import settings
from .database import Base, engine
from .routers import profiles, rewrite, songs

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


def _run_migrations():
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


_run_migrations()

app = FastAPI(title="porchsongs", version="1.0.0")

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

# Serve the React build output (frontend/dist) if it exists, otherwise serve frontend/ directly
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
elif frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
