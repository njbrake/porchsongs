from fpdf import FPDF


def generate_song_pdf(title: str, artist: str | None, lyrics: str) -> bytes:
    """Generate a PDF for a song with monospace lyrics to preserve chord alignment."""
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # --- Header: title + artist ---
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, title or "Untitled", new_x="LMARGIN", new_y="NEXT")

    if artist:
        pdf.set_font("Helvetica", "", 12)
        pdf.cell(0, 7, artist, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(5)

    # --- Lyrics in monospace ---
    # Determine font size: start at 10pt, shrink if any line overflows the page width
    usable_width = pdf.w - pdf.l_margin - pdf.r_margin
    font_size = _fit_font_size(pdf, lyrics, usable_width)

    pdf.set_font("Courier", "", font_size)
    line_height = font_size * 0.45  # mm per line, tuned for readability

    for line in lyrics.split("\n"):
        pdf.cell(0, line_height, line, new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def _fit_font_size(pdf: FPDF, text: str, max_width: float) -> float:
    """Find the largest font size (max 10pt, min 6pt) where no line exceeds max_width."""
    lines = text.split("\n")
    for size in (10, 9, 8, 7, 6):
        pdf.set_font("Courier", "", size)
        if all(pdf.get_string_width(line) <= max_width for line in lines):
            return float(size)
    return 6.0
