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

app = FastAPI(title="PorchSongs", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router, prefix="/api")
app.include_router(songs.router, prefix="/api")
app.include_router(rewrite.router, prefix="/api")

frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
