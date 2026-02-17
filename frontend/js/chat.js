/**
 * Chat-based lyric workshop.
 * Conversational editing: send instructions, get updated lyrics back.
 */
const ChatManager = {
  songId: null,
  messages: [],
  MAX_MESSAGES: 20,

  init() {
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.send());
    }
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.send();
        }
      });
    }
  },

  setSongId(id) {
    this.songId = id;
    const panel = document.getElementById('chat-panel');
    if (panel) panel.classList.remove('hidden');
  },

  reset() {
    this.songId = null;
    this.messages = [];
    const panel = document.getElementById('chat-panel');
    if (panel) panel.classList.add('hidden');
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) messagesEl.innerHTML = '';
  },

  async send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !this.songId) return;

    input.value = '';

    // Add user message
    this.messages.push({ role: 'user', content: text });
    this.renderMessage('user', text);

    // Trim to max messages
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(-this.MAX_MESSAGES);
    }

    const llm = RewriteManager.getLLMSettings();

    // Show typing indicator
    this.showTyping(true);

    try {
      const result = await API.chat({
        song_id: this.songId,
        messages: this.messages,
        ...llm,
      });

      this.showTyping(false);

      // Add assistant message (just the explanation, not the raw response with markers)
      this.messages.push({ role: 'assistant', content: result.changes_summary });
      this.renderMessage('assistant', result.changes_summary);

      // Update the rewritten lyrics in RewriteManager
      if (RewriteManager.lastResult) {
        RewriteManager.lastResult.rewritten_lyrics = result.rewritten_lyrics;
      }

      // Re-render the "Your Version" panel
      const rewriteDisplay = document.getElementById('rewritten-display');
      rewriteDisplay.innerHTML = ComparisonView.renderLyrics(result.rewritten_lyrics);
      ComparisonView.highlightChanges(
        RewriteManager.lastResult ? RewriteManager.lastResult.original_lyrics : '',
        result.rewritten_lyrics
      );
      ComparisonView.makeRewrittenLinesClickable();

    } catch (err) {
      this.showTyping(false);
      this.renderMessage('assistant', 'Error: ' + err.message);
    }
  },

  addSystemNote(text) {
    this.messages.push({ role: 'user', content: `[System note: ${text}]` });
    this.renderNote(text);
  },

  renderMessage(role, content) {
    const messagesEl = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  },

  renderNote(text) {
    const messagesEl = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-note';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  },

  showTyping(show) {
    const el = document.getElementById('chat-typing');
    if (el) el.classList.toggle('hidden', !show);
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = show;
  },
};
