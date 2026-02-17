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

    // Attach event listeners via delegation
    list.addEventListener('click', (e) => this.handleClick(e));
  },

  handleClick(e) {
    const target = e.target;

    // Toggle card body
    const header = target.closest('.library-card-header');
    if (header && !target.closest('button')) {
      const body = header.nextElementSibling;
      body.classList.toggle('open');

      // Load revisions on first open
      const songId = header.dataset.songId;
      if (body.classList.contains('open') && songId) {
        this.loadRevisions(parseInt(songId), body);
      }
      return;
    }

    // Delete button
    const deleteBtn = target.closest('.delete-song-btn');
    if (deleteBtn) {
      e.stopPropagation();
      this.deleteSong(parseInt(deleteBtn.dataset.id));
      return;
    }

    // Continue editing button
    const editBtn = target.closest('.continue-edit-btn');
    if (editBtn) {
      e.stopPropagation();
      const songId = parseInt(editBtn.dataset.id);
      const song = this.songs.find(s => s.id === songId);
      if (song) {
        RewriteManager.loadSongForEditing(song);
      }
      return;
    }
  },

  renderCard(song) {
    const date = new Date(song.created_at).toLocaleDateString();
    const title = song.title || 'Untitled';
    const artist = song.artist ? ` by ${song.artist}` : '';
    const model = song.llm_model ? ` &middot; ${song.llm_model}` : '';
    const statusClass = song.status === 'completed' ? 'completed' : 'draft';
    const statusLabel = song.status === 'completed' ? 'Completed' : 'Draft';
    const versionInfo = song.current_version > 1 ? ` &middot; v${song.current_version}` : '';

    return `
      <div class="library-card">
        <div class="library-card-header" data-song-id="${song.id}">
          <div class="library-card-info">
            <h3>${this.escapeHtml(title)}${this.escapeHtml(artist)}
              <span class="status-badge ${statusClass}">${statusLabel}</span>
            </h3>
            <span class="meta">${date}${model}${versionInfo}</span>
          </div>
          <div class="library-card-actions">
            ${song.status !== 'completed' ? `<button class="btn secondary continue-edit-btn" data-id="${song.id}">Continue Editing</button>` : ''}
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
          <div class="revision-list" id="revisions-${song.id}"></div>
        </div>
      </div>
    `;
  },

  async loadRevisions(songId, bodyEl) {
    const container = bodyEl.querySelector(`#revisions-${songId}`);
    if (!container || container.dataset.loaded) return;

    try {
      const revisions = await API.getSongRevisions(songId);
      if (revisions.length <= 1) {
        container.innerHTML = '';
        return;
      }

      container.dataset.loaded = 'true';
      container.innerHTML = `
        <h4>Revision History (${revisions.length} versions)</h4>
        ${revisions.map(rev => {
          const date = new Date(rev.created_at).toLocaleString();
          const typeLabel = rev.edit_type === 'line' ? 'Line edit' : 'Full rewrite';
          return `<div class="revision-item">
            v${rev.version} &mdash; ${typeLabel} &mdash; ${rev.changes_summary || 'No summary'} &mdash; ${date}
          </div>`;
        }).join('')}
      `;
    } catch (err) {
      console.error('Failed to load revisions:', err);
    }
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
