import type {
  Profile,
  Song,
  SongRevision,
  RewriteResult,
  SavedModel,
  ProviderConnection,
  Provider,
  ChatResult,
  AuthConfig,
  AuthUser,
  TokenResponse,
  ChatHistoryRow,
  StreamCallbacks,
} from '@/types';

const BASE = '/api';

// --- Token storage ---
// Access token in memory (not localStorage) for security
let _accessToken: string | null = null;

// Refresh token in localStorage for persistence across tabs/refreshes
function _getRefreshToken(): string | null {
  return localStorage.getItem('porchsongs_refresh_token');
}
function _setRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem('porchsongs_refresh_token', token);
  } else {
    localStorage.removeItem('porchsongs_refresh_token');
  }
}

function _getAuthHeaders(): Record<string, string> {
  if (_accessToken) {
    return { Authorization: `Bearer ${_accessToken}` };
  }
  return {};
}

// --- Refresh token deduplication ---
let _refreshPromise: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  const refreshToken = _getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      _accessToken = null;
      _setRefreshToken(null);
      return false;
    }
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    _accessToken = data.access_token;
    _setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function _tryRefresh(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

// --- Core fetch with auto-refresh ---

async function _fetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const url = BASE + path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ..._getAuthHeaders(), ...options.headers },
    ...options,
  });

  if (res.status === 401 && retry) {
    const refreshed = await _tryRefresh();
    if (refreshed) {
      return _fetch<T>(path, options, false);
    }
    window.dispatchEvent(new CustomEvent('porchsongs-logout'));
    throw new Error('Authentication required. Please log in.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Auth API ---

async function getAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(`${BASE}/auth/config`);
  return res.json() as Promise<AuthConfig>;
}

async function login(password: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || 'Login failed');
  }
  const data = (await res.json()) as TokenResponse;
  _accessToken = data.access_token;
  _setRefreshToken(data.refresh_token);
  return data;
}

async function logout(): Promise<void> {
  const refreshToken = _getRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._getAuthHeaders() },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best effort
    }
  }
  _accessToken = null;
  _setRefreshToken(null);
}

async function tryRestoreSession(): Promise<AuthUser | null> {
  const refreshToken = _getRefreshToken();
  if (!refreshToken) return null;

  const refreshed = await _tryRefresh();
  if (!refreshed) return null;

  try {
    return await _fetch<AuthUser>('/auth/me');
  } catch {
    return null;
  }
}

async function getCurrentUser(): Promise<AuthUser> {
  return _fetch<AuthUser>('/auth/me');
}

// --- Streaming rewrite with auth ---

async function rewriteStream(data: Record<string, unknown>, { onToken, onThinking, onPhase }: StreamCallbacks = {}): Promise<RewriteResult> {
  const doFetch = async (isRetry: boolean): Promise<Response> => {
    const url = `${BASE}/rewrite?stream=true`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._getAuthHeaders() },
      body: JSON.stringify(data),
    });

    if (res.status === 401 && !isRetry) {
      const refreshed = await _tryRefresh();
      if (refreshed) {
        return doFetch(true);
      }
      window.dispatchEvent(new CustomEvent('porchsongs-logout'));
      throw new Error('Authentication required. Please log in.');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail || `Request failed: ${res.status}`);
    }
    return res;
  };

  const res = await doFetch(false);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: RewriteResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = JSON.parse(line.slice(6)) as { done?: boolean; result?: RewriteResult; token?: string; thinking?: boolean; reasoning_token?: string; phase?: string };
      if (payload.done) {
        finalResult = payload.result!;
      } else if (payload.phase && onPhase) {
        onPhase(payload.phase);
      } else if (payload.thinking && onThinking) {
        onThinking();
      } else if (payload.reasoning_token != null && onThinking) {
        onThinking(payload.reasoning_token);
      } else if (payload.token && onToken) {
        onToken(payload.token);
      }
    }
  }

  if (buffer.startsWith('data: ')) {
    const payload = JSON.parse(buffer.slice(6)) as { done?: boolean; result?: RewriteResult; token?: string; thinking?: boolean; reasoning_token?: string; phase?: string };
    if (payload.done) {
      finalResult = payload.result!;
    } else if (payload.phase && onPhase) {
      onPhase(payload.phase);
    } else if (payload.thinking && onThinking) {
      onThinking();
    } else if (payload.reasoning_token != null && onThinking) {
      onThinking(payload.reasoning_token);
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
  getAuthConfig,
  login,
  logout,
  tryRestoreSession,
  getCurrentUser,
  // Profiles
  listProfiles: () => _fetch<Profile[]>('/profiles'),
  createProfile: (data: Partial<Profile>) => _fetch<Profile>('/profiles', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: (id: number) => _fetch<Profile>(`/profiles/${id}`),
  updateProfile: (id: number, data: Partial<Profile>) => _fetch<Profile>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProfile: (id: number) => _fetch<void>(`/profiles/${id}`, { method: 'DELETE' }),

  // Rewrite
  rewrite: (data: Record<string, unknown>) => _fetch<RewriteResult>('/rewrite', { method: 'POST', body: JSON.stringify(data) }),
  rewriteStream,

  // Songs
  listSongs: (profileId?: number) => {
    const query = profileId ? `?profile_id=${profileId}` : '';
    return _fetch<Song[]>(`/songs${query}`);
  },
  listFolders: () => _fetch<string[]>('/songs/folders'),
  getSong: (id: number) => _fetch<Song>(`/songs/${id}`),
  saveSong: (data: Partial<Song>) => _fetch<Song>('/songs', { method: 'POST', body: JSON.stringify(data) }),
  updateSong: (id: number, data: Partial<Song>) => _fetch<Song>(`/songs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSong: (id: number) => _fetch<void>(`/songs/${id}`, { method: 'DELETE' }),
  updateSongStatus: (id: number, data: { status: string }) => _fetch<Song>(`/songs/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  getSongRevisions: (id: number) => _fetch<SongRevision[]>(`/songs/${id}/revisions`),

  // Chat
  chat: (data: Record<string, unknown>, signal?: AbortSignal) => _fetch<ChatResult>('/chat', { method: 'POST', body: JSON.stringify(data), signal }),
  getChatHistory: (songId: number) => _fetch<ChatHistoryRow[]>(`/songs/${songId}/messages`),
  saveChatMessages: (songId: number, messages: { role: string; content: string; is_note: boolean }[]) =>
    _fetch<void>(`/songs/${songId}/messages`, { method: 'POST', body: JSON.stringify(messages) }),

  // Profile Models (saved provider+model combos)
  listProfileModels: (profileId: number) => _fetch<SavedModel[]>(`/profiles/${profileId}/models`),
  addProfileModel: (profileId: number, data: { provider: string; model: string }) =>
    _fetch<SavedModel>(`/profiles/${profileId}/models`, { method: 'POST', body: JSON.stringify(data) }),
  deleteProfileModel: (profileId: number, modelId: number) =>
    _fetch<void>(`/profiles/${profileId}/models/${modelId}`, { method: 'DELETE' }),

  // Provider Connections
  listProviderConnections: (profileId: number) => _fetch<ProviderConnection[]>(`/profiles/${profileId}/connections`),
  addProviderConnection: (profileId: number, data: { provider: string; api_base?: string }) =>
    _fetch<ProviderConnection>(`/profiles/${profileId}/connections`, { method: 'POST', body: JSON.stringify(data) }),
  deleteProviderConnection: (profileId: number, connectionId: number) =>
    _fetch<void>(`/profiles/${profileId}/connections/${connectionId}`, { method: 'DELETE' }),

  // PDF
  downloadSongPdf: async (id: number, title: string | null, artist: string | null) => {
    const res = await fetch(`${BASE}/songs/${id}/pdf`, { headers: _getAuthHeaders() });
    if (res.status === 401) {
      const refreshed = await _tryRefresh();
      if (refreshed) {
        const retryRes = await fetch(`${BASE}/songs/${id}/pdf`, { headers: _getAuthHeaders() });
        if (!retryRes.ok) throw new Error(`Download failed: ${retryRes.status}`);
        const blob = await retryRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'Untitled'} - ${artist || 'Unknown'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
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
  listProviders: () => _fetch<Provider[]>('/providers'),
  listProviderModels: (provider: string, apiBase?: string) => {
    const query = apiBase ? `?api_base=${encodeURIComponent(apiBase)}` : '';
    return _fetch<string[]>(`/providers/${provider}/models${query}`);
  },
};

export default api;
