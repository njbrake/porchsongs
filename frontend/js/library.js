/**
 * Song library browser.
 */
const LibraryManager = {
  songs: [],

  init() {
    // Will be loaded when the Library tab is opened
  },

  async load() {
    try {
      this.songs = await API.listSongs();
      this.render();
    } catch (err) {
      console.error('Failed to load songs:', err);
    }
  },

  render() {
    const list = document.getElementById('library-list');
    const empty = document.getElementById('library-empty');

    if (this.songs.length === 0) {
      empty.classList.remove('hidden');
      list.innerHTML = '';
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = this.songs.map(song => this.renderCard(song)).join('');

    // Attach event listeners
    list.querySelectorAll('.library-card-header').forEach(header => {
      header.addEventListener('click', () => {
        const body = header.nextElementSibling;
        body.classList.toggle('open');
      });
    });

    list.querySelectorAll('.delete-song-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSong(parseInt(btn.dataset.id));
      });
    });
  },

  renderCard(song) {
    const date = new Date(song.created_at).toLocaleDateString();
    const title = song.title || 'Untitled';
    const artist = song.artist ? ` by ${song.artist}` : '';
    const model = song.llm_model ? ` &middot; ${song.llm_model}` : '';

    return `
      <div class="library-card">
        <div class="library-card-header">
          <div class="library-card-info">
            <h3>${this.escapeHtml(title)}${this.escapeHtml(artist)}</h3>
            <span class="meta">${date}${model}</span>
          </div>
          <div class="library-card-actions">
            <button class="btn danger delete-song-btn" data-id="${song.id}">Delete</button>
          </div>
        </div>
        <div class="library-card-body">
          <div class="comparison-panels">
            <div class="panel">
              <h3>Original</h3>
              <pre class="lyrics-display">${this.escapeHtml(song.original_lyrics)}</pre>
            </div>
            <div class="panel">
              <h3>Your Version</h3>
              <pre class="lyrics-display">${this.escapeHtml(song.rewritten_lyrics)}</pre>
            </div>
          </div>
          ${song.changes_summary ? `
          <div class="changes-summary" style="margin-top: 1rem;">
            <h3>Changes</h3>
            <div>${this.escapeHtml(song.changes_summary)}</div>
          </div>` : ''}
        </div>
      </div>
    `;
  },

  async deleteSong(id) {
    if (!confirm('Delete this saved song?')) return;
    try {
      await API.deleteSong(id);
      this.songs = this.songs.filter(s => s.id !== id);
      this.render();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
