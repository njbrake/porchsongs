"""Tests for llm_service pure functions (no LLM calls)."""

from types import SimpleNamespace

from app.services.llm_service import (
    _build_chat_kwargs,
    _parse_chat_response,
    _parse_clean_response,
)

# --- _build_chat_kwargs ---


def test_build_chat_kwargs_system_prompt():
    """System prompt contains ORIGINAL SONG but NOT EDITED SONG."""
    song = SimpleNamespace(
        original_content="G  Am\nHello world",
        rewritten_content="G  Am\nHello changed world",
    )
    messages = [
        {"role": "user", "content": "make it sadder"},
        {"role": "assistant", "content": "ok"},
    ]
    kwargs = _build_chat_kwargs(song, messages, "openai", "gpt-4o")

    system_msg = kwargs["messages"][0]  # type: ignore[index]
    assert system_msg["role"] == "system"  # type: ignore[index]
    assert "ORIGINAL SONG" in system_msg["content"]  # type: ignore[index]
    assert song.original_content in system_msg["content"]  # type: ignore[index]
    assert "EDITED SONG" not in system_msg["content"]  # type: ignore[index]

    # User/assistant messages passed through unchanged
    assert kwargs["messages"][1] == {"role": "user", "content": "make it sadder"}  # type: ignore[index]
    assert kwargs["messages"][2] == {"role": "assistant", "content": "ok"}  # type: ignore[index]


# --- _parse_chat_response ---


def test_parse_chat_with_xml_tags():
    raw = "<content>\nHello world\nSecond line\n</content>\nI changed the first word."
    result = _parse_chat_response(raw)
    assert result["content"] == "Hello world\nSecond line"
    assert "changed" in result["explanation"]


def test_parse_chat_with_xml_tags_no_explanation():
    raw = "<content>\nHello\n</content>"
    result = _parse_chat_response(raw)
    assert result["content"] == "Hello"
    assert result["explanation"] == ""


def test_parse_chat_no_markers():
    """Without <content> tags the response is conversational — no content update."""
    raw = "Just some text without markers"
    result = _parse_chat_response(raw)
    assert result["content"] is None
    assert result["explanation"] == "Just some text without markers"


# --- _parse_clean_response ---


def test_parse_clean_basic():
    raw = (
        "<meta>\nTitle: Wagon Wheel\nArtist: Old Crow\n</meta>\n"
        "<original>\nG  Am\nHello world\n</original>"
    )
    result = _parse_clean_response(raw, "fallback")
    assert result["title"] == "Wagon Wheel"
    assert result["artist"] == "Old Crow"
    assert result["original"] == "G  Am\nHello world"


def test_parse_clean_unknown_maps_to_none():
    raw = "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n<original>\nHello\n</original>"
    result = _parse_clean_response(raw, "fallback")
    assert result["title"] is None
    assert result["artist"] is None


def test_parse_clean_missing_tags_fallback():
    raw = "Just some text without XML tags"
    result = _parse_clean_response(raw, "fallback original")
    assert result["original"] == "fallback original"
    assert result["title"] is None
    assert result["artist"] is None
