// Domain models

export interface Profile {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Song {
  id: number;
  user_id: number;
  profile_id: number;
  title: string | null;
  artist: string | null;
  source_url: string | null;
  original_lyrics: string;
  rewritten_lyrics: string;
  changes_summary: string | null;
  status: 'draft' | 'completed';
  folder: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  current_version: number;
  created_at: string;
}

export interface SongRevision {
  id: number;
  song_id: number;
  version: number;
  rewritten_lyrics: string;
  changes_summary: string | null;
  edit_type: 'rewrite' | 'line' | 'chat';
  created_at: string;
}

export interface RewriteResult {
  original_lyrics: string;
  rewritten_lyrics: string;
  changes_summary: string;
  title?: string;
  artist?: string;
}

export interface RewriteMeta {
  title?: string;
  artist?: string;
  source_url?: string;
  profile_id?: number;
  llm_provider?: string;
  llm_model?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isNote?: boolean;
  rawContent?: string;
}

export interface LlmSettings {
  provider: string;
  model: string;
  reasoning_effort: string;
}

export interface SavedModel {
  id: number;
  profile_id: number;
  provider: string;
  model: string;
}

export interface ProviderConnection {
  id: number;
  profile_id: number;
  provider: string;
  api_base: string | null;
}

export interface Provider {
  name: string;
  local: boolean;
}

// Auth types

export interface AuthConfig {
  method: 'password' | 'oauth_google';
  required: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

// API request types

export interface RewriteRequest {
  profile_id: number;
  lyrics: string;
  instruction?: string | null;
  provider: string;
  model: string;
  reasoning_effort?: string | null;
  source_url?: string | null;
  title?: string | null;
  artist?: string | null;
}

export interface ChatRequest {
  song_id: number;
  messages: { role: string; content: string }[];
  provider: string;
  model: string;
  reasoning_effort?: string | null;
}

// API response types

export interface ChatResult {
  rewritten_lyrics: string;
  changes_summary: string;
  assistant_message: string;
}

export interface ChatHistoryRow {
  role: string;
  content: string;
  is_note: boolean;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onThinking?: () => void;
}
