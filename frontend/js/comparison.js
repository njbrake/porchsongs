/**
 * Side-by-side comparison view for original vs rewritten lyrics.
 */
const ComparisonView = {
  show(result, title, artist) {
    const section = document.getElementById('comparison-section');
    section.classList.remove('hidden');

    // Title
    let heading = title || 'Rewritten Song';
    if (artist) heading += ` — ${artist}`;
    document.getElementById('comparison-title').textContent = heading;

    // Render lyrics with highlighting
    document.getElementById('original-display').innerHTML = this.renderLyrics(result.original_lyrics);
    document.getElementById('rewritten-display').innerHTML = this.renderLyrics(result.rewritten_lyrics);

    // Highlight changed lines
    this.highlightChanges(result.original_lyrics, result.rewritten_lyrics);

    // Changes summary
    document.getElementById('changes-display').textContent = result.changes_summary;

    // Scroll to comparison
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderLyrics(text) {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const escaped = this.escapeHtml(line);
      const isChord = this.isChordLine(line);
      const cls = isChord ? 'line-chord' : '';
      return `<span class="${cls}" data-line="${i}">${escaped}</span>`;
    }).join('\n');
  },

  highlightChanges(original, rewritten) {
    const origLines = original.split('\n');
    const rewriteLines = rewritten.split('\n');
    const origContainer = document.getElementById('original-display');
    const rewriteContainer = document.getElementById('rewritten-display');

    // Compare non-chord lines
    const maxLen = Math.max(origLines.length, rewriteLines.length);
    for (let i = 0; i < maxLen; i++) {
      const oLine = origLines[i] || '';
      const rLine = rewriteLines[i] || '';

      if (oLine !== rLine && !this.isChordLine(oLine) && !this.isChordLine(rLine)) {
        const oSpan = origContainer.querySelector(`[data-line="${i}"]`);
        const rSpan = rewriteContainer.querySelector(`[data-line="${i}"]`);
        if (oSpan) oSpan.classList.add('line-changed');
        if (rSpan) rSpan.classList.add('line-changed');
      }
    }
  },

  isChordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const tokens = trimmed.split(/\s+/);
    return tokens.every(t => /^[A-G][#b]?(m|maj|min|dim|aug|sus[24]?|add\d+|\d+|\/[A-G][#b]?)*$/.test(t));
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
