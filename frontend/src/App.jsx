import { useState, useEffect, useCallback } from 'react';
import api from './api';
import useLocalStorage from './hooks/useLocalStorage';
import useSavedModels from './hooks/useSavedModels';
import Header from './components/Header';
import Tabs from './components/Tabs';
import RewriteTab from './components/RewriteTab';
import LibraryTab from './components/LibraryTab';
import ProfileTab from './components/ProfileTab';
import SettingsModal from './components/SettingsModal';
import LoginPage from './components/LoginPage';

const TAB_KEYS = ['rewrite', 'library', 'profile'];

function tabFromPath(pathname) {
  const seg = pathname.replace(/^\//, '').split('/')[0].toLowerCase();
  return TAB_KEYS.includes(seg) ? seg : 'rewrite';
}

function songIdFromPath(pathname) {
  const parts = pathname.replace(/^\//, '').split('/');
  if (parts[0]?.toLowerCase() === 'library' && parts[1]) {
    const id = parseInt(parts[1], 10);
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => tabFromPath(window.location.pathname));
  const [initialSongId, setInitialSongId] = useState(() => songIdFromPath(window.location.pathname));
  const [showSettings, setShowSettings] = useState(false);

  // Auth state: "loading" | "login" | "ready"
  const [authState, setAuthState] = useState('loading');
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
      setInitialSongId(songIdFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Wrapper that updates both state and URL
  const setTab = useCallback((key) => {
    setActiveTab(key);
    const target = key === 'rewrite' ? '/' : `/${key}`;
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  // Profile state
  const [profile, setProfile] = useState(null);

  // LLM settings (persisted in localStorage)
  const [provider, setProvider] = useLocalStorage('porchsongs_provider', '');
  const [model, setModel] = useLocalStorage('porchsongs_model', '');

  // Saved models for current profile
  const { savedModels, addModel, removeModel } = useSavedModels(profile?.id);

  // Rewrite state (shared between RewriteTab, comparison, workshop, chat)
  const [rewriteResult, setRewriteResult] = useState(null);
  const [rewriteMeta, setRewriteMeta] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  // Persist currentSongId to localStorage so it survives page refresh
  const [currentSongId, setCurrentSongIdRaw] = useState(() => {
    const stored = localStorage.getItem('porchsongs_current_song_id');
    if (stored) {
      const id = parseInt(stored, 10);
      return Number.isFinite(id) ? id : null;
    }
    return null;
  });
  const setCurrentSongId = useCallback((id) => {
    setCurrentSongIdRaw(id);
    if (id != null) {
      localStorage.setItem('porchsongs_current_song_id', String(id));
    } else {
      localStorage.removeItem('porchsongs_current_song_id');
    }
  }, []);

  const llmSettings = { provider, model };

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
    api.getSong(currentSongId).then(async (song) => {
      setRewriteResult({
        original_lyrics: song.original_lyrics,
        rewritten_lyrics: song.rewritten_lyrics,
        changes_summary: song.changes_summary || '',
      });
      setRewriteMeta({
        title: song.title,
        artist: song.artist,
        source_url: song.source_url,
        profile_id: song.profile_id,
        llm_provider: song.llm_provider,
        llm_model: song.llm_model,
      });
      try {
        const history = await api.getChatHistory(song.id);
        setChatMessages(history.map(row => ({
          role: row.role,
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

  const handleSaveProfile = useCallback(async (data) => {
    let saved;
    if (profile?.id) {
      saved = await api.updateProfile(profile.id, data);
    } else {
      saved = await api.createProfile(data);
    }
    setProfile(saved);
    return saved;
  }, [profile]);

  const handleNewRewrite = useCallback((result, meta) => {
    setRewriteResult(result);
    setRewriteMeta(meta);
    setChatMessages([]);
    setCurrentSongId(null);
  }, []);

  const handleSongSaved = useCallback((songId) => {
    setCurrentSongId(songId);
  }, []);

  const handleLyricsUpdated = useCallback((newLyrics) => {
    setRewriteResult(prev => prev ? { ...prev, rewritten_lyrics: newLyrics } : prev);
  }, []);

  const handleLoadSong = useCallback(async (song) => {
    setRewriteResult({
      original_lyrics: song.original_lyrics,
      rewritten_lyrics: song.rewritten_lyrics,
      changes_summary: song.changes_summary || '',
    });
    setRewriteMeta({
      title: song.title,
      artist: song.artist,
      source_url: song.source_url,
      profile_id: song.profile_id,
      llm_provider: song.llm_provider,
      llm_model: song.llm_model,
    });
    setCurrentSongId(song.id);
    setTab('rewrite');

    // Restore chat history
    try {
      const history = await api.getChatHistory(song.id);
      setChatMessages(history.map(row => ({
        role: row.role,
        content: row.content,
        isNote: row.is_note,
      })));
    } catch {
      setChatMessages([]);
    }
  }, [setTab]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('porchsongs_app_secret');
    setAuthState('login');
  }, []);

  if (authState === 'loading') {
    return null;
  }

  if (authState === 'login') {
    return <LoginPage onLogin={() => setAuthState('ready')} />;
  }

  return (
    <>
      <Header
        profileName={profile?.name}
        onSettingsClick={() => setShowSettings(true)}
        onHomeClick={() => setTab('rewrite')}
        authActive={authActive}
        onLogout={handleLogout}
      />
      <Tabs active={activeTab} onChange={setTab} />
      <main>
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
            savedModels={savedModels}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
        {activeTab === 'library' && (
          <LibraryTab onLoadSong={handleLoadSong} initialSongId={initialSongId} onInitialSongConsumed={() => setInitialSongId(null)} />
        )}
        {activeTab === 'profile' && (
          <ProfileTab profile={profile} onSave={handleSaveProfile} />
        )}
      </main>
      {showSettings && (
        <SettingsModal
          provider={provider}
          model={model}
          savedModels={savedModels}
          onSave={(p, m) => { setProvider(p); setModel(m); }}
          onAddModel={addModel}
          onRemoveModel={removeModel}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
