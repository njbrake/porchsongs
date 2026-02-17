import { useState, useEffect, useCallback } from 'react';
import api from './api';
import useLocalStorage from './hooks/useLocalStorage';
import Header from './components/Header';
import Tabs from './components/Tabs';
import RewriteTab from './components/RewriteTab';
import LibraryTab from './components/LibraryTab';
import ProfileTab from './components/ProfileTab';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('rewrite');
  const [showSettings, setShowSettings] = useState(false);

  // Profile state
  const [profile, setProfile] = useState(null);

  // LLM settings (persisted in localStorage)
  const [provider, setProvider] = useLocalStorage('porchsongs_provider', '');
  const [model, setModel] = useLocalStorage('porchsongs_model', '');
  const [apiKey, setApiKey] = useLocalStorage('porchsongs_api_key', '');

  // Rewrite state (shared between RewriteTab, comparison, workshop, chat)
  const [rewriteResult, setRewriteResult] = useState(null);
  const [rewriteMeta, setRewriteMeta] = useState(null);
  const [currentSongId, setCurrentSongId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  const llmSettings = { provider, model, api_key: apiKey };

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

  const handleLoadSong = useCallback((song) => {
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
    setChatMessages([]);
    setActiveTab('rewrite');
  }, []);

  return (
    <>
      <Header
        profileName={profile?.name}
        onSettingsClick={() => setShowSettings(true)}
      />
      <Tabs active={activeTab} onChange={setActiveTab} />
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
          apiKey={apiKey}
          onSave={(p, m, k) => { setProvider(p); setModel(m); setApiKey(k); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
