"""Tests for llm_service pure functions (no LLM calls)."""

from app.services.llm_service import (
    _parse_chat_response,
    _parse_clean_response,
    _parse_rewrite_response,
    build_clean_prompt,
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
    assert "LYRICS:" in prompt


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


def test_parse_chat_with_legacy_markers():
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


# --- build_clean_prompt ---


def test_clean_prompt_contains_input():
    prompt = build_clean_prompt("G  Am\nHello world")
    assert "Hello world" in prompt
    assert "PASTED INPUT:" in prompt


def test_clean_prompt_references_meta():
    prompt = build_clean_prompt("Some lyrics")
    assert "title" in prompt.lower()
    assert "artist" in prompt.lower()


def test_clean_prompt_no_rewrite_instructions():
    prompt = build_clean_prompt("Some lyrics")
    assert "rewrite" not in prompt.lower()
    assert "syllable" not in prompt.lower()


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


# --- _parse_rewrite_response ---


def test_parse_rewrite_with_lyrics_tag():
    """New format: <lyrics> + <changes> XML tags."""
    raw = (
        "<lyrics>\nHi there world\nSee ya moon\n</lyrics>\n"
        "<changes>\nChanged hello to hi\n</changes>"
    )
    result = _parse_rewrite_response(raw, "fallback")
    assert result["rewritten_lyrics"] == "Hi there world\nSee ya moon"
    assert result["changes_summary"] == "Changed hello to hi"


def test_parse_rewrite_no_tags():
    """When no XML tags are present, treat entire response as lyrics."""
    raw = "Just some rewritten text"
    result = _parse_rewrite_response(raw, "original input")
    assert result["rewritten_lyrics"] == "Just some rewritten text"
    assert result["changes_summary"] == "No change summary provided by the model."


def test_parse_rewrite_empty_response():
    """Empty response should fall back to the provided lyrics."""
    result = _parse_rewrite_response("", "fallback lyrics")
    assert result["rewritten_lyrics"] == "fallback lyrics"


def test_parse_rewrite_lyrics_only_no_changes():
    """<lyrics> tag present but no <changes> tag."""
    raw = "<lyrics>\nHi there world\n</lyrics>"
    result = _parse_rewrite_response(raw, "fallback")
    assert result["rewritten_lyrics"] == "Hi there world"
    assert result["changes_summary"] == "No change summary provided by the model."
