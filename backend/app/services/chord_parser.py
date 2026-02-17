import re

# Common chord patterns
CHORD_PATTERN = re.compile(
    r"^[\s]*"
    r"("
    r"[A-G][#b]?"
    r"(m|maj|min|dim|aug|sus[24]?|add[0-9]*|[0-9]*|/[A-G][#b]?)*"
    r"[\s]*"
    r")+"
    r"$"
)


def is_chord_line(line: str) -> bool:
    """Detect whether a line consists only of chord symbols."""
    stripped = line.strip()
    if not stripped:
        return False
    # Remove all valid chord tokens and whitespace; if nothing remains, it's a chord line
    tokens = stripped.split()
    for token in tokens:
        if not re.match(
            r"^[A-G][#b]?(m|maj|min|dim|aug|sus[24]?|add\d+|\d+|/[A-G][#b]?)*$",
            token,
        ):
            return False
    return True


def separate_chords_and_lyrics(text: str) -> list[dict]:
    """Separate chord lines from lyric lines.

    Returns a list of dicts with structure:
        {"chords": "G   Am  C" or None, "lyrics": "Take me home..." or ""}

    Chord lines are paired with the lyric line immediately below them.
    """
    lines = text.split("\n")
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        if is_chord_line(line):
            chords = line
            # Look ahead for the lyric line
            if i + 1 < len(lines) and not is_chord_line(lines[i + 1]):
                lyrics = lines[i + 1]
                i += 2
            else:
                # Chord line with no lyric below (e.g., instrumental)
                lyrics = ""
                i += 1
            result.append({"chords": chords, "lyrics": lyrics})
        else:
            # Pure lyric line or empty/section header
            result.append({"chords": None, "lyrics": line})
            i += 1

    return result


def extract_lyrics_only(text: str) -> str:
    """Extract only the lyric lines (no chords) for sending to the LLM."""
    parsed = separate_chords_and_lyrics(text)
    lyrics_lines = []
    for entry in parsed:
        lyrics_lines.append(entry["lyrics"])
    return "\n".join(lyrics_lines)


def inline_to_above_line(text: str) -> str:
    """Convert [G]inline [Am]chord format to above-line format."""
    lines = text.split("\n")
    result = []
    chord_re = re.compile(r"\[([A-G][#b]?[^\]]*)\]")

    for line in lines:
        if "[" not in line:
            result.append(line)
            continue

        chord_line = []
        lyric_line = []
        pos = 0

        for match in chord_re.finditer(line):
            start = match.start()
            chord = match.group(1)

            # Add any text before this chord
            between = line[pos : start]
            between_clean = chord_re.sub("", between)
            lyric_line.append(between_clean)

            # Pad chord line to current position
            current_lyric_len = sum(len(s) for s in lyric_line)
            while len("".join(chord_line)) < current_lyric_len:
                chord_line.append(" ")
            chord_line.append(chord)

            pos = match.end()

        # Remaining text after last chord
        remaining = line[pos:]
        remaining_clean = chord_re.sub("", remaining)
        lyric_line.append(remaining_clean)

        chord_str = "".join(chord_line)
        lyric_str = "".join(lyric_line)

        if chord_str.strip():
            result.append(chord_str)
        result.append(lyric_str)

    return "\n".join(result)


def realign_chords(original_text: str, rewritten_lyrics: str) -> str:
    """Realign chords from the original text above the rewritten lyrics.

    Strategy: map chord positions proportionally from old lyrics to new lyrics,
    snapping to the nearest word/syllable boundary.
    """
    original_parsed = separate_chords_and_lyrics(original_text)
    rewritten_lines = rewritten_lyrics.split("\n")

    result = []
    rewrite_idx = 0

    for entry in original_parsed:
        if entry["chords"] is not None:
            # This was a chord+lyric pair
            original_lyric = entry["lyrics"]
            chord_line = entry["chords"]

            if rewrite_idx < len(rewritten_lines):
                new_lyric = rewritten_lines[rewrite_idx]
                rewrite_idx += 1
            else:
                new_lyric = ""

            if not new_lyric.strip():
                result.append(chord_line)
                result.append(new_lyric)
                continue

            # Extract chord positions from original
            chord_positions = _extract_chord_positions(chord_line)

            # Remap to new lyric
            new_chord_line = _place_chords(chord_positions, original_lyric, new_lyric)
            result.append(new_chord_line)
            result.append(new_lyric)
        else:
            # Non-chord line: could be section header, empty, or lyric-only
            if rewrite_idx < len(rewritten_lines):
                result.append(rewritten_lines[rewrite_idx])
                rewrite_idx += 1
            else:
                result.append(entry["lyrics"])

    # Append any remaining rewritten lines
    while rewrite_idx < len(rewritten_lines):
        result.append(rewritten_lines[rewrite_idx])
        rewrite_idx += 1

    return "\n".join(result)


def _extract_chord_positions(chord_line: str) -> list[tuple[int, str]]:
    """Extract (position, chord_name) pairs from a chord line."""
    positions = []
    i = 0
    while i < len(chord_line):
        if chord_line[i] != " ":
            j = i
            while j < len(chord_line) and chord_line[j] != " ":
                j += 1
            positions.append((i, chord_line[i:j]))
            i = j
        else:
            i += 1
    return positions


def _place_chords(
    chord_positions: list[tuple[int, str]],
    original_lyric: str,
    new_lyric: str,
) -> str:
    """Place chords above new lyric using proportional mapping."""
    if not chord_positions:
        return ""

    old_len = max(len(original_lyric), 1)
    new_len = max(len(new_lyric), 1)

    new_positions = []
    for pos, chord in chord_positions:
        # Proportional mapping
        new_pos = int(pos * new_len / old_len)
        # Snap to nearest word boundary (space or start)
        new_pos = _snap_to_boundary(new_lyric, new_pos)
        new_positions.append((new_pos, chord))

    # Build the chord line ensuring no overlaps
    chord_line = list(" " * (new_len + 10))
    for pos, chord in new_positions:
        pos = max(0, min(pos, len(chord_line) - len(chord)))
        # Check for overlap with existing chords
        while any(chord_line[pos + k] != " " for k in range(len(chord)) if pos + k < len(chord_line)):
            pos += 1
            if pos >= len(chord_line) - len(chord):
                break
        for k, ch in enumerate(chord):
            if pos + k < len(chord_line):
                chord_line[pos + k] = ch

    return "".join(chord_line).rstrip()


def _snap_to_boundary(text: str, pos: int) -> int:
    """Snap a position to the nearest word boundary in text."""
    if pos <= 0:
        return 0
    if pos >= len(text):
        return len(text)

    # If already at a word start (preceded by space or at position 0), keep it
    if pos == 0 or text[pos - 1] == " ":
        return pos

    # Search left and right for nearest word boundary
    left = pos
    while left > 0 and text[left - 1] != " ":
        left -= 1

    right = pos
    while right < len(text) and text[right - 1] != " ":
        right += 1

    # Return whichever is closer
    if pos - left <= right - pos:
        return left
    return right
