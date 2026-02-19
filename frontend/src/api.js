const BASE = '/api';

function _getAuthHeaders() {
  const secret = localStorage.getItem('porchsongs_app_secret');
  if (secret) {
    return { Authorization: `Bearer ${secret}` };
  }
  return {};
}

async function _fetch(path, options = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ..._getAuthHeaders(), ...options.headers },
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('porchsongs-logout'));
    throw new Error('Authentication required. Please log in.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function checkAuthRequired() {
  const res = await fetch(`${BASE}/auth-required`);
  return res.json();
}

async function login(password) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Login failed');
  }
  return res.json();
}

/**
 * Stream a rewrite via SSE. Calls onToken(text) for each chunk,
 * returns the final parsed result object.
 */
async function rewriteStream(data, { onToken } = {}) {
  const url = `${BASE}/rewrite?stream=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('porchsongs-logout'));
    throw new Error('Authentication required. Please log in.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split('\n');
    // Keep the last (possibly incomplete) line in the buffer
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.done) {
        finalResult = payload.result;
      } else if (payload.token && onToken) {
        onToken(payload.token);
      }
    }
  }

  // Process any remaining data in buffer
  if (buffer.startsWith('data: ')) {
    const payload = JSON.parse(buffer.slice(6));
    if (payload.done) {
      finalResult = payload.result;
    } else if (payload.token && onToken) {
      onToken(payload.token);
    }
  }

  if (!finalResult) {
    throw new Error('Stream ended without a final result');
  }
  return finalResult;
}

const api = {
  checkAuthRequired,
  login,
  // Profiles
  listProfiles: () => _fetch('/profiles'),
  createProfile: (data) => _fetch('/profiles', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: (id) => _fetch(`/profiles/${id}`),
  updateProfile: (id, data) => _fetch(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProfile: (id) => _fetch(`/profiles/${id}`, { method: 'DELETE' }),

  // Rewrite
  rewrite: (data) => _fetch('/rewrite', { method: 'POST', body: JSON.stringify(data) }),
  rewriteStream,

  // Songs
  listSongs: (profileId) => {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return _fetch(`/songs${query}`);
  },
  listFolders: () => _fetch('/songs/folders'),
  getSong: (id) => _fetch(`/songs/${id}`),
  saveSong: (data) => _fetch('/songs', { method: 'POST', body: JSON.stringify(data) }),
  updateSong: (id, data) => _fetch(`/songs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSong: (id) => _fetch(`/songs/${id}`, { method: 'DELETE' }),
  updateSongStatus: (id, data) => _fetch(`/songs/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  getSongRevisions: (id) => _fetch(`/songs/${id}/revisions`),

  // Workshop
  workshopLine: (data) => _fetch('/workshop-line', { method: 'POST', body: JSON.stringify(data) }),
  applyEdit: (data) => _fetch('/apply-edit', { method: 'POST', body: JSON.stringify(data) }),

  // Chat
  chat: (data) => _fetch('/chat', { method: 'POST', body: JSON.stringify(data) }),
  getChatHistory: (songId) => _fetch(`/songs/${songId}/messages`),
  saveChatMessages: (songId, messages) => _fetch(`/songs/${songId}/messages`, { method: 'POST', body: JSON.stringify(messages) }),

  // Patterns
  getPatterns: (profileId) => {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return _fetch(`/patterns${query}`);
  },

  // Profile Models (saved provider+model combos)
  listProfileModels: (profileId) => _fetch(`/profiles/${profileId}/models`),
  addProfileModel: (profileId, data) => _fetch(`/profiles/${profileId}/models`, { method: 'POST', body: JSON.stringify(data) }),
  deleteProfileModel: (profileId, modelId) => _fetch(`/profiles/${profileId}/models/${modelId}`, { method: 'DELETE' }),

  // Provider Connections
  listProviderConnections: (profileId) => _fetch(`/profiles/${profileId}/connections`),
  addProviderConnection: (profileId, data) => _fetch(`/profiles/${profileId}/connections`, { method: 'POST', body: JSON.stringify(data) }),
  deleteProviderConnection: (profileId, connectionId) => _fetch(`/profiles/${profileId}/connections/${connectionId}`, { method: 'DELETE' }),

  // PDF
  downloadSongPdf: async (id, title, artist) => {
    const res = await fetch(`${BASE}/songs/${id}/pdf`, { headers: _getAuthHeaders() });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('porchsongs-logout'));
      throw new Error('Authentication required. Please log in.');
    }
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'Untitled'} - ${artist || 'Unknown'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Providers
  listProviders: () => _fetch('/providers'),
  listProviderModels: (provider, apiBase) => {
    const query = apiBase ? `?api_base=${encodeURIComponent(apiBase)}` : '';
    return _fetch(`/providers/${provider}/models${query}`);
  },
};

export default api;
