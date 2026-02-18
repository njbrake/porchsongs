import json
import re

import requests
from bs4 import BeautifulSoup


def fetch_tab(url: str) -> dict:
    """Fetch and parse an Ultimate Guitar tab page.

    Returns dict with keys: title, artist, lyrics_with_chords, chord_format.
    """
    if "ultimate-guitar.com" not in url:
        raise ValueError("URL must be from ultimate-guitar.com")

    # Normalize URL: strip print/export URLs back to the regular tab page
    url = _normalize_url(url)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.ultimate-guitar.com/",
        "DNT": "1",
    }
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # UG stores tab data as JSON inside a <div class="js-store"> data-content attribute
    store_div = soup.find("div", class_="js-store")
    if not store_div or not store_div.get("data-content"):
        raise ValueError("Could not find tab data on page. The URL may be invalid.")

    raw = store_div["data-content"]
    data = json.loads(raw)

    # Navigate the JSON structure to find tab info
    tab_data = data.get("store", {}).get("page", {}).get("data", {})
    tab_view = tab_data.get("tab_view", {})
    tab_info = tab_data.get("tab", {})

    title = tab_info.get("song_name", "Unknown")
    artist = tab_info.get("artist_name", "Unknown")

    # The actual content with chords
    wiki_tab = tab_view.get("wiki_tab", {})
    content = wiki_tab.get("content", "")

    if not content:
        # Fallback: try meta_content or other fields
        content = tab_view.get("meta", {}).get("content", "")

    if not content:
        raise ValueError("Could not extract lyrics/chords from this tab.")

    # Clean up UG's HTML-like chord annotations
    content = _clean_ug_content(content)

    chord_format = "above-line"

    return {
        "title": title,
        "artist": artist,
        "lyrics_with_chords": content,
        "chord_format": chord_format,
    }


def _normalize_url(url: str) -> str:
    """Convert print/export URLs back to regular tab page URLs."""
    # Handle print URLs like /tab/print?...&id=5316195&...
    if "/tab/print" in url:
        match = re.search(r"[?&]id=(\d+)", url)
        if match:
            tab_id = match.group(1)
            return f"https://tabs.ultimate-guitar.com/tab/{tab_id}"
    return url


def _clean_ug_content(content: str) -> str:
    """Clean UG's custom markup into plain text with chords."""
    # Replace [ch]X[/ch] with just X (chord names)
    content = re.sub(r"\[ch\](.*?)\[/ch\]", r"\1", content)
    # Remove [tab] and [/tab] wrappers
    content = re.sub(r"\[/?tab\]", "", content)
    # Normalize line endings
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    # Strip leading/trailing whitespace
    content = content.strip()
    return content
