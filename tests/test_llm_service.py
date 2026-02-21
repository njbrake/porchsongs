"""Tests for llm_service pure functions (no LLM calls)."""

from app.services.llm_service import (
    _parse_chat_response,
    _parse_clean_response,
)


# --- _parse_chat_response ---


def test_parse_chat_with_xml_tags():
    raw = "<lyrics>\nHello world\nSecond line\n</lyrics>\nI changed the first word."
    result = _parse_chat_response(raw)
    assert result["lyrics"] == "Hello world\nSecond line"
    assert "changed" in result["explanation"]


def test_parse_chat_with_xml_tags_no_explanation():
    raw = "<lyrics>\nHello\n</lyrics>"
    result = _parse_chat_response(raw)
    assert result["lyrics"] == "Hello"
    assert result["explanation"] == ""


def test_parse_chat_no_markers():
    raw = "Just some text without markers"
    result = _parse_chat_response(raw)
    assert result["lyrics"] == "Just some text without markers"
    assert result["explanation"] == ""


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
    raw = (
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nHello\n</original>"
    )
    result = _parse_clean_response(raw, "fallback")
    assert result["title"] is None
    assert result["artist"] is None


def test_parse_clean_missing_tags_fallback():
    raw = "Just some text without XML tags"
    result = _parse_clean_response(raw, "fallback original")
    assert result["original"] == "fallback original"
    assert result["title"] is None
    assert result["artist"] is None
