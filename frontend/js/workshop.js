/**
 * Workshop panel for line-level editing.
 * Click a lyric line → get 3 alternatives from the LLM → pick one.
 */
const WorkshopManager = {
  selectedLineIndex: null,
  songId: null,

  init() {
    // Close button
    const closeBtn = document.getElementById('workshop-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Get alternatives button
    const getBtn = document.getElementById('workshop-get-btn');
    if (getBtn) {
      getBtn.addEventListener('click', () => this.getAlternatives());
    }

    // Delegate clicks on alternatives
    const altsList = document.getElementById('workshop-alternatives');
    if (altsList) {
      altsList.addEventListener('click', (e) => {
        const item = e.target.closest('.workshop-alt-item');
        if (item) {
          // Select this alternative
          altsList.querySelectorAll('.workshop-alt-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
        }
      });
    }

    // Apply button
    const applyBtn = document.getElementById('workshop-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applySelected());
    }
  },

  setSongId(id) {
    this.songId = id;
  },

  open(lineIndex) {
    if (!this.songId) {
      alert('Song must be saved as a draft before editing individual lines.');
      return;
    }

    this.selectedLineIndex = lineIndex;
    const panel = document.getElementById('workshop-panel');
    panel.classList.remove('hidden');

    // Clear previous state
    document.getElementById('workshop-instruction').value = '';
    document.getElementById('workshop-alternatives').innerHTML = '';
    document.getElementById('workshop-apply-btn').classList.add('hidden');

    // Show which line is selected
    const rewriteDisplay = document.getElementById('rewritten-display');
    rewriteDisplay.querySelectorAll('.line-selected').forEach(el => el.classList.remove('line-selected'));
    const targetSpan = rewriteDisplay.querySelector(`[data-line="${lineIndex}"]`);
    if (targetSpan) {
      targetSpan.classList.add('line-selected');
      document.getElementById('workshop-current-line').textContent = targetSpan.textContent;
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  close() {
    const panel = document.getElementById('workshop-panel');
    panel.classList.add('hidden');
    this.selectedLineIndex = null;

    // Remove selection highlights
    const rewriteDisplay = document.getElementById('rewritten-display');
    rewriteDisplay.querySelectorAll('.line-selected').forEach(el => el.classList.remove('line-selected'));
  },

  async getAlternatives() {
    if (this.selectedLineIndex === null || !this.songId) return;

    const instruction = document.getElementById('workshop-instruction').value.trim() || null;
    const llm = RewriteManager.getLLMSettings();

    const altsList = document.getElementById('workshop-alternatives');
    altsList.innerHTML = '<div class="loading"><div class="spinner"></div><span>Getting alternatives...</span></div>';
    document.getElementById('workshop-apply-btn').classList.add('hidden');

    try {
      const result = await API.workshopLine({
        song_id: this.songId,
        line_index: this.selectedLineIndex,
        instruction,
        ...llm,
      });

      this.renderAlternatives(result);
    } catch (err) {
      altsList.innerHTML = `<p class="error-text">Error: ${this.escapeHtml(err.message)}</p>`;
    }
  },

  renderAlternatives(result) {
    const altsList = document.getElementById('workshop-alternatives');
    document.getElementById('workshop-original-line').textContent = result.original_line;
    document.getElementById('workshop-current-line').textContent = result.current_line;

    if (!result.alternatives || result.alternatives.length === 0) {
      altsList.innerHTML = '<p>No alternatives generated. Try again with different instructions.</p>';
      return;
    }

    altsList.innerHTML = result.alternatives.map((alt, i) => `
      <div class="workshop-alt-item" data-text="${this.escapeAttr(alt.text)}">
        <div class="workshop-alt-text">${i + 1}. ${this.escapeHtml(alt.text)}</div>
        ${alt.reasoning ? `<div class="workshop-alt-reason">${this.escapeHtml(alt.reasoning)}</div>` : ''}
      </div>
    `).join('');

    document.getElementById('workshop-apply-btn').classList.remove('hidden');
  },

  async applySelected() {
    const selected = document.querySelector('.workshop-alt-item.selected');
    if (!selected) {
      alert('Please select an alternative first.');
      return;
    }

    const newText = selected.dataset.text;

    try {
      const result = await API.applyEdit({
        song_id: this.songId,
        line_index: this.selectedLineIndex,
        new_line_text: newText,
      });

      // Update the display with new lyrics
      if (RewriteManager.lastResult) {
        RewriteManager.lastResult.rewritten_lyrics = result.rewritten_lyrics;
      }

      // Re-render the rewritten panel
      const rewriteDisplay = document.getElementById('rewritten-display');
      rewriteDisplay.innerHTML = ComparisonView.renderLyrics(result.rewritten_lyrics);
      ComparisonView.highlightChanges(
        RewriteManager.lastResult ? RewriteManager.lastResult.original_lyrics : '',
        result.rewritten_lyrics
      );

      // Re-attach clickable handlers
      ComparisonView.makeRewrittenLinesClickable();

      this.close();
    } catch (err) {
      alert('Failed to apply edit: ' + err.message);
    }
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};
