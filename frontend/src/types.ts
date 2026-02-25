// Domain models

export interface Profile {
  id: number;
  user_id: number;
  is_default: boolean;
  system_prompt_parse?: string | null;
  system_prompt_chat?: string | null;
  platform_key_disabled?: boolean;
  created_at: string;
}

export interface Song {
  id: number;
  user_id: number;
  profile_id: number;
  title: string | null;
  artist: string | null;
  source_url: string | null;
  original_content: string;
  rewritten_content: string;
  changes_summary: string | null;
  status: string;
  font_size: number | null;
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
  rewritten_content: string;
  changes_summary: string | null;
  edit_type: 'rewrite' | 'chat';
  created_at: string;
}

export interface RewriteResult {
  original_content: string;
  rewritten_content: string;
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
  reasoning?: string;
  model?: string;
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

export interface ProvidersResponse {
  providers: Provider[];
  platform_enabled: boolean;
}

// Auth types

export interface AuthConfig {
  method: 'password' | 'oauth_google';
  required: boolean;
  /** Present when method is 'oauth_google' (premium mode) */
  google_client_id?: string;
  /** Whether new users need an invite code to register */
  require_invite_code?: boolean;
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

// API response types

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ChatResult {
  rewritten_content: string | null;
  original_content?: string | null;
  changes_summary: string;
  assistant_message: string;
  reasoning?: string | null;
  usage?: TokenUsage | null;
}

export interface ChatHistoryRow {
  role: string;
  content: string;
  is_note: boolean;
}

export interface ParseResult {
  original_content: string;
  title?: string;
  artist?: string;
  reasoning?: string | null;
}

// Premium types

export interface SubscriptionInfo {
  plan: string;
  is_active: boolean;
  stripe_customer_id?: string | null;
  created_at: string;
  expires_at?: string | null;
  rewrites_per_month: number;
  rewrites_used: number;
  max_profiles: number;
  max_songs: number;
}

export interface PlanInfo {
  name: string;
  display_name: string;
  price_cents: number;
  rewrites_per_month: number;
  max_profiles: number;
  max_songs: number;
  can_create_invites: boolean;
  max_input_chars: number;
  max_output_tokens: number;
}
