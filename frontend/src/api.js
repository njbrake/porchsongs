const BASE = '/api';

async function _fetch(path, options = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

const api = {
  // Profiles
  listProfiles: () => _fetch('/profiles'),
  createProfile: (data) => _fetch('/profiles', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: (id) => _fetch(`/profiles/${id}`),
  updateProfile: (id, data) => _fetch(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProfile: (id) => _fetch(`/profiles/${id}`, { method: 'DELETE' }),

  // Tab
  fetchTab: (url) => _fetch('/fetch-tab', { method: 'POST', body: JSON.stringify({ url }) }),

  // Rewrite
  rewrite: (data) => _fetch('/rewrite', { method: 'POST', body: JSON.stringify(data) }),

  // Songs
  listSongs: (profileId) => {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return _fetch(`/songs${query}`);
  },
  getSong: (id) => _fetch(`/songs/${id}`),
  saveSong: (data) => _fetch('/songs', { method: 'POST', body: JSON.stringify(data) }),
  deleteSong: (id) => _fetch(`/songs/${id}`, { method: 'DELETE' }),
  updateSongStatus: (id, data) => _fetch(`/songs/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  getSongRevisions: (id) => _fetch(`/songs/${id}/revisions`),

  // Workshop
  workshopLine: (data) => _fetch('/workshop-line', { method: 'POST', body: JSON.stringify(data) }),
  applyEdit: (data) => _fetch('/apply-edit', { method: 'POST', body: JSON.stringify(data) }),

  // Chat
  chat: (data) => _fetch('/chat', { method: 'POST', body: JSON.stringify(data) }),

  // Patterns
  getPatterns: (profileId) => {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return _fetch(`/patterns${query}`);
  },

  // Providers
  listProviders: () => _fetch('/providers'),
  verifyConnection: (data) => _fetch('/verify-connection', { method: 'POST', body: JSON.stringify(data) }),
};

export default api;
