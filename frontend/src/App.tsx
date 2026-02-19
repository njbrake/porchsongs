import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import api from '@/api';
import useLocalStorage from '@/hooks/useLocalStorage';
import useProviderConnections from '@/hooks/useProviderConnections';
import useSavedModels from '@/hooks/useSavedModels';
import Header from '@/components/Header';
import Tabs from '@/components/Tabs';
import RewriteTab from '@/components/RewriteTab';
import LibraryTab from '@/components/LibraryTab';
import SettingsPage from '@/components/SettingsPage';
import LoginPage from '@/components/LoginPage';
import type { Profile, RewriteResult, RewriteMeta, ChatMessage, Song } from '@/types';

const TAB_KEYS = ['rewrite', 'library', 'settings'];
const SETTINGS_SUB_TABS = ['profile', 'providers'];

function tabFromPath(pathname: string): string {
  const seg = pathname.replace(/^\//, '').split('/')[0]!.toLowerCase();
  return TAB_KEYS.includes(seg) ? seg : 'rewrite';
}

function settingsTabFromPath(pathname: string): string {
  const parts = pathname.replace(/^\//, '').split('/');
  if (parts[0]?.toLowerCase() === 'settings' && SETTINGS_SUB_TABS.includes(parts[1]?.toLowerCase() ?? '')) {
    return parts[1]!.toLowerCase();
  }
  return 'profile';
}

function songIdFromPath(pathname: string): number | null {
  const parts = pathname.replace(/^\//, '').split('/');
  if (parts[0]?.toLowerCase() === 'library' && parts[1]) {
    const id = parseInt(parts[1], 10);
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => tabFromPath(window.location.pathname));
  const [settingsTab, setSettingsTab] = useState(() => settingsTabFromPath(window.location.pathname));
  const [initialSongId, setInitialSongId] = useState(() => songIdFromPath(window.location.pathname));
  // Auth state: "loading" | "login" | "ready"
  const [authState, setAuthState] = useState<'loading' | 'login' | 'ready'>('loading');
  const [authActive, setAuthActive] = useState(false);

  // Check auth requirement on mount
  useEffect(() => {
    api.checkAuthRequired()
      .then(({ required }) => {
        setAuthActive(required);
        if (!required) {
          setAuthState('ready');
        } else {
          // Check if we already have a stored token
          const token = localStorage.getItem('porchsongs_app_secret');
          setAuthState(token ? 'ready' : 'login');
        }
      })
      .catch(() => {
        // If we can't reach the server, proceed without auth
        setAuthState('ready');
      });
  }, []);

  // Listen for logout events (e.g. 401 from expired/changed token)
  useEffect(() => {
    const handler = () => {
      if (authActive) {
        localStorage.removeItem('porchsongs_app_secret');
        setAuthState('login');
      }
    };
    window.addEventListener('porchsongs-logout', handler);
    return () => window.removeEventListener('porchsongs-logout', handler);
  }, [authActive]);

  // Sync tab from URL on back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      setActiveTab(tabFromPath(window.location.pathname));
      setSettingsTab(settingsTabFromPath(window.location.pathname));
      setInitialSongId(songIdFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Wrapper that updates both state and URL
  const setTab = useCallback((key: string, subTab?: string) => {
    if (key === 'settings') {
      const sub = subTab || settingsTab || 'profile';
      setActiveTab('settings');
      setSettingsTab(sub);
      const target = `/settings/${sub}`;
      if (window.location.pathname !== target) {
        window.history.pushState(null, '', target);
      }
    } else {
      setActiveTab(key);
      const target = key === 'rewrite' ? '/' : `/${key}`;
      if (window.location.pathname !== target) {
        window.history.pushState(null, '', target);
      }
    }
  }, [settingsTab]);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);

  // LLM settings (persisted in localStorage)
  const [provider, setProvider] = useLocalStorage('porchsongs_provider', '');
  const [model, setModel] = useLocalStorage('porchsongs_model', '');
  const [reasoningEffort, setReasoningEffort] = useLocalStorage('porchsongs_reasoning_effort', 'high');

  // Provider connections and saved models for current profile
  const { connections, addConnection, removeConnection } = useProviderConnections(profile?.id);
  const { savedModels, addModel, removeModel, refresh: refreshModels } = useSavedModels(profile?.id);

  // Rewrite state (shared between RewriteTab, comparison, workshop, chat)
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [rewriteMeta, setRewriteMeta] = useState<RewriteMeta | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Persist currentSongId to localStorage so it survives page refresh
  const [currentSongId, setCurrentSongIdRaw] = useState<number | null>(() => {
    const stored = localStorage.getItem('porchsongs_current_song_id');
    if (stored) {
      const id = parseInt(stored, 10);
      return Number.isFinite(id) ? id : null;
    }
    return null;
  });
  const setCurrentSongId = useCallback((id: number | null) => {
    setCurrentSongIdRaw(id);
    if (id != null) {
      localStorage.setItem('porchsongs_current_song_id', String(id));
    } else {
      localStorage.removeItem('porchsongs_current_song_id');
    }
  }, []);

  const llmSettings = { provider, model, reasoning_effort: reasoningEffort };

  // Load profile on mount (only when ready)
  useEffect(() => {
    if (authState !== 'ready') return;
    api.listProfiles().then(profiles => {
      const def = profiles.find(p => p.is_default) || profiles[0];
      if (def) setProfile(def);
    }).catch(() => {});
  }, [authState]);

  // Auto-restore active song on mount (page refresh recovery)
  useEffect(() => {
    if (authState !== 'ready' || rewriteResult || !currentSongId) return;
    api.getSong(currentSongId).then(async (song: Song) => {
      setRewriteResult({
        original_lyrics: song.original_lyrics,
        rewritten_lyrics: song.rewritten_lyrics,
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

  const handleSaveProfile = useCallback(async (data: { name: string; description: string | null; is_default: boolean }) => {
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
    setChatMessages([]);
    setCurrentSongId(null);
  }, [setCurrentSongId]);

  const handleSongSaved = useCallback((songId: number) => {
    setCurrentSongId(songId);
  }, [setCurrentSongId]);

  const handleLyricsUpdated = useCallback((newLyrics: string) => {
    setRewriteResult(prev => prev ? { ...prev, rewritten_lyrics: newLyrics } : prev);
  }, []);

  const handleLoadSong = useCallback(async (song: Song) => {
    setRewriteResult({
      original_lyrics: song.original_lyrics,
      rewritten_lyrics: song.rewritten_lyrics,
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
    setTab('rewrite');

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
  }, [setTab, setCurrentSongId]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('porchsongs_app_secret');
    setAuthState('login');
  }, []);

  if (authState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <div className="size-8 border-3 border-border border-t-primary rounded-full animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (authState === 'login') {
    return <LoginPage onLogin={() => setAuthState('ready')} />;
  }

  return (
    <>
      <Header
        onHomeClick={() => setTab('rewrite')}
        authActive={authActive}
        onLogout={handleLogout}
      />
      <Tabs active={activeTab} onChange={setTab} />
      <main className="max-w-[1800px] mx-auto px-2 sm:px-4 py-4">
        {activeTab === 'rewrite' && (
          <RewriteTab
            profile={profile}
            llmSettings={llmSettings}
            rewriteResult={rewriteResult}
            rewriteMeta={rewriteMeta}
            currentSongId={currentSongId}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            onNewRewrite={handleNewRewrite}
            onSongSaved={handleSongSaved}
            onLyricsUpdated={handleLyricsUpdated}
            onChangeProvider={setProvider}
            onChangeModel={setModel}
            reasoningEffort={reasoningEffort}
            onChangeReasoningEffort={setReasoningEffort}
            savedModels={savedModels}
            onOpenSettings={() => setTab('settings', 'profile')}
          />
        )}
        {activeTab === 'library' && (
          <LibraryTab onLoadSong={handleLoadSong} initialSongId={initialSongId} onInitialSongConsumed={() => setInitialSongId(null)} />
        )}
        {activeTab === 'settings' && (
          <SettingsPage
            provider={provider}
            model={model}
            savedModels={savedModels}
            onSave={(p, m) => { setProvider(p); setModel(m); }}
            onAddModel={addModel}
            onRemoveModel={removeModel}
            connections={connections}
            onAddConnection={addConnection}
            onRemoveConnection={async (connId) => {
              const conn = connections.find(c => c.id === connId);
              await removeConnection(connId);
              // Clean up active selection if it was from the removed provider
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
            }}
            profile={profile}
            onSaveProfile={handleSaveProfile}
            activeTab={settingsTab}
            onChangeTab={(sub) => setTab('settings', sub)}
            reasoningEffort={reasoningEffort}
            onChangeReasoningEffort={setReasoningEffort}
          />
        )}
      </main>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
