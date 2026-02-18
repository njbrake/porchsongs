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

const TAB_KEYS = ['rewrite', 'library', 'profile'];

function tabFromPath(pathname) {
  const seg = pathname.replace(/^\//, '').split('/')[0].toLowerCase();
  return TAB_KEYS.includes(seg) ? seg : 'rewrite';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(() => tabFromPath(window.location.pathname));
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authSecret, setAuthSecret] = useState('');

  // Sync tab from URL on back/forward navigation
  useEffect(() => {
    const onPopState = () => setActiveTab(tabFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Listen for auth-required events from api.js
  useEffect(() => {
    const handler = () => setShowAuthPrompt(true);
    window.addEventListener('porchsongs-auth-required', handler);
    return () => window.removeEventListener('porchsongs-auth-required', handler);
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
  const [currentSongId, setCurrentSongId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  const llmSettings = { provider, model };

  // Load profile on mount
  useEffect(() => {
    api.listProfiles().then(profiles => {
      const def = profiles.find(p => p.is_default) || profiles[0];
      if (def) setProfile(def);
    }).catch(() => {});
  }, []);

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

  const handleAuthSubmit = useCallback(() => {
    if (authSecret.trim()) {
      localStorage.setItem('porchsongs_app_secret', authSecret.trim());
      setShowAuthPrompt(false);
      setAuthSecret('');
    }
  }, [authSecret]);

  return (
    <>
      <Header
        profileName={profile?.name}
        onSettingsClick={() => setShowSettings(true)}
        onHomeClick={() => setTab('rewrite')}
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
          <LibraryTab onLoadSong={handleLoadSong} />
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
      {showAuthPrompt && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setShowAuthPrompt(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h2>App Secret Required</h2>
              <button className="modal-close" onClick={() => setShowAuthPrompt(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>This server requires an app secret to access the API.</p>
              <div className="form-group">
                <label>App Secret</label>
                <input
                  type="password"
                  value={authSecret}
                  onChange={e => setAuthSecret(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
                  placeholder="Enter the app secret"
                  autoFocus
                />
              </div>
              <button className="btn primary" onClick={handleAuthSubmit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
