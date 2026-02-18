"""Integration tests for API endpoints using FastAPI TestClient."""

from unittest.mock import AsyncMock, MagicMock, patch


# --- Profile CRUD ---


def test_create_profile(client):
    resp = client.post("/api/profiles", json={
        "name": "Nathan",
        "description": "Suburban dad, Subaru driver, guitar player",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Nathan"
    assert data["description"] == "Suburban dad, Subaru driver, guitar player"
    assert data["is_default"] is True  # first profile becomes default


def test_list_profiles_empty(client):
    resp = client.get("/api/profiles")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_profile(client):
    create = client.post("/api/profiles", json={"name": "Test"})
    pid = create.json()["id"]

    resp = client.get(f"/api/profiles/{pid}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test"


def test_get_profile_404(client):
    resp = client.get("/api/profiles/9999")
    assert resp.status_code == 404


def test_update_profile(client):
    create = client.post("/api/profiles", json={"name": "Old Name"})
    pid = create.json()["id"]

    resp = client.put(f"/api/profiles/{pid}", json={
        "name": "New Name",
        "description": "Updated description",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["description"] == "Updated description"


def test_delete_profile(client):
    create = client.post("/api/profiles", json={"name": "Delete Me"})
    pid = create.json()["id"]

    resp = client.delete(f"/api/profiles/{pid}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Confirm deleted
    resp = client.get(f"/api/profiles/{pid}")
    assert resp.status_code == 404


# --- Songs ---


def test_create_and_list_songs(client):
    # Need a profile first
    profile = client.post("/api/profiles", json={"name": "Test"}).json()

    song_data = {
        "profile_id": profile["id"],
        "title": "Test Song",
        "artist": "Test Artist",
        "original_lyrics": "Original line one\nOriginal line two",
        "rewritten_lyrics": "Rewritten line one\nRewritten line two",
        "changes_summary": "Changed some words",
    }
    resp = client.post("/api/songs", json=song_data)
    assert resp.status_code == 201
    song = resp.json()
    assert song["title"] == "Test Song"
    assert song["status"] == "draft"
    assert song["current_version"] == 1

    # List songs
    resp = client.get(f"/api/songs?profile_id={profile['id']}")
    assert resp.status_code == 200
    songs = resp.json()
    assert len(songs) == 1
    assert songs[0]["id"] == song["id"]


def test_get_song(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hi",
    }).json()

    resp = client.get(f"/api/songs/{song['id']}")
    assert resp.status_code == 200
    assert resp.json()["original_lyrics"] == "Hello"


def test_get_song_404(client):
    resp = client.get("/api/songs/9999")
    assert resp.status_code == 404


def test_update_song_title(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hi",
    }).json()
    assert song["title"] is None

    resp = client.put(f"/api/songs/{song['id']}", json={"title": "My Song"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Song"

    # Verify persisted
    resp = client.get(f"/api/songs/{song['id']}")
    assert resp.json()["title"] == "My Song"


def test_update_song_not_found(client):
    resp = client.put("/api/songs/9999", json={"title": "Nope"})
    assert resp.status_code == 404


def test_delete_song(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hi",
    }).json()

    resp = client.delete(f"/api/songs/{song['id']}")
    assert resp.status_code == 200

    resp = client.get(f"/api/songs/{song['id']}")
    assert resp.status_code == 404


def test_update_song_status(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hi",
    }).json()

    resp = client.put(f"/api/songs/{song['id']}/status", json={"status": "completed"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


def test_update_song_status_invalid(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hi",
    }).json()

    resp = client.put(f"/api/songs/{song['id']}/status", json={"status": "invalid"})
    assert resp.status_code == 400


# --- Song Revisions ---


def test_song_revisions(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hi",
        "changes_summary": "Initial",
    }).json()

    resp = client.get(f"/api/songs/{song['id']}/revisions")
    assert resp.status_code == 200
    revisions = resp.json()
    assert len(revisions) == 1
    assert revisions[0]["version"] == 1
    assert revisions[0]["edit_type"] == "full"


# --- Apply Edit ---


def test_apply_edit(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "G  Am\nHello world\nDm  G\nGoodbye moon",
        "rewritten_lyrics": "G  Am\nHello world\nDm  G\nGoodbye moon",
    }).json()

    resp = client.post("/api/apply-edit", json={
        "song_id": song["id"],
        "line_index": 0,
        "new_line_text": "Hi there",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "Hi there" in data["rewritten_lyrics"]
    assert data["version"] == 2


def test_apply_edit_invalid_line(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello",
        "rewritten_lyrics": "Hello",
    }).json()

    resp = client.post("/api/apply-edit", json={
        "song_id": song["id"],
        "line_index": 99,
        "new_line_text": "oops",
    })
    assert resp.status_code == 400


# --- Providers ---


@patch("app.services.llm_service.os.getenv", return_value="fake-key")
def test_list_providers(mock_getenv, client):
    resp = client.get("/api/providers")
    assert resp.status_code == 200
    providers = resp.json()
    assert isinstance(providers, list)
    # Providers are now dicts with 'name' and 'env_key'
    if providers:
        assert "name" in providers[0]


# --- fetch-tab endpoint removed ---


def test_fetch_tab_removed(client):
    resp = client.post("/api/fetch-tab", json={"url": "https://tabs.ultimate-guitar.com/tab/test"})
    # Should 404 or 405 since the endpoint was removed
    assert resp.status_code in (404, 405)


# --- Chat Messages ---


def _make_song(client):
    """Helper: create a profile + song and return the song dict."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "original_lyrics": "Hello world",
        "rewritten_lyrics": "Hi world",
        "changes_summary": "Changed hello to hi",
    }).json()
    return song


def test_save_chat_messages(client):
    song = _make_song(client)
    messages = [
        {"role": "user", "content": "Pasted lyrics here", "is_note": True},
        {"role": "assistant", "content": "Changed hello to hi", "is_note": True},
    ]
    resp = client.post(f"/api/songs/{song['id']}/messages", json=messages)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data) == 2
    assert data[0]["role"] == "user"
    assert data[0]["is_note"] is True
    assert data[1]["role"] == "assistant"


def test_get_chat_messages(client):
    song = _make_song(client)
    messages = [
        {"role": "user", "content": "First message", "is_note": True},
        {"role": "assistant", "content": "Summary", "is_note": True},
        {"role": "user", "content": "Make it better"},
        {"role": "assistant", "content": "Done!"},
    ]
    client.post(f"/api/songs/{song['id']}/messages", json=messages)

    resp = client.get(f"/api/songs/{song['id']}/messages")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 4
    assert data[0]["content"] == "First message"
    assert data[3]["content"] == "Done!"
    # Verify ordering (created_at ascending)
    assert data[0]["id"] < data[3]["id"]


def test_get_chat_messages_song_not_found(client):
    resp = client.get("/api/songs/9999/messages")
    assert resp.status_code == 404


def test_save_chat_messages_song_not_found(client):
    resp = client.post("/api/songs/9999/messages", json=[
        {"role": "user", "content": "hello"},
    ])
    assert resp.status_code == 404


def test_delete_song_deletes_messages(client):
    song = _make_song(client)
    client.post(f"/api/songs/{song['id']}/messages", json=[
        {"role": "user", "content": "test message"},
    ])

    # Verify messages exist
    resp = client.get(f"/api/songs/{song['id']}/messages")
    assert len(resp.json()) == 1

    # Delete the song
    client.delete(f"/api/songs/{song['id']}")

    # Song is gone
    resp = client.get(f"/api/songs/{song['id']}")
    assert resp.status_code == 404


# --- Profile Models ---


def test_list_profile_models_empty(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    resp = client.get(f"/api/profiles/{profile['id']}/models")
    assert resp.status_code == 200
    assert resp.json() == []


def test_add_profile_model(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    resp = client.post(f"/api/profiles/{profile['id']}/models", json={
        "provider": "openai",
        "model": "gpt-4",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["provider"] == "openai"
    assert data["model"] == "gpt-4"
    assert data["profile_id"] == profile["id"]
    assert data["api_base"] is None


def test_add_profile_model_upsert(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    pid = profile["id"]

    client.post(f"/api/profiles/{pid}/models", json={
        "provider": "openai", "model": "gpt-4",
    })
    # Same provider+model — should update, not create a second row
    client.post(f"/api/profiles/{pid}/models", json={
        "provider": "openai", "model": "gpt-4", "api_base": "http://localhost:8080",
    })

    resp = client.get(f"/api/profiles/{pid}/models")
    models = resp.json()
    assert len(models) == 1
    assert models[0]["api_base"] == "http://localhost:8080"


def test_add_profile_model_profile_not_found(client):
    resp = client.post("/api/profiles/9999/models", json={
        "provider": "openai", "model": "gpt-4",
    })
    assert resp.status_code == 404


def test_delete_profile_model(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    pid = profile["id"]
    pm = client.post(f"/api/profiles/{pid}/models", json={
        "provider": "openai", "model": "gpt-4",
    }).json()

    resp = client.delete(f"/api/profiles/{pid}/models/{pm['id']}")
    assert resp.status_code == 200

    # Verify gone
    resp = client.get(f"/api/profiles/{pid}/models")
    assert resp.json() == []


def test_delete_profile_cascades_models(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    pid = profile["id"]
    client.post(f"/api/profiles/{pid}/models", json={
        "provider": "openai", "model": "gpt-4",
    })

    # Delete the profile
    client.delete(f"/api/profiles/{pid}")

    # Profile is gone — listing models should 404
    resp = client.get(f"/api/profiles/{pid}/models")
    assert resp.status_code == 404


def test_list_profile_models_multiple(client):
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    pid = profile["id"]
    client.post(f"/api/profiles/{pid}/models", json={
        "provider": "openai", "model": "gpt-4",
    })
    client.post(f"/api/profiles/{pid}/models", json={
        "provider": "anthropic", "model": "claude-3-opus",
    })

    resp = client.get(f"/api/profiles/{pid}/models")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) == 2


def test_rewrite_uses_env_credentials(client):
    """POST /rewrite should call acompletion without api_key (uses env vars)."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = (
        "<meta>\nTitle: Hello Song\nArtist: Test Artist\n</meta>\n"
        "<original>\nHello world\n</original>\n"
        "<rewritten>\nHi world\n</rewritten>\n"
        "<changes>\nChanged hello to hi\n</changes>"
    )

    with patch("app.services.llm_service.acompletion", new_callable=AsyncMock, return_value=mock_response) as mock_ac:
        resp = client.post("/api/rewrite", json={
            "profile_id": profile["id"],
            "lyrics": "Hello world",
            "provider": "openai",
            "model": "gpt-4",
        })
        assert resp.status_code == 200
        # Verify acompletion was called without api_key
        mock_ac.assert_called_once()
        call_kwargs = mock_ac.call_args
        assert "api_key" not in call_kwargs.kwargs


def test_rewrite_returns_title_artist(client):
    """POST /rewrite with META section should return title and artist."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = (
        "<meta>\nTitle: Wagon Wheel\nArtist: Old Crow Medicine Show\n</meta>\n"
        "<original>\nRock me mama\n</original>\n"
        "<rewritten>\nRoll me papa\n</rewritten>\n"
        "<changes>\nChanged perspective\n</changes>"
    )

    with patch("app.services.llm_service.acompletion", new_callable=AsyncMock, return_value=mock_response):
        resp = client.post("/api/rewrite", json={
            "profile_id": profile["id"],
            "lyrics": "Rock me mama",
            "provider": "openai",
            "model": "gpt-4",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Wagon Wheel"
        assert data["artist"] == "Old Crow Medicine Show"
        assert data["rewritten_lyrics"] == "Roll me papa"


def test_rewrite_unknown_title_artist(client):
    """POST /rewrite with UNKNOWN in META should return null title/artist."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = (
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nSome lyrics\n</original>\n"
        "<rewritten>\nSome new lyrics\n</rewritten>\n"
        "<changes>\nChanged words\n</changes>"
    )

    with patch("app.services.llm_service.acompletion", new_callable=AsyncMock, return_value=mock_response):
        resp = client.post("/api/rewrite", json={
            "profile_id": profile["id"],
            "lyrics": "Some lyrics",
            "provider": "openai",
            "model": "gpt-4",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] is None
        assert data["artist"] is None


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_rewrite_fallback_title_from_request(client):
    """When LLM returns UNKNOWN but request has title/artist, use request values."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = (
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nSome lyrics\n</original>\n"
        "<rewritten>\nSome new lyrics\n</rewritten>\n"
        "<changes>\nChanged words\n</changes>"
    )

    with patch("app.services.llm_service.acompletion", new_callable=AsyncMock, return_value=mock_response):
        resp = client.post("/api/rewrite", json={
            "profile_id": profile["id"],
            "lyrics": "Some lyrics",
            "title": "My Song",
            "artist": "My Artist",
            "provider": "openai",
            "model": "gpt-4",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "My Song"
        assert data["artist"] == "My Artist"
