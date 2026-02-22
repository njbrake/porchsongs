import re


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


def separate_chords_and_text(text: str) -> list[dict[str, str | None]]:
    """Separate chord lines from text lines.

    Returns a list of dicts with structure:
        {"chords": "G   Am  C" or None, "text": "Take me home..." or ""}

    Chord lines are paired with the text line immediately below them.
    """
    lines = text.split("\n")
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        if is_chord_line(line):
            chords = line
            # Look ahead for the text line
            if i + 1 < len(lines) and not is_chord_line(lines[i + 1]):
                text_line = lines[i + 1]
                i += 2
            else:
                # Chord line with no text below (e.g., instrumental)
                text_line = ""
                i += 1
            result.append({"chords": chords, "text": text_line})
        else:
            # Pure text line or empty/section header
            result.append({"chords": None, "text": line})
            i += 1

    return result


def extract_text_only(text: str) -> str:
    """Extract only the text lines (no chords) for sending to the LLM."""
    parsed = separate_chords_and_text(text)
    text_lines = []
    for entry in parsed:
        text_lines.append(entry["text"])
    return "\n".join(text_lines)


def realign_chords(original_text: str, rewritten_content: str) -> str:
    """Realign chords from the original text above the rewritten content.

    Strategy: map chord positions proportionally from old text to new text,
    snapping to the nearest word/syllable boundary.
    """
    original_parsed = separate_chords_and_text(original_text)
    rewritten_lines = rewritten_content.split("\n")

    result = []
    rewrite_idx = 0

    for entry in original_parsed:
        if entry["chords"] is not None:
            # This was a chord+text pair
            original_line = entry["text"]
            chord_line = entry["chords"]

            if rewrite_idx < len(rewritten_lines):
                new_line = rewritten_lines[rewrite_idx]
                rewrite_idx += 1
            else:
                new_line = ""

            if not new_line.strip():
                result.append(chord_line)
                result.append(new_line)
                continue

            # Extract chord positions from original
            chord_positions = _extract_chord_positions(chord_line)

            # Remap to new line
            new_chord_line = _place_chords(chord_positions, original_line, new_line)
            result.append(new_chord_line)
            result.append(new_line)
        else:
            # Non-chord line: could be section header, empty, or text-only
            if rewrite_idx < len(rewritten_lines):
                result.append(rewritten_lines[rewrite_idx])
                rewrite_idx += 1
            else:
                result.append(entry["text"])

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
    original_line: str,
    new_line: str,
) -> str:
    """Place chords above new line using proportional mapping."""
    if not chord_positions:
        return ""

    old_len = max(len(original_line), 1)
    new_len = max(len(new_line), 1)

    new_positions = []
    for pos, chord in chord_positions:
        # Proportional mapping
        new_pos = int(pos * new_len / old_len)
        # Snap to nearest word boundary (space or start)
        new_pos = _snap_to_boundary(new_line, new_pos)
        new_positions.append((new_pos, chord))

    # Build the chord line ensuring no overlaps
    chord_line = list(" " * (new_len + 10))
    for pos, chord in new_positions:
        pos = max(0, min(pos, len(chord_line) - len(chord)))
        # Check for overlap with existing chords
        while any(
            chord_line[pos + k] != " " for k in range(len(chord)) if pos + k < len(chord_line)
        ):
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
