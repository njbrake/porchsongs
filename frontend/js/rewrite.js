/**
 * Rewrite tab logic: URL input, manual input, triggering rewrites.
 */
const RewriteManager = {
  lastResult: null,
  lastMeta: null,

  init() {
    document.getElementById('fetch-rewrite-btn').addEventListener('click', () => this.fetchAndRewrite());
    document.getElementById('manual-rewrite-btn').addEventListener('click', () => this.manualRewrite());
    document.getElementById('toggle-manual').addEventListener('click', () => this.toggleManual());
    document.getElementById('save-btn').addEventListener('click', () => this.saveSong());

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
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  },

  async saveSong() {
    if (!this.lastResult || !this.lastMeta) return;

    try {
      await API.saveSong({
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

      document.getElementById('save-btn').textContent = 'Saved!';
      document.getElementById('save-btn').disabled = true;
      setTimeout(() => {
        document.getElementById('save-btn').textContent = 'Save to Library';
        document.getElementById('save-btn').disabled = false;
      }, 2000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  },
};
