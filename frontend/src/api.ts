import type {
  Profile,
  Song,
  SongRevision,
  SavedModel,
  ProviderConnection,
  Provider,
  ChatResult,
  AuthConfig,
  AuthUser,
  TokenResponse,
  ChatHistoryRow,
  ParseResult,
} from '@/types';

const BASE = '/api';

// --- Storage keys ---
const STORAGE_KEYS = {
  REFRESH_TOKEN: 'porchsongs_refresh_token',
  CURRENT_SONG_ID: 'porchsongs_current_song_id',
  DRAFT_INPUT: 'porchsongs_draft_input',
  SPLIT_PERCENT: 'porchsongs_split_pct',
  WAKE_LOCK: 'porchsongs_wake_lock',
  PROVIDER: 'porchsongs_provider',
  MODEL: 'porchsongs_model',
  REASONING_EFFORT: 'porchsongs_reasoning_effort',
} as const;

export { STORAGE_KEYS };

// --- Token storage ---
// Access token in memory (not localStorage) for security
let _accessToken: string | null = null;

// Refresh token in localStorage for persistence across tabs/refreshes
function _getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}
function _setRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
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

// --- Shared helpers ---

function _parseApiError(body: unknown, fallback: string): string {
  return (body as { detail?: string }).detail || fallback;
}

async function _throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(_parseApiError(body, `Request failed: ${res.status}`));
  }
}

function _downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function _streamSse<T>(
  endpoint: string,
  data: Record<string, unknown>,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<T> {
  const doStream = async (retry: boolean): Promise<T> => {
    const res = await fetch(`${BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._getAuthHeaders() },
      body: JSON.stringify(data),
      signal,
    });

    if (res.status === 401 && retry) {
      const refreshed = await _tryRefresh();
      if (refreshed) return doStream(false);
      window.dispatchEvent(new CustomEvent('porchsongs-logout'));
      throw new Error('Authentication required. Please log in.');
    }
    await _throwIfNotOk(res);

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = '';
    let result: T | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7);
        } else if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (eventType === 'token') {
            onToken(JSON.parse(payload) as string);
          } else if (eventType === 'done') {
            result = JSON.parse(payload) as T;
          } else if (eventType === 'error') {
            const err = JSON.parse(payload) as { detail: string };
            throw new Error(err.detail);
          }
          eventType = '';
        }
      }
    }

    if (!result) throw new Error('Stream ended without result');
    return result;
  };
  return doStream(true);
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

  await _throwIfNotOk(res);
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
    throw new Error(_parseApiError(body, 'Login failed'));
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

  // Parse
  parse: (data: Record<string, unknown>, signal?: AbortSignal) => _fetch<ParseResult>('/parse', { method: 'POST', body: JSON.stringify(data), signal }),
  parseStream: (
    data: Record<string, unknown>,
    onToken: (token: string) => void,
    signal?: AbortSignal,
  ): Promise<ParseResult> => _streamSse<ParseResult>('/parse/stream', data, onToken, signal),

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
  chatStream: (
    data: Record<string, unknown>,
    onToken: (token: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResult & { version: number }> => _streamSse<ChatResult & { version: number }>('/chat/stream', data, onToken, signal),
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
    const filename = `${title || 'Untitled'} - ${artist || 'Unknown'}.pdf`;
    let res = await fetch(`${BASE}/songs/${id}/pdf`, { headers: _getAuthHeaders() });
    if (res.status === 401) {
      const refreshed = await _tryRefresh();
      if (refreshed) {
        res = await fetch(`${BASE}/songs/${id}/pdf`, { headers: _getAuthHeaders() });
      } else {
        window.dispatchEvent(new CustomEvent('porchsongs-logout'));
        throw new Error('Authentication required. Please log in.');
      }
    }
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    _downloadBlob(await res.blob(), filename);
  },

  // Providers
  listProviders: () => _fetch<Provider[]>('/providers'),
  listProviderModels: (provider: string, apiBase?: string) => {
    const query = apiBase ? `?api_base=${encodeURIComponent(apiBase)}` : '';
    return _fetch<string[]>(`/providers/${provider}/models${query}`);
  },
};

export default api;
