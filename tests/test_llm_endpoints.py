"""Tests for endpoints that call the LLM, using mocked acompletion/list_models."""

from unittest.mock import MagicMock, patch


def _fake_completion_response(content):
    """Build a mock object that looks like a ChatCompletion response."""
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _make_profile_and_song(client):
    """Helper: create a profile and a song, return (profile, song)."""
    profile = client.post("/api/profiles", json={
        "name": "Test",
    }).json()
    song = client.post("/api/songs", json={
        "profile_id": profile["id"],
        "title": "Test Song",
        "artist": "Test Artist",
        "original_lyrics": "G  Am\nHello world\nDm  G\nGoodbye moon",
        "rewritten_lyrics": "G  Am\nHi there world\nDm  G\nSee ya moon",
        "changes_summary": "Changed hello to hi",
    }).json()
    return profile, song


LLM_SETTINGS = {
    "provider": "openai",
    "model": "gpt-4o-mini",
}


# --- POST /api/parse ---


@patch("app.services.llm_service.acompletion")
def test_parse_endpoint(mock_acompletion, client):
    profile = client.post("/api/profiles", json={
        "name": "Nathan",
    }).json()

    mock_acompletion.return_value = _fake_completion_response(
        "<meta>\nTitle: Test Song\nArtist: Test Artist\n</meta>\n"
        "<original>\nG  Am\nHello world\nDm  G\nGoodbye moon\n</original>"
    )

    resp = client.post("/api/parse", json={
        "profile_id": profile["id"],
        "lyrics": "G  Am\nHello world\nDm  G\nGoodbye moon",
        **LLM_SETTINGS,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "Hello world" in data["original_lyrics"]
    assert data["title"] == "Test Song"
    assert data["artist"] == "Test Artist"

    # Verify only 1 LLM call (cleanup only, no rewrite)
    assert mock_acompletion.call_count == 1
    # The call should NOT contain any profile description
    call_kwargs = mock_acompletion.call_args_list[0]
    messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")
    assert not any("Dad in Austin" in m["content"] for m in messages)


@patch("app.services.llm_service.acompletion")
def test_parse_unknown_title_artist(mock_acompletion, client):
    """Parse with UNKNOWN title/artist should return null."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()

    mock_acompletion.return_value = _fake_completion_response(
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nOriginal line one\nOriginal line two\n</original>"
    )

    resp = client.post("/api/parse", json={
        "profile_id": profile["id"],
        "lyrics": "Original line one\nOriginal line two",
        **LLM_SETTINGS,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] is None
    assert data["artist"] is None
    assert "Original line one" in data["original_lyrics"]


def test_parse_profile_not_found(client):
    resp = client.post("/api/parse", json={
        "profile_id": 9999,
        "lyrics": "Hello",
        **LLM_SETTINGS,
    })
    assert resp.status_code == 404


@patch("app.services.llm_service.acompletion")
def test_parse_llm_error(mock_acompletion, client):
    """LLM throwing an exception should return 502."""
    profile = client.post("/api/profiles", json={"name": "Test"}).json()
    mock_acompletion.side_effect = RuntimeError("API rate limit exceeded")

    resp = client.post("/api/parse", json={
        "profile_id": profile["id"],
        "lyrics": "Hello world",
        **LLM_SETTINGS,
    })
    assert resp.status_code == 502
    assert "LLM error" in resp.json()["detail"]


# --- POST /api/chat ---


@patch("app.services.llm_service.acompletion")
def test_chat_endpoint(mock_acompletion, client):
    _, song = _make_profile_and_song(client)

    mock_acompletion.return_value = _fake_completion_response(
        "<lyrics>\nHi there world\nCatch ya moon\n</lyrics>\nI changed 'see ya' to 'catch ya'."
    )

    resp = client.post("/api/chat", json={
        "song_id": song["id"],
        "messages": [
            {"role": "user", "content": "Change 'see ya' to 'catch ya'"},
        ],
        **LLM_SETTINGS,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "catch ya" in data["rewritten_lyrics"].lower() or "Catch ya" in data["rewritten_lyrics"]
    assert "assistant_message" in data
    assert data["version"] == 2  # bumped from 1


@patch("app.services.llm_service.acompletion")
def test_chat_persists_changes(mock_acompletion, client):
    """Chat edits should be persisted to the song and create a revision."""
    _, song = _make_profile_and_song(client)

    mock_acompletion.return_value = _fake_completion_response(
        "<lyrics>\nUpdated line one\nUpdated line two\n</lyrics>\nChanged everything."
    )

    client.post("/api/chat", json={
        "song_id": song["id"],
        "messages": [{"role": "user", "content": "Rewrite everything"}],
        **LLM_SETTINGS,
    })

    # Check the song was updated
    song_resp = client.get(f"/api/songs/{song['id']}")
    assert song_resp.json()["current_version"] == 2

    # Check a revision was created
    revisions = client.get(f"/api/songs/{song['id']}/revisions").json()
    assert len(revisions) == 2  # initial + chat edit
    assert revisions[1]["edit_type"] == "chat"


@patch("app.services.llm_service.acompletion")
def test_chat_persists_messages(mock_acompletion, client):
    """POST /api/chat should create ChatMessage rows for user + assistant."""
    _, song = _make_profile_and_song(client)

    mock_acompletion.return_value = _fake_completion_response(
        "<lyrics>\nUpdated line one\nUpdated line two\n</lyrics>\nChanged everything."
    )

    client.post("/api/chat", json={
        "song_id": song["id"],
        "messages": [{"role": "user", "content": "Rewrite everything"}],
        **LLM_SETTINGS,
    })

    # Check that chat messages were persisted
    msgs = client.get(f"/api/songs/{song['id']}/messages").json()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Rewrite everything"
    assert msgs[0]["is_note"] is False
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["is_note"] is False


def test_chat_song_not_found(client):
    resp = client.post("/api/chat", json={
        "song_id": 9999,
        "messages": [{"role": "user", "content": "hello"}],
        **LLM_SETTINGS,
    })
    assert resp.status_code == 404


# --- GET /api/providers/{provider}/models ---


@patch("app.services.llm_service.alist_models")
def test_list_provider_models_success(mock_list_models, client):
    mock_model = MagicMock()
    mock_model.id = "gpt-4o"
    mock_list_models.return_value = [mock_model]

    resp = client.get("/api/providers/openai/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "gpt-4o" in data


@patch("app.services.llm_service.alist_models")
def test_list_provider_models_failure(mock_list_models, client):
    mock_list_models.side_effect = RuntimeError("Invalid API key")

    resp = client.get("/api/providers/openai/models")
    assert resp.status_code == 502
    assert "Invalid API key" in resp.json()["detail"]


# --- api_base passthrough tests ---


@patch("app.services.llm_service.acompletion")
def test_parse_passes_api_base(mock_acompletion, client):
    """When a ProfileModel has api_base set, the parse call should pass it to acompletion."""
    profile = client.post("/api/profiles", json={
        "name": "Local LLM User",
    }).json()

    # Save a ProfileModel with api_base
    client.post(f"/api/profiles/{profile['id']}/models", json={
        "provider": "ollama",
        "model": "llama3",
        "api_base": "http://localhost:11434",
    })

    mock_acompletion.return_value = _fake_completion_response(
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nHello world\n</original>"
    )

    resp = client.post("/api/parse", json={
        "profile_id": profile["id"],
        "lyrics": "Hello world",
        "provider": "ollama",
        "model": "llama3",
    })
    assert resp.status_code == 200

    assert mock_acompletion.call_count == 1
    assert mock_acompletion.call_args.kwargs.get("api_base") == "http://localhost:11434"


@patch("app.services.llm_service.acompletion")
def test_parse_no_api_base_when_no_profile_model(mock_acompletion, client):
    """When no ProfileModel exists, api_base should not be passed."""
    profile = client.post("/api/profiles", json={
        "name": "Cloud User",
    }).json()

    mock_acompletion.return_value = _fake_completion_response(
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nHello world\n</original>"
    )

    resp = client.post("/api/parse", json={
        "profile_id": profile["id"],
        "lyrics": "Hello world",
        **LLM_SETTINGS,
    })
    assert resp.status_code == 200

    assert mock_acompletion.call_count == 1
    assert "api_base" not in mock_acompletion.call_args.kwargs


@patch("app.services.llm_service.alist_models")
def test_list_models_with_api_base(mock_list_models, client):
    """GET /providers/{provider}/models?api_base= should pass api_base to alist_models."""
    mock_model = MagicMock()
    mock_model.id = "llama3"
    mock_list_models.return_value = [mock_model]

    resp = client.get("/api/providers/ollama/models?api_base=http://localhost:11434")
    assert resp.status_code == 200
    assert "llama3" in resp.json()

    mock_list_models.assert_called_once()
    call_kwargs = mock_list_models.call_args.kwargs
    assert call_kwargs.get("api_base") == "http://localhost:11434"
