import { useState, useEffect, useCallback } from 'react';
import api from '@/api';
import ComparisonView from '@/components/ComparisonView';
import ChatPanel from '@/components/ChatPanel';
import ModelSelector from '@/components/ModelSelector';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import type { Profile, RewriteResult, RewriteMeta, ChatMessage, LlmSettings, SavedModel } from '@/types';

interface RewriteTabProps {
  profile: Profile | null;
  llmSettings: LlmSettings;
  rewriteResult: RewriteResult | null;
  rewriteMeta: RewriteMeta | null;
  currentSongId: number | null;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onNewRewrite: (result: RewriteResult | null, meta: RewriteMeta | null) => void;
  onSongSaved: (songId: number) => void;
  onLyricsUpdated: (lyrics: string) => void;
  onChangeProvider: (provider: string) => void;
  onChangeModel: (model: string) => void;
  reasoningEffort: string;
  onChangeReasoningEffort: (value: string) => void;
  savedModels: SavedModel[];
  onOpenSettings: () => void;
}

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
  reasoningEffort,
  onChangeReasoningEffort,
  savedModels,
  onOpenSettings,
}: RewriteTabProps) {
  const [lyrics, setLyricsRaw] = useState(
    () => sessionStorage.getItem('porchsongs_draft_lyrics') || ''
  );
  const [instruction, setInstructionRaw] = useState(
    () => sessionStorage.getItem('porchsongs_draft_instruction') || ''
  );

  const setLyrics = useCallback((val: string) => {
    setLyricsRaw(val);
    sessionStorage.setItem('porchsongs_draft_lyrics', val);
  }, []);
  const setInstruction = useCallback((val: string) => {
    setInstructionRaw(val);
    sessionStorage.setItem('porchsongs_draft_instruction', val);
  }, []);
  const [loading, setLoading] = useState(false);
  const [mobilePane, setMobilePane] = useState<'chat' | 'lyrics'>('chat');
  const [streamingText, setStreamingText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedStatus, setCompletedStatus] = useState<'saving' | 'completed' | null>(null);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);

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

  const rewriteBlocker = needsProfile
    ? 'Create a profile first'
    : !llmSettings.provider || !llmSettings.model
      ? 'Select a model'
      : lyrics.trim().length === 0
        ? 'Paste some lyrics above'
        : null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const shortcutHint = `${isMac ? '\u2318' : 'Ctrl'}+Enter to rewrite`;

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
    const seedMessages: ChatMessage[] = [{ role: 'user', content: preview, isNote: true }];
    if (instruction.trim()) {
      seedMessages.push({ role: 'user', content: instruction.trim(), isNote: true });
    }
    setChatMessages(seedMessages);

    try {
      const reqData = {
        profile_id: profile!.id,
        lyrics: trimmedLyrics,
        instruction: instruction.trim() || null,
        ...llmSettings,
      };

      let accumulated = '';
      setThinking(false);
      const result = await api.rewriteStream(reqData, {
        onThinking: () => setThinking(true),
        onToken: (token) => {
          setThinking(false);
          accumulated += token;
          setStreamingText(accumulated);
        },
      });

      setSongTitle(result.title || '');
      setSongArtist(result.artist || '');
      setStreamingText('');
      onNewRewrite(result, { profile_id: profile!.id, title: result.title, artist: result.artist });

      const song = await api.saveSong({
        profile_id: profile!.id,
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

      const allSeedMessages: ChatMessage[] = [
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
      setError((err as Error).message);
      setStreamingText('');
      setThinking(false);
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
      setError('Failed to mark as complete: ' + (err as Error).message);
      setCompletedStatus(null);
    }
  };

  const handleTitleChange = useCallback((val: string) => {
    setSongTitle(val);
  }, []);

  const handleArtistChange = useCallback((val: string) => {
    setSongArtist(val);
  }, []);

  const handleMetaBlur = useCallback(() => {
    if (currentSongId) {
      api.updateSong(currentSongId, { title: songTitle || null, artist: songArtist || null } as Partial<import('@/types').Song>).catch(() => {});
    }
  }, [currentSongId, songTitle, songArtist]);

  const handleRewrittenChange = useCallback((newText: string) => {
    onLyricsUpdated(newText);
  }, [onLyricsUpdated]);

  const handleRewrittenBlur = useCallback(() => {
    if (currentSongId && rewriteResult) {
      api.updateSong(currentSongId, { rewritten_lyrics: rewriteResult.rewritten_lyrics } as Partial<import('@/types').Song>).catch(() => {});
    }
  }, [currentSongId, rewriteResult]);

  const handleChatUpdate = useCallback((newLyrics: string) => {
    onLyricsUpdated(newLyrics);
  }, [onLyricsUpdated]);

  return (
    <div>
      {needsProfile && (
        <Alert variant="warning" className="mb-4">
          <span>
            Create a profile in the{' '}
            <Button variant="link-inline" onClick={onOpenSettings}>Profile tab</Button>
            {' '}to get started.
          </span>
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
          <div className="flex items-end gap-3 flex-wrap">
            <ModelSelector
              provider={llmSettings.provider}
              model={llmSettings.model}
              savedModels={savedModels}
              onChangeProvider={onChangeProvider}
              onChangeModel={onChangeModel}
              onOpenSettings={onOpenSettings}
            />
            <div className="flex flex-col gap-1 mb-2">
              <label className="text-xs text-muted-foreground" htmlFor="reasoning-effort">Effort</label>
              <select
                id="reasoning-effort"
                className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                value={reasoningEffort}
                onChange={e => onChangeReasoningEffort(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Textarea
                rows={10}
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Paste lyrics, chords, or a copy from a tab site — any format works"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRewrite) {
                    e.preventDefault();
                    handleRewrite();
                  }
                }}
              />

              <Textarea
                className="mt-3 font-[family-name:var(--font-ui)]"
                rows={2}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="Optional: e.g., 'change truck references to cycling, keep the fatherhood theme'"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRewrite) {
                    e.preventDefault();
                    handleRewrite();
                  }
                }}
              />

              <div className="flex items-center gap-3 mt-3">
                <Button onClick={handleRewrite} disabled={!canRewrite}>
                  Rewrite
                </Button>
                <span className="text-xs text-muted-foreground">
                  {rewriteBlocker ?? shortcutHint}
                </span>
              </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 items-stretch h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)] transition-all duration-300">
                <div className={`flex-col min-h-0 ${mobilePane === 'chat' ? 'flex' : 'hidden'} md:flex`}>
                  <div className="flex items-end gap-3 flex-wrap">
                    <ModelSelector
                      provider={llmSettings.provider}
                      model={llmSettings.model}
                      savedModels={savedModels}
                      onChangeProvider={onChangeProvider}
                      onChangeModel={onChangeModel}
                      onOpenSettings={onOpenSettings}
                    />
                    <div className="flex flex-col gap-1 mb-2">
                      <label className="text-xs text-muted-foreground" htmlFor="reasoning-effort-active">Effort</label>
                      <select
                        id="reasoning-effort-active"
                        className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                        value={reasoningEffort}
                        onChange={e => onChangeReasoningEffort(e.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

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
                      onClick={() => setScrapDialogOpen(true)}
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
                      aria-label="Song title"
                    />
                    <input
                      className="text-base border-0 border-b border-dashed border-border bg-transparent py-0.5 text-muted-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                      type="text"
                      value={songArtist || ''}
                      onChange={e => handleArtistChange(e.target.value)}
                      onBlur={handleMetaBlur}
                      placeholder="Artist"
                      aria-label="Artist"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 items-stretch h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)] transition-all duration-300">
                <div className={`flex-col min-h-0 ${mobilePane === 'chat' ? 'flex' : 'hidden'} md:flex`}>
                  <div className="flex items-end gap-3 flex-wrap opacity-50 pointer-events-none">
                    <ModelSelector
                      provider={llmSettings.provider}
                      model={llmSettings.model}
                      savedModels={savedModels}
                      onChangeProvider={onChangeProvider}
                      onChangeModel={onChangeModel}
                      onOpenSettings={onOpenSettings}
                    />
                    <div className="flex flex-col gap-1 mb-2">
                      <label className="text-xs text-muted-foreground" htmlFor="reasoning-effort-loading">Effort</label>
                      <select
                        id="reasoning-effort-loading"
                        className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                        value={reasoningEffort}
                        disabled
                        onChange={e => onChangeReasoningEffort(e.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

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
                  {streamingText ? (
                    <Card className="flex flex-col flex-1 overflow-hidden">
                      <CardHeader>Your Version</CardHeader>
                      <pre className="p-3 sm:p-4 font-[family-name:var(--font-mono)] text-xs sm:text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words flex-1 overflow-y-auto">{(() => {
                        const match = streamingText.match(/<rewritten>\s*([\s\S]*?)(?:<\/rewritten>|$)/);
                        return match ? match[1]!.trimStart() : streamingText;
                      })()}</pre>
                    </Card>
                  ) : (
                    <Card className="flex flex-col flex-1 items-center justify-center text-muted-foreground gap-3">
                      <div className="size-8 border-3 border-border border-t-primary rounded-full animate-spin" aria-hidden="true" />
                      <span className="text-sm">{thinking ? 'Thinking...' : 'Rewriting lyrics...'}</span>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={scrapDialogOpen}
        onOpenChange={setScrapDialogOpen}
        title="Scrap This Song"
        description="Are you sure you want to scrap this song? The draft will be permanently deleted."
        confirmLabel="Scrap"
        variant="destructive"
        onConfirm={handleScrap}
      />
    </div>
  );
}
