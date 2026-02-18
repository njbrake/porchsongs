"""Tests for llm_service pure functions (no LLM calls)."""

from app.services.llm_service import (
    _parse_chat_response,
    _parse_rewrite_response,
    build_user_prompt,
    build_workshop_prompt,
)


# --- build_user_prompt ---


def test_prompt_with_description():
    prompt = build_user_prompt(
        profile_description="Dad in Austin, drives a Subaru",
        title="Beer Never Broke My Heart",
        artist="Luke Combs",
        lyrics="Long neck ice cold beer never broke my heart",
    )
    assert "ABOUT THE SINGER:" in prompt
    assert "Dad in Austin, drives a Subaru" in prompt
    assert "Luke Combs" in prompt
    assert "Beer Never Broke My Heart" in prompt
    assert "Long neck ice cold beer never broke my heart" in prompt
    assert "PASTED INPUT:" in prompt


def test_prompt_without_description():
    prompt = build_user_prompt(
        profile_description="",
        title=None,
        artist=None,
        lyrics="Some lyrics here",
    )
    assert "ABOUT THE SINGER:" not in prompt
    assert "Some lyrics here" in prompt


def test_prompt_with_instruction():
    prompt = build_user_prompt(
        profile_description="Lives in Portland",
        title="Test Song",
        artist=None,
        lyrics="Some lyrics",
        instruction="Change truck references to bikes",
    )
    assert "USER INSTRUCTIONS: Change truck references to bikes" in prompt


def test_prompt_with_patterns():
    prompt = build_user_prompt(
        profile_description="Test user",
        title=None,
        artist=None,
        lyrics="Some lyrics",
        patterns=[
            {"original": "F-150", "replacement": "Subaru", "category": "vehicle", "reasoning": "user drives Subaru"},
        ],
    )
    assert "F-150 -> Subaru" in prompt
    assert "vehicle" in prompt


def test_prompt_with_example():
    prompt = build_user_prompt(
        profile_description="Test user",
        title=None,
        artist=None,
        lyrics="Some lyrics",
        example={
            "original_lyrics": "Original verse one",
            "rewritten_lyrics": "Rewritten verse one",
        },
    )
    assert "EXAMPLE OF A PREVIOUS REWRITE" in prompt
    assert "Original verse one" in prompt
    assert "Rewritten verse one" in prompt


# --- build_workshop_prompt ---


def test_workshop_prompt_basic():
    prompt = build_workshop_prompt(
        original_lyrics="Line one\nLine two\nLine three",
        rewritten_lyrics="New one\nNew two\nNew three",
        line_index=1,
    )
    assert ">>> " in prompt
    assert "New two" in prompt
    assert "ORIGINAL LINE" in prompt


def test_workshop_prompt_with_instruction():
    prompt = build_workshop_prompt(
        original_lyrics="Line one\nLine two",
        rewritten_lyrics="New one\nNew two",
        line_index=0,
        instruction="Make it funnier",
    )
    assert "USER INSTRUCTION: Make it funnier" in prompt


def test_workshop_prompt_out_of_range():
    import pytest

    with pytest.raises(IndexError):
        build_workshop_prompt(
            original_lyrics="One line",
            rewritten_lyrics="One line",
            line_index=5,
        )


# --- _parse_chat_response ---


def test_parse_chat_with_markers():
    raw = "---LYRICS---\nHello world\nSecond line\n---END---\nI changed the first word."
    result = _parse_chat_response(raw)
    assert result["lyrics"] == "Hello world\nSecond line"
    assert "changed" in result["explanation"]


def test_parse_chat_no_markers():
    raw = "Just some text without markers"
    result = _parse_chat_response(raw)
    assert result["lyrics"] == "Just some text without markers"
    assert result["explanation"] == ""


def test_parse_chat_empty_explanation():
    raw = "---LYRICS---\nHello\n---END---"
    result = _parse_chat_response(raw)
    assert result["lyrics"] == "Hello"
    assert result["explanation"] == ""


# --- _parse_rewrite_response ---


def test_parse_rewrite_3_section():
    raw = (
        "---ORIGINAL---\nG  Am\nHello world\n"
        "---REWRITTEN---\nG  Am\nHi there world\n"
        "---CHANGES---\nChanged hello to hi"
    )
    result = _parse_rewrite_response(raw, "fallback")
    assert result["original_lyrics"] == "G  Am\nHello world"
    assert result["rewritten_lyrics"] == "G  Am\nHi there world"
    assert result["changes_summary"] == "Changed hello to hi"
    assert result["title"] is None
    assert result["artist"] is None


def test_parse_rewrite_no_changes_section():
    raw = (
        "---ORIGINAL---\nHello world\n"
        "---REWRITTEN---\nHi there world"
    )
    result = _parse_rewrite_response(raw, "fallback")
    assert result["original_lyrics"] == "Hello world"
    assert result["rewritten_lyrics"] == "Hi there world"
    assert result["changes_summary"] == "No change summary provided by the model."
    assert result["title"] is None
    assert result["artist"] is None


def test_parse_rewrite_old_format_fallback():
    raw = "Hi there world\n---CHANGES---\nChanged hello to hi"
    result = _parse_rewrite_response(raw, "original input")
    assert result["original_lyrics"] == "original input"
    assert result["rewritten_lyrics"] == "Hi there world"
    assert result["changes_summary"] == "Changed hello to hi"
    assert result["title"] is None
    assert result["artist"] is None


def test_parse_rewrite_no_delimiters():
    raw = "Just some rewritten text"
    result = _parse_rewrite_response(raw, "original input")
    assert result["original_lyrics"] == "original input"
    assert result["rewritten_lyrics"] == "Just some rewritten text"
    assert result["changes_summary"] == "No change summary provided by the model."
    assert result["title"] is None
    assert result["artist"] is None


def test_parse_rewrite_with_meta():
    """Full 4-section XML response extracts title and artist."""
    raw = (
        "<meta>\nTitle: Wagon Wheel\nArtist: Old Crow Medicine Show\n</meta>\n"
        "<original>\nG  Am\nHello world\n</original>\n"
        "<rewritten>\nG  Am\nHi there world\n</rewritten>\n"
        "<changes>\nChanged hello to hi\n</changes>"
    )
    result = _parse_rewrite_response(raw, "fallback")
    assert result["title"] == "Wagon Wheel"
    assert result["artist"] == "Old Crow Medicine Show"
    assert result["original_lyrics"] == "G  Am\nHello world"
    assert result["rewritten_lyrics"] == "G  Am\nHi there world"
    assert result["changes_summary"] == "Changed hello to hi"


def test_parse_rewrite_with_meta_unknown():
    """META section with UNKNOWN values maps to None."""
    raw = (
        "<meta>\nTitle: UNKNOWN\nArtist: UNKNOWN\n</meta>\n"
        "<original>\nHello\n</original>\n"
        "<rewritten>\nHi\n</rewritten>\n"
        "<changes>\nChanged greeting. Title and artist could not be determined.\n</changes>"
    )
    result = _parse_rewrite_response(raw, "fallback")
    assert result["title"] is None
    assert result["artist"] is None
    assert "could not be determined" in result["changes_summary"]


def test_parse_rewrite_without_meta_backward_compat():
    """No META section (legacy format) results in title/artist as None."""
    raw = (
        "---ORIGINAL---\nHello world\n"
        "---REWRITTEN---\nHi world\n"
        "---CHANGES---\nChanged hello"
    )
    result = _parse_rewrite_response(raw, "fallback")
    assert result["title"] is None
    assert result["artist"] is None
    assert result["rewritten_lyrics"] == "Hi world"
