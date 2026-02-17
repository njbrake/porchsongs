/**
 * Rewrite tab logic: URL input, manual input, triggering rewrites.
 */
const RewriteManager = {
  lastResult: null,
  lastMeta: null,
  currentSongId: null,

  init() {
    document.getElementById('fetch-rewrite-btn').addEventListener('click', () => this.fetchAndRewrite());
    document.getElementById('manual-rewrite-btn').addEventListener('click', () => this.manualRewrite());
    document.getElementById('toggle-manual').addEventListener('click', () => this.toggleManual());
    document.getElementById('save-btn').addEventListener('click', () => this.markComplete());

    // Enter key on URL input
    document.getElementById('ug-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.fetchAndRewrite();
    });
  },

  toggleManual() {
    const section = document.getElementById('manual-section');
    section.classList.toggle('hidden');
  },

  getLLMSettings() {
    const provider = localStorage.getItem('porchsongs_provider') || 'openai';
    const model = localStorage.getItem('porchsongs_model') || 'gpt-4o';
    const apiKey = localStorage.getItem('porchsongs_api_key') || '';
    return { provider, model, api_key: apiKey };
  },

  validateSettings() {
    const { api_key } = this.getLLMSettings();
    if (!api_key) {
      alert('Please configure your LLM API key in Settings (gear icon).');
      return false;
    }
    return true;
  },

  validateProfile() {
    const profileId = ProfileManager.getActiveProfileId();
    if (!profileId) {
      alert('Please create a profile first (Profile tab).');
      App.switchTab('profile');
      return false;
    }
    return true;
  },

  showLoading(show) {
    document.getElementById('loading-indicator').classList.toggle('hidden', !show);
    document.getElementById('fetch-rewrite-btn').disabled = show;
    document.getElementById('manual-rewrite-btn').disabled = show;
  },

  async fetchAndRewrite() {
    const url = document.getElementById('ug-url').value.trim();
    if (!url) {
      alert('Please paste an Ultimate Guitar URL.');
      return;
    }
    if (!this.validateProfile() || !this.validateSettings()) return;

    this.showLoading(true);
    this.currentSongId = null;
    document.getElementById('comparison-section').classList.add('hidden');

    try {
      // Step 1: Fetch tab
      const tab = await API.fetchTab(url);

      // Step 2: Rewrite
      const profileId = ProfileManager.getActiveProfileId();
      const llm = this.getLLMSettings();
      const result = await API.rewrite({
        profile_id: profileId,
        title: tab.title,
        artist: tab.artist,
        lyrics: tab.lyrics_with_chords,
        source_url: url,
        ...llm,
      });

      this.lastResult = result;
      this.lastMeta = {
        title: tab.title,
        artist: tab.artist,
        source_url: url,
        profile_id: profileId,
        llm_provider: llm.provider,
        llm_model: llm.model,
      };

      ComparisonView.show(result, tab.title, tab.artist);

      // Auto-save as draft
      await this.autoSaveDraft();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  async manualRewrite() {
    const lyrics = document.getElementById('manual-lyrics').value.trim();
    if (!lyrics) {
      alert('Please paste some lyrics.');
      return;
    }
    if (!this.validateProfile() || !this.validateSettings()) return;

    const title = document.getElementById('manual-title').value.trim() || null;
    const artist = document.getElementById('manual-artist').value.trim() || null;

    this.showLoading(true);
    this.currentSongId = null;
    document.getElementById('comparison-section').classList.add('hidden');

    try {
      const profileId = ProfileManager.getActiveProfileId();
      const llm = this.getLLMSettings();
      const result = await API.rewrite({
        profile_id: profileId,
        title,
        artist,
        lyrics,
        ...llm,
      });

      this.lastResult = result;
      this.lastMeta = {
        title: title || 'Untitled',
        artist,
        source_url: null,
        profile_id: profileId,
        llm_provider: llm.provider,
        llm_model: llm.model,
      };

      ComparisonView.show(result, title, artist);

      // Auto-save as draft
      await this.autoSaveDraft();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  async autoSaveDraft() {
    if (!this.lastResult || !this.lastMeta) return;

    try {
      const song = await API.saveSong({
        profile_id: this.lastMeta.profile_id,
        title: this.lastMeta.title,
        artist: this.lastMeta.artist,
        source_url: this.lastMeta.source_url,
        original_lyrics: this.lastResult.original_lyrics,
        rewritten_lyrics: this.lastResult.rewritten_lyrics,
        changes_summary: this.lastResult.changes_summary,
        llm_provider: this.lastMeta.llm_provider,
        llm_model: this.lastMeta.llm_model,
      });

      this.currentSongId = song.id;
      WorkshopManager.setSongId(song.id);

      // Update button to show "Mark as Complete"
      const saveBtn = document.getElementById('save-btn');
      saveBtn.textContent = 'Mark as Complete';
      saveBtn.disabled = false;
    } catch (err) {
      console.error('Auto-save draft failed:', err);
    }
  },

  async markComplete() {
    if (!this.currentSongId) {
      // Fallback: if for some reason we don't have a song ID, do a regular save
      await this.autoSaveDraft();
      if (!this.currentSongId) return;
    }

    const llm = this.getLLMSettings();

    try {
      await API.updateSongStatus(this.currentSongId, {
        status: 'completed',
        provider: llm.provider,
        model: llm.model,
        api_key: llm.api_key,
      });

      const saveBtn = document.getElementById('save-btn');
      saveBtn.textContent = 'Completed!';
      saveBtn.disabled = true;
      setTimeout(() => {
        saveBtn.textContent = 'Mark as Complete';
        saveBtn.disabled = false;
      }, 2000);
    } catch (err) {
      alert('Failed to mark as complete: ' + err.message);
    }
  },

  /**
   * Load a song back into the rewrite view for continued editing.
   */
  loadSongForEditing(song) {
    this.lastResult = {
      original_lyrics: song.original_lyrics,
      rewritten_lyrics: song.rewritten_lyrics,
      changes_summary: song.changes_summary || '',
    };
    this.lastMeta = {
      title: song.title,
      artist: song.artist,
      source_url: song.source_url,
      profile_id: song.profile_id,
      llm_provider: song.llm_provider,
      llm_model: song.llm_model,
    };
    this.currentSongId = song.id;
    WorkshopManager.setSongId(song.id);

    ComparisonView.show(this.lastResult, song.title, song.artist);

    // Update button based on status
    const saveBtn = document.getElementById('save-btn');
    if (song.status === 'completed') {
      saveBtn.textContent = 'Completed';
      saveBtn.disabled = true;
    } else {
      saveBtn.textContent = 'Mark as Complete';
      saveBtn.disabled = false;
    }

    App.switchTab('rewrite');
  },
};
