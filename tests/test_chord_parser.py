"""Tests for chord_parser — pure functions, no LLM or DB needed."""

from app.services.chord_parser import (
    _extract_chord_positions,
    _place_chords,
    _snap_to_boundary,
    extract_lyrics_only,
    inline_to_above_line,
    is_chord_line,
    realign_chords,
    replace_line_with_chords,
    separate_chords_and_lyrics,
)


# --- is_chord_line ---


def test_chord_line_basic():
    assert is_chord_line("G   Am  C") is True


def test_chord_line_with_sharps_flats():
    assert is_chord_line("F#m  Bb  C#") is True


def test_chord_line_complex_chords():
    assert is_chord_line("Cmaj7 Dm7 G7sus4") is True


def test_not_chord_line_lyrics():
    assert is_chord_line("Take me home, country roads") is False


def test_not_chord_line_empty():
    assert is_chord_line("") is False
    assert is_chord_line("   ") is False


def test_not_chord_line_section_header():
    assert is_chord_line("[Verse 1]") is False


# --- separate_chords_and_lyrics ---


def test_separate_basic():
    text = "G   Am  C\nTake me home\nDm  G\nCountry roads"
    result = separate_chords_and_lyrics(text)
    assert len(result) == 2
    assert result[0]["chords"] == "G   Am  C"
    assert result[0]["lyrics"] == "Take me home"
    assert result[1]["chords"] == "Dm  G"
    assert result[1]["lyrics"] == "Country roads"


def test_separate_no_chords():
    text = "Just a lyric line\nAnother lyric"
    result = separate_chords_and_lyrics(text)
    assert len(result) == 2
    assert all(entry["chords"] is None for entry in result)


def test_separate_section_headers():
    text = "[Verse]\nG  C\nHello world"
    result = separate_chords_and_lyrics(text)
    assert result[0]["chords"] is None
    assert result[0]["lyrics"] == "[Verse]"
    assert result[1]["chords"] == "G  C"
    assert result[1]["lyrics"] == "Hello world"


def test_separate_chord_line_no_lyric_below():
    text = "G  Am  C"
    result = separate_chords_and_lyrics(text)
    assert len(result) == 1
    assert result[0]["chords"] == "G  Am  C"
    assert result[0]["lyrics"] == ""


# --- extract_lyrics_only ---


def test_extract_lyrics_only():
    text = "G   Am  C\nTake me home\nDm  G\nCountry roads"
    lyrics = extract_lyrics_only(text)
    assert lyrics == "Take me home\nCountry roads"


def test_extract_lyrics_preserves_empty_lines():
    text = "G  C\nHello\n\nDm  G\nWorld"
    lyrics = extract_lyrics_only(text)
    assert lyrics == "Hello\n\nWorld"


# --- inline_to_above_line ---


def test_inline_to_above():
    text = "[G]Take me [Am]home"
    result = inline_to_above_line(text)
    lines = result.split("\n")
    assert len(lines) == 2
    # Chord line should have G and Am at appropriate positions
    assert "G" in lines[0]
    assert "Am" in lines[0]
    assert "Take me home" in lines[1]


def test_inline_no_chords_passthrough():
    text = "Just lyrics here"
    assert inline_to_above_line(text) == "Just lyrics here"


# --- _extract_chord_positions ---


def test_extract_positions():
    positions = _extract_chord_positions("G   Am  C")
    assert positions == [(0, "G"), (4, "Am"), (8, "C")]


def test_extract_positions_empty():
    assert _extract_chord_positions("") == []


# --- _snap_to_boundary ---


def test_snap_at_word_start():
    assert _snap_to_boundary("hello world", 6) == 6  # 'w' is already at word start


def test_snap_mid_word():
    result = _snap_to_boundary("hello world", 8)
    assert result in (6, 11)  # snaps to 'world' start or end


def test_snap_at_zero():
    assert _snap_to_boundary("hello", 0) == 0


# --- _place_chords ---


def test_place_chords_proportional():
    positions = [(0, "G"), (10, "Am")]
    result = _place_chords(positions, "Hello dear world", "Hi there world")
    assert "G" in result
    assert "Am" in result


def test_place_chords_empty():
    assert _place_chords([], "hello", "world") == ""


# --- realign_chords ---


def test_realign_basic():
    original = "G   Am\nHello world"
    rewritten = "Hi there"
    result = realign_chords(original, rewritten)
    lines = result.split("\n")
    assert len(lines) == 2
    assert "G" in lines[0]
    assert lines[1] == "Hi there"


def test_realign_preserves_non_chord_lines():
    original = "[Verse]\nG  C\nHello world\n\nDm\nGoodbye"
    rewritten = "[Verse]\nHi there\n\nSee ya"
    result = realign_chords(original, rewritten)
    assert "[Verse]" in result
    assert "Hi there" in result
    assert "See ya" in result


# --- replace_line_with_chords ---


def test_replace_line():
    text = "G   Am\nHello world\nDm  G\nCountry roads"
    result = replace_line_with_chords(text, 0, "Hi there")
    assert "Hi there" in result
    assert "Country roads" in result


def test_replace_line_out_of_range():
    import pytest

    text = "G   Am\nHello world"
    with pytest.raises(IndexError):
        replace_line_with_chords(text, 99, "oops")
