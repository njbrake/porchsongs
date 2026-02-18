import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import ComparisonView from './ComparisonView';
import ChatPanel from './ChatPanel';
import ModelSelector from './ModelSelector';

export default function RewriteTab({
  profile,
  llmSettings,
  rewriteResult,
  rewriteMeta,
  currentSongId,
  chatMessages,
  setChatMessages,
  onNewRewrite,
  onSongSaved,
  onLyricsUpdated,
  onChangeProvider,
  onChangeModel,
  savedModels,
  onOpenSettings,
}) {
  const [lyrics, setLyrics] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completedStatus, setCompletedStatus] = useState(null);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');

  // Sync title/artist from rewriteMeta (song-load case)
  useEffect(() => {
    if (rewriteMeta) {
      setSongTitle(rewriteMeta.title || '');
      setSongArtist(rewriteMeta.artist || '');
    }
  }, [rewriteMeta]);

  // Reset completed status when switching songs (e.g. reopening from Library)
  useEffect(() => {
    setCompletedStatus(null);
  }, [currentSongId]);

  const needsProfile = !profile?.id;
  const canRewrite = !needsProfile && llmSettings.provider && llmSettings.model && !loading && lyrics.trim().length > 0;

  const handleRewrite = async () => {
    const trimmedLyrics = lyrics.trim();
    if (!trimmedLyrics) return;

    setLoading(true);
    setError(null);
    onNewRewrite(null, null);

    // Seed chat immediately so it shows during loading
    const preview = trimmedLyrics.length > 300
      ? trimmedLyrics.slice(0, 300) + '\n...'
      : trimmedLyrics;
    const seedMessages = [{ role: 'user', content: preview, isNote: true }];
    if (instruction.trim()) {
      seedMessages.push({ role: 'user', content: instruction.trim(), isNote: true });
    }
    setChatMessages(seedMessages);

    try {
      const result = await api.rewrite({
        profile_id: profile.id,
        lyrics: trimmedLyrics,
        instruction: instruction.trim() || null,
        ...llmSettings,
      });
      setSongTitle(result.title || '');
      setSongArtist(result.artist || '');
      onNewRewrite(result, { profile_id: profile.id, title: result.title, artist: result.artist });

      // Auto-save as draft
      const song = await api.saveSong({
        profile_id: profile.id,
        title: result.title || null,
        artist: result.artist || null,
        original_lyrics: result.original_lyrics,
        rewritten_lyrics: result.rewritten_lyrics,
        changes_summary: result.changes_summary,
        llm_provider: llmSettings.provider,
        llm_model: llmSettings.model,
      });
      onSongSaved(song.id);
      setCompletedStatus(null);

      // Add the LLM's changes summary as the first assistant response
      const allSeedMessages = [
        ...seedMessages,
        { role: 'assistant', content: result.changes_summary, isNote: true },
      ];
      setChatMessages(allSeedMessages);

      // Persist seed messages to DB
      api.saveChatMessages(song.id, allSeedMessages.map(m => ({
        role: m.role,
        content: m.content,
        is_note: m.isNote ?? false,
      }))).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSong = () => {
    onNewRewrite(null, null);
    setLyrics('');
    setInstruction('');
    setCompletedStatus(null);
    setError(null);
    setSongTitle('');
    setSongArtist('');
  };

  const handleMarkComplete = async () => {
    if (!currentSongId) return;
    setCompletedStatus('saving');
    try {
      await api.updateSongStatus(currentSongId, { status: 'completed' });
      setCompletedStatus('completed');
    } catch (err) {
      setError('Failed to mark as complete: ' + err.message);
      setCompletedStatus(null);
    }
  };

  const handleTitleChange = useCallback((val) => {
    setSongTitle(val);
  }, []);

  const handleArtistChange = useCallback((val) => {
    setSongArtist(val);
  }, []);

  const handleMetaBlur = useCallback(() => {
    if (currentSongId) {
      api.updateSong(currentSongId, { title: songTitle || null, artist: songArtist || null }).catch(() => {});
    }
  }, [currentSongId, songTitle, songArtist]);

  const handleChatUpdate = useCallback((newLyrics) => {
    onLyricsUpdated(newLyrics);
  }, [onLyricsUpdated]);

  return (
    <div>
      {/* Setup warning */}
      {needsProfile && (
        <div className="setup-banner">
          <span>Create a profile in the <strong>Profile</strong> tab to get started.</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <ModelSelector
        provider={llmSettings.provider}
        model={llmSettings.model}
        savedModels={savedModels}
        onChangeProvider={onChangeProvider}
        onChangeModel={onChangeModel}
        onOpenSettings={onOpenSettings}
      />

      {!rewriteResult && !loading && (
        <div className="input-section">
          <textarea
            rows="14"
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            placeholder="Paste lyrics, chords, or a copy from a tab site — any format works"
          />

          <textarea
            className="instruction-field"
            rows="2"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="Optional: e.g., 'change truck references to cycling, keep the fatherhood theme'"
          />

          <button className="btn primary" style={{ marginTop: '0.75rem' }} onClick={handleRewrite} disabled={!canRewrite}>
            Rewrite
          </button>
        </div>
      )}

      {(rewriteResult || loading) && (
        <div className="comparison-section">
          {rewriteResult && (
            <>
              <div className="comparison-header">
                <div className="comparison-actions">
                  <button className="btn secondary" onClick={handleNewSong}>
                    New Song
                  </button>
                  <button
                    className="btn secondary"
                    onClick={handleMarkComplete}
                    disabled={completedStatus === 'completed' || completedStatus === 'saving' || !currentSongId}
                  >
                    {completedStatus === 'completed' ? 'Completed!' :
                     completedStatus === 'saving' ? 'Saving...' : 'Mark as Complete'}
                  </button>
                </div>
              </div>

              <ComparisonView
                original={rewriteResult.original_lyrics}
                rewritten={rewriteResult.rewritten_lyrics}
                title={songTitle}
                artist={songArtist}
                onTitleChange={handleTitleChange}
                onArtistChange={handleArtistChange}
                onBlur={handleMetaBlur}
              />
            </>
          )}

          <ChatPanel
            songId={currentSongId}
            messages={chatMessages}
            setMessages={setChatMessages}
            llmSettings={llmSettings}
            originalLyrics={rewriteResult?.original_lyrics || ''}
            onLyricsUpdated={handleChatUpdate}
            initialLoading={loading}
          />
        </div>
      )}
    </div>
  );
}
