"""Tests for auth endpoints and data isolation."""

from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_current_user
from app.auth.loader import reset_auth_backend
from app.auth.tokens import create_access_token
from app.database import Base, get_db
from app.main import app
from app.models import RefreshToken, User


@pytest.fixture()
def _auth_db() -> Generator[Session]:
    """Separate DB for auth tests (no auto-user override)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def auth_client(_auth_db: Session) -> Generator[TestClient]:
    """Client WITHOUT auto-auth override (for testing login flow)."""

    def _override_get_db() -> Generator[Session]:
        try:
            yield _auth_db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    # Clear any existing auth override
    app.dependency_overrides.pop(get_current_user, None)
    reset_auth_backend()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    reset_auth_backend()


# --- GET /api/auth/config ---


def test_auth_config_no_secret(auth_client: TestClient) -> None:
    """Without APP_SECRET, auth should not be required."""
    with patch("app.auth.app_secret.settings") as mock_settings:
        mock_settings.app_secret = None
        mock_settings.auth_backend = "app_secret"
        mock_settings.premium_plugin = None
        reset_auth_backend()
        resp = auth_client.get("/api/auth/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == "password"
        assert data["required"] is False
    reset_auth_backend()


def test_auth_config_with_secret(auth_client: TestClient) -> None:
    """With APP_SECRET, auth should be required."""
    with patch("app.auth.app_secret.settings") as mock_settings:
        mock_settings.app_secret = "test-secret"
        mock_settings.auth_backend = "app_secret"
        mock_settings.premium_plugin = None
        reset_auth_backend()
        resp = auth_client.get("/api/auth/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == "password"
        assert data["required"] is True
    reset_auth_backend()


# --- POST /api/auth/login ---


def test_login_success(auth_client: TestClient, _auth_db: Session) -> None:
    """Login with correct password returns tokens."""
    with (
        patch("app.auth.app_secret.settings") as mock_app_settings,
        patch("app.auth.loader.settings") as mock_loader_settings,
    ):
        mock_app_settings.app_secret = "test-secret"
        mock_app_settings.auth_backend = "app_secret"
        mock_app_settings.premium_plugin = None
        mock_loader_settings.auth_backend = "app_secret"
        mock_loader_settings.premium_plugin = None
        reset_auth_backend()

        resp = auth_client.post("/api/auth/login", json={"password": "test-secret"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "local@porchsongs.local"
    reset_auth_backend()


def test_login_wrong_password(auth_client: TestClient) -> None:
    """Login with wrong password returns 401."""
    with (
        patch("app.auth.app_secret.settings") as mock_app_settings,
        patch("app.auth.loader.settings") as mock_loader_settings,
    ):
        mock_app_settings.app_secret = "test-secret"
        mock_app_settings.auth_backend = "app_secret"
        mock_app_settings.premium_plugin = None
        mock_loader_settings.auth_backend = "app_secret"
        mock_loader_settings.premium_plugin = None
        reset_auth_backend()

        resp = auth_client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 401
    reset_auth_backend()


# --- POST /api/auth/refresh ---


def test_refresh_token_rotation(_auth_db: Session, auth_client: TestClient) -> None:
    """Refreshing returns new tokens and revokes the old one."""
    # Create a user and a refresh token
    user = User(
        email="refresh@test.com",
        name="Refresh User",
        role="user",
        is_active=True,
        created_at=datetime.now(UTC),
    )
    _auth_db.add(user)
    _auth_db.commit()
    _auth_db.refresh(user)

    rt = RefreshToken(
        token="old-refresh-token",
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        revoked=False,
    )
    _auth_db.add(rt)
    _auth_db.commit()

    resp = auth_client.post("/api/auth/refresh", json={"refresh_token": "old-refresh-token"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["refresh_token"] != "old-refresh-token"

    # Old token should be revoked
    _auth_db.refresh(rt)
    assert rt.revoked is True


def test_refresh_expired_token(_auth_db: Session, auth_client: TestClient) -> None:
    """Expired refresh token returns 401."""
    user = User(
        email="expired@test.com",
        name="Expired",
        role="user",
        is_active=True,
        created_at=datetime.now(UTC),
    )
    _auth_db.add(user)
    _auth_db.commit()
    _auth_db.refresh(user)

    rt = RefreshToken(
        token="expired-token",
        user_id=user.id,
        expires_at=datetime.now(UTC) - timedelta(days=1),
        revoked=False,
    )
    _auth_db.add(rt)
    _auth_db.commit()

    resp = auth_client.post("/api/auth/refresh", json={"refresh_token": "expired-token"})
    assert resp.status_code == 401


# --- POST /api/auth/logout ---


def test_logout_revokes_token(_auth_db: Session, auth_client: TestClient) -> None:
    """Logout revokes the refresh token."""
    user = User(
        email="logout@test.com",
        name="Logout",
        role="user",
        is_active=True,
        created_at=datetime.now(UTC),
    )
    _auth_db.add(user)
    _auth_db.commit()
    _auth_db.refresh(user)

    rt = RefreshToken(
        token="logout-token",
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        revoked=False,
    )
    _auth_db.add(rt)
    _auth_db.commit()

    resp = auth_client.post("/api/auth/logout", json={"refresh_token": "logout-token"})
    assert resp.status_code == 200

    _auth_db.refresh(rt)
    assert rt.revoked is True


# --- GET /api/auth/me ---


def test_me_with_valid_token(_auth_db: Session, auth_client: TestClient) -> None:
    """GET /auth/me with valid JWT returns user info."""
    user = User(
        email="me@test.com",
        name="Me User",
        role="user",
        is_active=True,
        created_at=datetime.now(UTC),
    )
    _auth_db.add(user)
    _auth_db.commit()
    _auth_db.refresh(user)

    with (
        patch("app.auth.dependencies.settings") as mock_dep_settings,
        patch("app.auth.app_secret.settings") as mock_app_settings,
        patch("app.auth.loader.settings") as mock_loader_settings,
    ):
        mock_dep_settings.app_secret = "test-secret"
        mock_dep_settings.auth_backend = "app_secret"
        mock_app_settings.app_secret = "test-secret"
        mock_app_settings.auth_backend = "app_secret"
        mock_app_settings.premium_plugin = None
        mock_loader_settings.auth_backend = "app_secret"
        mock_loader_settings.premium_plugin = None
        reset_auth_backend()

        token = create_access_token(user.id, user.email, user.role)
        resp = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@test.com"
    reset_auth_backend()


def test_me_without_token(auth_client: TestClient) -> None:
    """GET /auth/me without token returns 401 (when APP_SECRET is set)."""
    with (
        patch("app.auth.dependencies.settings") as mock_dep_settings,
        patch("app.auth.app_secret.settings") as mock_app_settings,
        patch("app.auth.loader.settings") as mock_loader_settings,
    ):
        mock_dep_settings.app_secret = "test-secret"
        mock_dep_settings.auth_backend = "app_secret"
        mock_app_settings.app_secret = "test-secret"
        mock_app_settings.auth_backend = "app_secret"
        mock_app_settings.premium_plugin = None
        mock_loader_settings.auth_backend = "app_secret"
        mock_loader_settings.premium_plugin = None
        reset_auth_backend()

        resp = auth_client.get("/api/auth/me")
        assert resp.status_code == 401
    reset_auth_backend()


# --- Data Isolation ---


def test_data_isolation_profiles() -> None:
    """User A cannot see User B's profiles."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()

    user_a = User(
        email="a@test.com", name="A", role="user", is_active=True, created_at=datetime.now(UTC)
    )
    user_b = User(
        email="b@test.com", name="B", role="user", is_active=True, created_at=datetime.now(UTC)
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    def _override_get_db() -> Generator[Session]:
        try:
            yield db
        finally:
            pass

    # User A creates a profile
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: user_a
    with TestClient(app) as client_a:
        resp = client_a.post("/api/profiles", json={"name": "A's Profile"})
        assert resp.status_code == 201
        profile_a_id = resp.json()["id"]

    # User B cannot see it
    app.dependency_overrides[get_current_user] = lambda: user_b
    with TestClient(app) as client_b:
        resp = client_b.get("/api/profiles")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

        resp = client_b.get(f"/api/profiles/{profile_a_id}")
        assert resp.status_code == 404

    app.dependency_overrides.clear()
    db.close()


def test_data_isolation_songs() -> None:
    """User A cannot see User B's songs."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()

    user_a = User(
        email="a@test.com", name="A", role="user", is_active=True, created_at=datetime.now(UTC)
    )
    user_b = User(
        email="b@test.com", name="B", role="user", is_active=True, created_at=datetime.now(UTC)
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    def _override_get_db() -> Generator[Session]:
        try:
            yield db
        finally:
            pass

    # User A creates a profile and a song
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: user_a
    with TestClient(app) as client_a:
        profile = client_a.post("/api/profiles", json={"name": "A's Profile"}).json()
        resp = client_a.post(
            "/api/songs",
            json={
                "profile_id": profile["id"],
                "original_content": "Hello",
                "rewritten_content": "Hi",
            },
        )
        assert resp.status_code == 201
        song_a_id = resp.json()["id"]

    # User B cannot see the song
    app.dependency_overrides[get_current_user] = lambda: user_b
    with TestClient(app) as client_b:
        resp = client_b.get("/api/songs")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

        resp = client_b.get(f"/api/songs/{song_a_id}")
        assert resp.status_code == 404

    app.dependency_overrides.clear()
    db.close()
