import { useState, useCallback } from 'react';
import api from '../api';
import ComparisonView from './ComparisonView';
import WorkshopPanel from './WorkshopPanel';
import ChatPanel from './ChatPanel';

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
}) {
  const [url, setUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualLyrics, setManualLyrics] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedStatus, setCompletedStatus] = useState(null); // null | 'completed' | 'saving'

  // Workshop state
  const [workshopLine, setWorkshopLine] = useState(null);

  const validate = () => {
    if (!profile?.id) {
      alert('Please create a profile first (Profile tab).');
      return false;
    }
    if (!llmSettings.api_key) {
      alert('Please configure your LLM API key in Settings (gear icon).');
      return false;
    }
    return true;
  };

  const doRewrite = async (rewriteData, meta) => {
    if (!validate()) return;
    setLoading(true);
    onNewRewrite(null, null);

    try {
      const result = await api.rewrite(rewriteData);
      onNewRewrite(result, meta);

      // Auto-save as draft
      const song = await api.saveSong({
        profile_id: meta.profile_id,
        title: meta.title,
        artist: meta.artist,
        source_url: meta.source_url,
        original_lyrics: result.original_lyrics,
        rewritten_lyrics: result.rewritten_lyrics,
        changes_summary: result.changes_summary,
        llm_provider: llmSettings.provider,
        llm_model: llmSettings.model,
      });
      onSongSaved(song.id);
      setCompletedStatus(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAndRewrite = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      alert('Please paste an Ultimate Guitar URL.');
      return;
    }

    setLoading(true);
    try {
      const tab = await api.fetchTab(trimmedUrl);
      await doRewrite(
        {
          profile_id: profile.id,
          title: tab.title,
          artist: tab.artist,
          lyrics: tab.lyrics_with_chords,
          source_url: trimmedUrl,
          instruction: instruction.trim() || null,
          ...llmSettings,
        },
        {
          title: tab.title,
          artist: tab.artist,
          source_url: trimmedUrl,
          profile_id: profile.id,
        }
      );
    } catch (err) {
      alert('Error: ' + err.message);
      setLoading(false);
    }
  };

  const handleManualRewrite = async () => {
    const lyrics = manualLyrics.trim();
    if (!lyrics) {
      alert('Please paste some lyrics.');
      return;
    }
    const title = manualTitle.trim() || null;
    const artist = manualArtist.trim() || null;

    await doRewrite(
      {
        profile_id: profile.id,
        title,
        artist,
        lyrics,
        instruction: instruction.trim() || null,
        ...llmSettings,
      },
      {
        title: title || 'Untitled',
        artist,
        source_url: null,
        profile_id: profile.id,
      }
    );
  };

  const handleMarkComplete = async () => {
    if (!currentSongId) return;
    setCompletedStatus('saving');
    try {
      await api.updateSongStatus(currentSongId, {
        status: 'completed',
        provider: llmSettings.provider,
        model: llmSettings.model,
        api_key: llmSettings.api_key,
        api_base: llmSettings.api_base,
      });
      setCompletedStatus('completed');
    } catch (err) {
      alert('Failed to mark as complete: ' + err.message);
      setCompletedStatus(null);
    }
  };

  const handleLineClick = (lineIndex) => {
    if (!currentSongId) {
      alert('Song must be saved as a draft before editing individual lines.');
      return;
    }
    setWorkshopLine(lineIndex);
  };

  const handleWorkshopApply = useCallback((newLyrics) => {
    onLyricsUpdated(newLyrics);
    setWorkshopLine(null);
    // Add system note to chat
    setChatMessages(prev => [
      ...prev,
      { role: 'user', content: `[System note: A line was edited via line workshop]`, isNote: true },
    ]);
  }, [onLyricsUpdated, setChatMessages]);

  const handleChatUpdate = useCallback((newLyrics) => {
    onLyricsUpdated(newLyrics);
  }, [onLyricsUpdated]);

  return (
    <div>
      <div className="input-section">
        <label>Paste an Ultimate Guitar link:</label>
        <div className="url-row">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://tabs.ultimate-guitar.com/tab/..."
            onKeyDown={e => e.key === 'Enter' && handleFetchAndRewrite()}
          />
          <button className="btn primary" onClick={handleFetchAndRewrite} disabled={loading}>
            Fetch &amp; Rewrite
          </button>
        </div>
        <textarea
          className="instruction-field"
          rows="2"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="How should this song be rewritten? e.g., 'change truck references to cycling, keep the fatherhood theme'"
        />
        <button className="link-btn" onClick={() => setShowManual(!showManual)}>
          or paste lyrics manually {showManual ? '\u25B4' : '\u25BE'}
        </button>
        {showManual && (
          <div className="manual-section">
            <div className="manual-fields">
              <div className="field-row">
                <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Song title (optional)" />
                <input type="text" value={manualArtist} onChange={e => setManualArtist(e.target.value)} placeholder="Artist (optional)" />
              </div>
              <textarea rows="12" value={manualLyrics} onChange={e => setManualLyrics(e.target.value)}
                placeholder="Paste lyrics here (with or without chords)..." />
              <button className="btn primary" onClick={handleManualRewrite} disabled={loading}>Rewrite</button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <span>Rewriting your lyrics...</span>
        </div>
      )}

      {rewriteResult && (
        <div className="comparison-section">
          <div className="comparison-header">
            <h2>
              {rewriteMeta?.title || 'Rewritten Song'}
              {rewriteMeta?.artist ? ` — ${rewriteMeta.artist}` : ''}
            </h2>
            <button
              className="btn secondary"
              onClick={handleMarkComplete}
              disabled={completedStatus === 'completed' || completedStatus === 'saving' || !currentSongId}
            >
              {completedStatus === 'completed' ? 'Completed!' :
               completedStatus === 'saving' ? 'Saving...' : 'Mark as Complete'}
            </button>
          </div>

          <ComparisonView
            original={rewriteResult.original_lyrics}
            rewritten={rewriteResult.rewritten_lyrics}
            onLineClick={handleLineClick}
            selectedLine={workshopLine}
          />

          {workshopLine !== null && (
            <WorkshopPanel
              songId={currentSongId}
              lineIndex={workshopLine}
              originalLyrics={rewriteResult.original_lyrics}
              rewrittenLyrics={rewriteResult.rewritten_lyrics}
              llmSettings={llmSettings}
              onApply={handleWorkshopApply}
              onClose={() => setWorkshopLine(null)}
            />
          )}

          {currentSongId && (
            <ChatPanel
              songId={currentSongId}
              messages={chatMessages}
              setMessages={setChatMessages}
              llmSettings={llmSettings}
              originalLyrics={rewriteResult.original_lyrics}
              onLyricsUpdated={handleChatUpdate}
            />
          )}

          <div className="changes-summary">
            <h3>Changes</h3>
            <div className="changes-display">{rewriteResult.changes_summary}</div>
          </div>
        </div>
      )}
    </div>
  );
}
