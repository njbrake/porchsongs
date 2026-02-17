from any_llm import completion

from .chord_parser import extract_lyrics_only, realign_chords

SYSTEM_PROMPT = """You are a songwriter's assistant. You adapt song lyrics so they feel personally
relevant to the singer while preserving the song's musical structure perfectly.

ABSOLUTE RULES:
1. SYLLABLE COUNT: Each line MUST have the same number of syllables as the original.
2. RHYME SCHEME: Keep the exact same rhyme pattern.
3. THEME & EMOTION: Same emotional arc. A love verse stays love. Nostalgia stays nostalgic.
4. SINGABILITY: Words must sound natural when sung. No forced rhymes.
5. MINIMAL CHANGES: Only change what doesn't fit. Leave lines that already work."""

AVAILABLE_PROVIDERS = {
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
    ],
    "anthropic": [
        "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001",
        "claude-3-5-sonnet-20241022",
    ],
    "google": [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
    ],
    "mistral": [
        "mistral-large-latest",
        "mistral-medium-latest",
        "mistral-small-latest",
    ],
    "ollama": [
        "llama3",
        "mistral",
        "codellama",
    ],
}


def get_providers() -> list[dict]:
    """Return list of available providers and their models."""
    return [
        {"name": provider, "models": models}
        for provider, models in AVAILABLE_PROVIDERS.items()
    ]


def build_user_prompt(profile: dict, title: str | None, artist: str | None, lyrics: str) -> str:
    """Build the user prompt for the LLM."""
    prompt_parts = ["ABOUT THE SINGER:"]

    if profile.get("location_description"):
        prompt_parts.append(f"- Lives in: {profile['location_description']}")
    if profile.get("location_type"):
        prompt_parts.append(f"- Setting: {profile['location_type']}")
    if profile.get("occupation"):
        prompt_parts.append(f"- Works as: {profile['occupation']}")
    if profile.get("hobbies"):
        prompt_parts.append(f"- Hobbies: {profile['hobbies']}")
    if profile.get("family_situation"):
        prompt_parts.append(f"- Family: {profile['family_situation']}")
    if profile.get("daily_routine"):
        prompt_parts.append(f"- Daily life: {profile['daily_routine']}")
    if profile.get("custom_references"):
        prompt_parts.append(f"- Wants referenced: {profile['custom_references']}")

    prompt_parts.append("")

    song_label = ""
    if title:
        song_label = f'"{title}"'
        if artist:
            song_label += f" by {artist}"
    elif artist:
        song_label = f"by {artist}"

    if song_label:
        prompt_parts.append(f"SONG: {song_label}")
        prompt_parts.append("")

    prompt_parts.append(
        "Rewrite these lyrics to feel like the singer's own life. Same syllable count per line, "
        "same rhyme scheme, same emotions. Only change imagery/references that don't fit."
    )
    prompt_parts.append("")
    prompt_parts.append("ORIGINAL LYRICS:")
    prompt_parts.append(lyrics)
    prompt_parts.append("")
    prompt_parts.append(
        'Return ONLY the rewritten lyrics (one line per original line, same line count).\n'
        'Then add "---CHANGES---" followed by a brief list of what you changed and why.'
    )

    return "\n".join(prompt_parts)


async def rewrite_lyrics(
    profile: dict,
    title: str | None,
    artist: str | None,
    lyrics_with_chords: str,
    provider: str,
    model: str,
    api_key: str,
) -> dict:
    """Rewrite lyrics using the configured LLM.

    Returns dict with: original_lyrics, rewritten_lyrics, changes_summary
    """
    # Separate chords from lyrics
    lyrics_only = extract_lyrics_only(lyrics_with_chords)

    # Build prompt
    user_prompt = build_user_prompt(profile, title, artist, lyrics_only)

    # Call the LLM via any-llm-sdk
    response = completion(
        model=model,
        provider=provider,
        api_key=api_key,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    raw_response = response.choices[0].message.content

    # Parse the response: split on ---CHANGES---
    if "---CHANGES---" in raw_response:
        parts = raw_response.split("---CHANGES---", 1)
        rewritten_lyrics_only = parts[0].strip()
        changes_summary = parts[1].strip()
    else:
        rewritten_lyrics_only = raw_response.strip()
        changes_summary = "No change summary provided by the model."

    # Realign chords above the rewritten lyrics
    rewritten_with_chords = realign_chords(lyrics_with_chords, rewritten_lyrics_only)

    return {
        "original_lyrics": lyrics_with_chords,
        "rewritten_lyrics": rewritten_with_chords,
        "changes_summary": changes_summary,
    }
