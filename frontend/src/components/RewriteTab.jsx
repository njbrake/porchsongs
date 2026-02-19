import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import ComparisonView from './ComparisonView';
import ChatPanel from './ChatPanel';
import ModelSelector from './ModelSelector';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader } from './ui/card';
import { Alert } from './ui/alert';

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
  const [lyrics, setLyricsRaw] = useState(
    () => sessionStorage.getItem('porchsongs_draft_lyrics') || ''
  );
  const [instruction, setInstructionRaw] = useState(
    () => sessionStorage.getItem('porchsongs_draft_instruction') || ''
  );

  const setLyrics = useCallback((val) => {
    setLyricsRaw(val);
    sessionStorage.setItem('porchsongs_draft_lyrics', val);
  }, []);
  const setInstruction = useCallback((val) => {
    setInstructionRaw(val);
    sessionStorage.setItem('porchsongs_draft_instruction', val);
  }, []);
  const [loading, setLoading] = useState(false);
  const [mobilePane, setMobilePane] = useState('chat');
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState(null);
  const [completedStatus, setCompletedStatus] = useState(null);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');

  useEffect(() => {
    if (rewriteMeta) {
      setSongTitle(rewriteMeta.title || '');
      setSongArtist(rewriteMeta.artist || '');
    }
  }, [rewriteMeta]);

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
    setStreamingText('');
    onNewRewrite(null, null);

    const preview = trimmedLyrics.length > 300
      ? trimmedLyrics.slice(0, 300) + '\n...'
      : trimmedLyrics;
    const seedMessages = [{ role: 'user', content: preview, isNote: true }];
    if (instruction.trim()) {
      seedMessages.push({ role: 'user', content: instruction.trim(), isNote: true });
    }
    setChatMessages(seedMessages);

    try {
      const reqData = {
        profile_id: profile.id,
        lyrics: trimmedLyrics,
        instruction: instruction.trim() || null,
        ...llmSettings,
      };

      let accumulated = '';
      const result = await api.rewriteStream(reqData, {
        onToken: (token) => {
          accumulated += token;
          setStreamingText(accumulated);
        },
      });

      setSongTitle(result.title || '');
      setSongArtist(result.artist || '');
      setStreamingText('');
      onNewRewrite(result, { profile_id: profile.id, title: result.title, artist: result.artist });

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

      const allSeedMessages = [
        ...seedMessages,
        { role: 'assistant', content: result.changes_summary, isNote: true },
      ];
      setChatMessages(allSeedMessages);

      api.saveChatMessages(song.id, allSeedMessages.map(m => ({
        role: m.role,
        content: m.content,
        is_note: m.isNote ?? false,
      }))).catch(() => {});
    } catch (err) {
      setError(err.message);
      setStreamingText('');
    } finally {
      setLoading(false);
    }
  };

  const handleNewSong = () => {
    onNewRewrite(null, null);
    setLyrics('');
    setInstruction('');
    setStreamingText('');
    setCompletedStatus(null);
    setError(null);
    setSongTitle('');
    setSongArtist('');
  };

  const handleScrap = async () => {
    if (!currentSongId) return;
    try {
      await api.deleteSong(currentSongId);
    } catch {
      // Song may already be gone
    }
    handleNewSong();
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

  const handleRewrittenChange = useCallback((newText) => {
    onLyricsUpdated(newText);
  }, [onLyricsUpdated]);

  const handleRewrittenBlur = useCallback(() => {
    if (currentSongId && rewriteResult) {
      api.updateSong(currentSongId, { rewritten_lyrics: rewriteResult.rewritten_lyrics }).catch(() => {});
    }
  }, [currentSongId, rewriteResult]);

  const handleChatUpdate = useCallback((newLyrics) => {
    onLyricsUpdated(newLyrics);
  }, [onLyricsUpdated]);

  return (
    <div>
      {needsProfile && (
        <Alert variant="warning" className="mb-4">
          <span>Create a profile in the <strong>Profile</strong> tab to get started.</span>
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mt-4 mb-4">
          <span>{error}</span>
          <button
            className="bg-transparent border-0 text-xl cursor-pointer text-error-text p-0 leading-none opacity-70 hover:opacity-100"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </Alert>
      )}

      {!rewriteResult && !loading && (
        <>
          <ModelSelector
            provider={llmSettings.provider}
            model={llmSettings.model}
            savedModels={savedModels}
            onChangeProvider={onChangeProvider}
            onChangeModel={onChangeModel}
            onOpenSettings={onOpenSettings}
          />

          <Card>
            <CardContent className="pt-6">
              <Textarea
                rows="10"
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Paste lyrics, chords, or a copy from a tab site — any format works"
              />

              <Textarea
                className="mt-3 font-[family-name:var(--font-ui)]"
                rows="2"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="Optional: e.g., 'change truck references to cycling, keep the fatherhood theme'"
              />

              <Button className="mt-3" onClick={handleRewrite} disabled={!canRewrite}>
                Rewrite
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {(rewriteResult || loading) && (
        <div className="mt-2">
          {rewriteResult && (
            <>
              {/* Mobile pane toggle — hidden on md+ */}
              <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-3">
                <button
                  className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${mobilePane === 'chat' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}
                  onClick={() => setMobilePane('chat')}
                >
                  Chat Workshop
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${mobilePane === 'lyrics' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}
                  onClick={() => setMobilePane('lyrics')}
                >
                  Your Version
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 items-stretch h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)]">
                <div className={`flex-col min-h-0 ${mobilePane === 'chat' ? 'flex' : 'hidden'} md:flex`}>
                  <ModelSelector
                    provider={llmSettings.provider}
                    model={llmSettings.model}
                    savedModels={savedModels}
                    onChangeProvider={onChangeProvider}
                    onChangeModel={onChangeModel}
                    onOpenSettings={onOpenSettings}
                  />

                  <div className="flex gap-2 mb-2 flex-wrap">
                    <Button variant="secondary" onClick={handleNewSong}>
                      New Song
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleMarkComplete}
                      disabled={completedStatus === 'completed' || completedStatus === 'saving' || !currentSongId}
                    >
                      {completedStatus === 'completed' ? 'Completed!' :
                       completedStatus === 'saving' ? 'Saving...' : 'Mark as Complete'}
                    </Button>
                    <Button
                      variant="danger-outline"
                      onClick={handleScrap}
                      disabled={!currentSongId}
                    >
                      Scrap This
                    </Button>
                  </div>

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

                <div className={`flex-col min-h-0 overflow-hidden ${mobilePane === 'lyrics' ? 'flex' : 'hidden'} md:flex`}>
                  <div className="flex flex-col gap-1 mb-2">
                    <input
                      className="text-xl font-bold border-0 border-b border-dashed border-border bg-transparent py-1 text-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground placeholder:font-normal"
                      type="text"
                      value={songTitle || ''}
                      onChange={e => handleTitleChange(e.target.value)}
                      onBlur={handleMetaBlur}
                      placeholder="Song title"
                    />
                    <input
                      className="text-base border-0 border-b border-dashed border-border bg-transparent py-0.5 text-muted-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                      type="text"
                      value={songArtist || ''}
                      onChange={e => handleArtistChange(e.target.value)}
                      onBlur={handleMetaBlur}
                      placeholder="Artist"
                    />
                  </div>

                  <ComparisonView
                    original={rewriteResult.original_lyrics}
                    rewritten={rewriteResult.rewritten_lyrics}
                    onRewrittenChange={handleRewrittenChange}
                    onRewrittenBlur={handleRewrittenBlur}
                  />
                </div>
              </div>
            </>
          )}

          {!rewriteResult && loading && (
            <>
              {/* Mobile pane toggle — hidden on md+ */}
              <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-3">
                <button
                  className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${mobilePane === 'chat' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}
                  onClick={() => setMobilePane('chat')}
                >
                  Chat Workshop
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${mobilePane === 'lyrics' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}
                  onClick={() => setMobilePane('lyrics')}
                >
                  Your Version
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 items-stretch h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)]">
                <div className={`flex-col min-h-0 ${mobilePane === 'chat' ? 'flex' : 'hidden'} md:flex`}>
                  <ChatPanel
                    songId={currentSongId}
                    messages={chatMessages}
                    setMessages={setChatMessages}
                    llmSettings={llmSettings}
                    originalLyrics={''}
                    onLyricsUpdated={handleChatUpdate}
                    initialLoading={loading}
                  />
                </div>

                <div className={`flex-col min-h-0 overflow-hidden ${mobilePane === 'lyrics' ? 'flex' : 'hidden'} md:flex`}>
                  {streamingText && (
                    <Card className="flex flex-col flex-1 overflow-hidden">
                      <CardHeader>Your Version</CardHeader>
                      <pre className="p-3 sm:p-4 font-[family-name:var(--font-mono)] text-xs sm:text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words flex-1 overflow-y-auto">{(() => {
                        const match = streamingText.match(/<rewritten>\s*([\s\S]*?)(?:<\/rewritten>|$)/);
                        return match ? match[1].trimStart() : streamingText;
                      })()}</pre>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
