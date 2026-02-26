import { useState, useEffect, useCallback } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import api, { STORAGE_KEYS } from '@/api';
import useLocalStorage from '@/hooks/useLocalStorage';
import useProviderConnections from '@/hooks/useProviderConnections';
import useSavedModels from '@/hooks/useSavedModels';
import Header from '@/components/Header';
import Tabs from '@/components/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, RewriteResult, RewriteMeta, ChatMessage, Song } from '@/types';

/** Context value provided to child routes via useOutletContext(). */
export interface AppShellContext {
  profile: Profile | null;
  llmSettings: { provider: string; model: string; reasoning_effort: string };
  rewriteResult: RewriteResult | null;
  rewriteMeta: RewriteMeta | null;
  currentSongId: number | null;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onNewRewrite: (result: RewriteResult | null, meta: RewriteMeta | null) => void;
  onSongSaved: (songId: number) => void;
  onContentUpdated: (content: string) => void;
  onChangeProvider: (provider: string) => void;
  onChangeModel: (model: string) => void;
  reasoningEffort: string;
  onChangeReasoningEffort: (value: string) => void;
  savedModels: ReturnType<typeof useSavedModels>['savedModels'];
  onOpenSettings: () => void;
  isPremium: boolean;
  // Settings-specific props
  provider: string;
  model: string;
  onSave: (provider: string, model: string) => void;
  onAddModel: ReturnType<typeof useSavedModels>['addModel'];
  onRemoveModel: ReturnType<typeof useSavedModels>['removeModel'];
  connections: ReturnType<typeof useProviderConnections>['connections'];
  onAddConnection: ReturnType<typeof useProviderConnections>['addConnection'];
  onRemoveConnection: (connId: number) => void;
  onSaveProfile: (data: Partial<Profile>) => Promise<Profile>;
  // Library-specific props
  onLoadSong: (song: Song) => Promise<void>;
}

export default function AppShell() {
  const { authState, currentAuthUser, authConfig, isPremium, handleLogout } = useAuth();
  const navigate = useNavigate();

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);

  // LLM settings (persisted in localStorage)
  const [provider, setProvider] = useLocalStorage(STORAGE_KEYS.PROVIDER, '');
  const [model, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, '');
  const [reasoningEffort, setReasoningEffort] = useLocalStorage(STORAGE_KEYS.REASONING_EFFORT, 'high');

  // Provider connections and saved models
  const { connections, addConnection, removeConnection } = useProviderConnections(profile?.id, isPremium);
  const { savedModels, addModel, removeModel, refresh: refreshModels } = useSavedModels(profile?.id, isPremium);

  // Rewrite state (shared between RewriteTab, comparison, chat)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [rewriteMeta, setRewriteMeta] = useState<RewriteMeta | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Persist currentSongId to localStorage so it survives page refresh
  const [currentSongId, setCurrentSongIdRaw] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_SONG_ID);
    if (stored) {
      const id = parseInt(stored, 10);
      return Number.isFinite(id) ? id : null;
    }
    return null;
  });
  const setCurrentSongId = useCallback((id: number | null) => {
    setCurrentSongIdRaw(id);
    if (id != null) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SONG_ID, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SONG_ID);
    }
  }, []);

  const llmSettings = { provider, model, reasoning_effort: reasoningEffort };

  // Load profile on mount; auto-create if none exist
  useEffect(() => {
    if (authState !== 'ready') return;
    api.listProfiles().then(async profiles => {
      const def = profiles.find(p => p.is_default) || profiles[0];
      if (def) {
        setProfile(def);
      } else {
        const created = await api.createProfile({ is_default: true });
        setProfile(created);
      }
    }).catch(() => {});
  }, [authState]);

  // Auto-restore active song on mount (page refresh recovery)
  useEffect(() => {
    if (authState !== 'ready' || rewriteResult || !currentSongId) return;
    api.getSong(currentSongId).then(async (song: Song) => {
      setRewriteResult({
        original_content: song.original_content,
        rewritten_content: song.rewritten_content,
        changes_summary: song.changes_summary || '',
      });
      setRewriteMeta({
        title: song.title ?? undefined,
        artist: song.artist ?? undefined,
        source_url: song.source_url ?? undefined,
        profile_id: song.profile_id,
        llm_provider: song.llm_provider ?? undefined,
        llm_model: song.llm_model ?? undefined,
      });
      try {
        const history = await api.getChatHistory(song.id);
        setChatMessages(history.map(row => ({
          role: row.role as 'user' | 'assistant',
          content: row.content,
          isNote: row.is_note,
        })));
      } catch {
        setChatMessages([]);
      }
    }).catch(() => {
      setCurrentSongId(null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  const handleSaveProfile = useCallback(async (data: Partial<Profile>) => {
    let saved: Profile;
    if (profile?.id) {
      saved = await api.updateProfile(profile.id, data);
    } else {
      saved = await api.createProfile(data);
    }
    setProfile(saved);
    return saved;
  }, [profile]);

  const handleNewRewrite = useCallback((result: RewriteResult | null, meta: RewriteMeta | null) => {
    setRewriteResult(result);
    setRewriteMeta(meta);
    if (!result) {
      setChatMessages([]);
      setCurrentSongId(null);
    }
  }, [setCurrentSongId]);

  const handleSongSaved = useCallback((songId: number) => {
    setCurrentSongId(songId);
  }, [setCurrentSongId]);

  const handleContentUpdated = useCallback((newContent: string) => {
    setRewriteResult(prev => prev ? { ...prev, rewritten_content: newContent } : prev);
  }, []);

  const handleLoadSong = useCallback(async (song: Song) => {
    setRewriteResult({
      original_content: song.original_content,
      rewritten_content: song.rewritten_content,
      changes_summary: song.changes_summary || '',
    });
    setRewriteMeta({
      title: song.title ?? undefined,
      artist: song.artist ?? undefined,
      source_url: song.source_url ?? undefined,
      profile_id: song.profile_id,
      llm_provider: song.llm_provider ?? undefined,
      llm_model: song.llm_model ?? undefined,
    });
    setCurrentSongId(song.id);
    navigate('/app/rewrite');

    // Restore chat history
    try {
      const history = await api.getChatHistory(song.id);
      setChatMessages(history.map(row => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
        isNote: row.is_note,
      })));
    } catch {
      setChatMessages([]);
    }
  }, [navigate, setCurrentSongId]);

  const handleRemoveConnection = useCallback(async (connId: number) => {
    const conn = connections.find(c => c.id === connId);
    await removeConnection(connId);
    if (conn && conn.provider === provider) {
      const remaining = savedModels.filter(m => m.provider !== conn.provider);
      if (remaining.length > 0) {
        setProvider(remaining[0]!.provider);
        setModel(remaining[0]!.model);
      } else {
        setProvider('');
        setModel('');
      }
    }
    refreshModels();
  }, [connections, removeConnection, provider, savedModels, setProvider, setModel, refreshModels]);

  // Redirect to login if not authenticated
  if (authState === 'login') {
    return <Navigate to="/app/login" replace />;
  }

  const ctx: AppShellContext = {
    profile,
    llmSettings,
    rewriteResult,
    rewriteMeta,
    currentSongId,
    chatMessages,
    setChatMessages,
    onNewRewrite: handleNewRewrite,
    onSongSaved: handleSongSaved,
    onContentUpdated: handleContentUpdated,
    onChangeProvider: setProvider,
    onChangeModel: setModel,
    reasoningEffort,
    onChangeReasoningEffort: setReasoningEffort,
    savedModels,
    onOpenSettings: () => navigate('/app/settings/models'),
    isPremium,
    provider,
    model,
    onSave: (p, m) => { setProvider(p); setModel(m); },
    onAddModel: addModel,
    onRemoveModel: removeModel,
    connections,
    onAddConnection: addConnection,
    onRemoveConnection: handleRemoveConnection,
    onSaveProfile: handleSaveProfile,
    onLoadSong: handleLoadSong,
  };

  return (
    <div className="flex flex-col h-dvh">
      <Header
        user={currentAuthUser}
        authRequired={authConfig?.required ?? false}
        onLogout={handleLogout}
        isPremium={isPremium}
      />
      <Tabs />
      <main className="flex-1 min-h-0 flex flex-col overflow-auto max-w-[1800px] w-full mx-auto px-2 sm:px-4 py-4">
        <Outlet context={ctx} />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
