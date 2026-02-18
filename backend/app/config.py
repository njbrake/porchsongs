from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve data directory as an absolute path relative to the backend/ folder,
# so it works regardless of the process's current working directory (e.g. uv run).
_backend_dir = Path(__file__).resolve().parent.parent
_data_dir = _backend_dir / "data"
_data_dir.mkdir(exist_ok=True)
_default_db = f"sqlite:///{_data_dir / 'porchsongs.db'}"


class Settings(BaseSettings):
    database_url: str = _default_db
    cors_origins: str = "*"
    app_secret: str | None = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
