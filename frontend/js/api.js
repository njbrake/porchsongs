/**
 * API client for PorchSongs backend.
 */
const API = {
  base: '/api',

  async _fetch(path, options = {}) {
    const url = this.base + path;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed: ${res.status}`);
    }
    return res.json();
  },

  // Profiles
  listProfiles() {
    return this._fetch('/profiles');
  },

  createProfile(data) {
    return this._fetch('/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getProfile(id) {
    return this._fetch(`/profiles/${id}`);
  },

  updateProfile(id, data) {
    return this._fetch(`/profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProfile(id) {
    return this._fetch(`/profiles/${id}`, { method: 'DELETE' });
  },

  // Tab Fetching
  fetchTab(url) {
    return this._fetch('/fetch-tab', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  // Rewrite
  rewrite(data) {
    return this._fetch('/rewrite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Songs
  listSongs(profileId) {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return this._fetch(`/songs${query}`);
  },

  getSong(id) {
    return this._fetch(`/songs/${id}`);
  },

  saveSong(data) {
    return this._fetch('/songs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteSong(id) {
    return this._fetch(`/songs/${id}`, { method: 'DELETE' });
  },

  updateSongStatus(id, data) {
    return this._fetch(`/songs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getSongRevisions(id) {
    return this._fetch(`/songs/${id}/revisions`);
  },

  // Workshop
  workshopLine(data) {
    return this._fetch('/workshop-line', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  applyEdit(data) {
    return this._fetch('/apply-edit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Patterns
  getPatterns(profileId) {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return this._fetch(`/patterns${query}`);
  },

  // Providers
  listProviders() {
    return this._fetch('/providers');
  },
};
