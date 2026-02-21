import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/api';
import ComparisonView from '@/components/ComparisonView';
import ChatPanel from '@/components/ChatPanel';
import ModelSelector from '@/components/ModelSelector';
import ResizableColumns from '@/components/ui/resizable-columns';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import type { Profile, RewriteResult, RewriteMeta, ChatMessage, LlmSettings, SavedModel, ParseResult } from '@/types';

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
  onContentUpdated: (content: string) => void;
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
  onContentUpdated,
  onChangeProvider,
  onChangeModel,
  reasoningEffort,
  onChangeReasoningEffort,
  savedModels,
  onOpenSettings,
}: RewriteTabProps) {
  const [input, setInputRaw] = useState(
    () => sessionStorage.getItem('porchsongs_draft_input') || ''
  );

  const setInput = useCallback((val: string) => {
    setInputRaw(val);
    sessionStorage.setItem('porchsongs_draft_input', val);
  }, []);
  const [loading, setLoading] = useState(false);
  const parseAbortRef = useRef<AbortController | null>(null);
  const [mobilePane, setMobilePane] = useState<'chat' | 'content'>('chat');
  const [error, setError] = useState<string | null>(null);
  const [completedStatus, setCompletedStatus] = useState<'saving' | 'completed' | null>(null);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);

  // Parse state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsedContent, setParsedContent] = useState('');
  const [parseStreamText, setParseStreamText] = useState('');

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
  const canParse = !needsProfile && llmSettings.provider && llmSettings.model && !loading && input.trim().length > 0;

  const parseBlocker = needsProfile
    ? 'Create a profile first'
    : !llmSettings.provider || !llmSettings.model
      ? 'Select a model'
      : input.trim().length === 0
        ? 'Paste some content above'
        : null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const shortcutHint = `${isMac ? '\u2318' : 'Ctrl'}+Enter to parse`;

  // State derivation
  const isInput = !loading && !parseResult && !rewriteResult;
  const isParsed = !!parseResult && !rewriteResult;
  const isWorkshopping = !!rewriteResult;

  const handleParse = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const controller = new AbortController();
    parseAbortRef.current = controller;
    setLoading(true);
    setError(null);
    setParseStreamText('');
    onNewRewrite(null, null);
    setParseResult(null);

    try {
      const result = await api.parseStream(
        {
          profile_id: profile!.id,
          content: trimmedInput,
          ...llmSettings,
        },
        (token: string) => {
          setParseStreamText(prev => prev + token);
        },
        controller.signal,
      );

      setParseResult(result);
      setParsedContent(result.original_content);
      setSongTitle(result.title || '');
      setSongArtist(result.artist || '');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      parseAbortRef.current = null;
      setLoading(false);
      setParseStreamText('');
    }
  };

  const handleCancelParse = () => {
    parseAbortRef.current?.abort();
  };

  const handleBeforeSend = useCallback(async (): Promise<number> => {
    const song = await api.saveSong({
      profile_id: profile!.id,
      title: songTitle || null,
      artist: songArtist || null,
      original_content: parsedContent,
      rewritten_content: parsedContent,
      llm_provider: llmSettings.provider,
      llm_model: llmSettings.model,
    });
    onSongSaved(song.id);
    return song.id;
  }, [profile, songTitle, songArtist, parsedContent, llmSettings, onSongSaved]);

  const handleChatUpdate = useCallback((newContent: string) => {
    if (!rewriteResult && parseResult) {
      // First chat edit — transition to WORKSHOPPING
      onNewRewrite(
        {
          original_content: parsedContent,
          rewritten_content: newContent,
          changes_summary: 'Chat edit applied.',
        },
        {
          profile_id: profile?.id,
          title: songTitle || undefined,
          artist: songArtist || undefined,
          llm_provider: llmSettings.provider,
          llm_model: llmSettings.model,
        },
      );
    } else {
      onContentUpdated(newContent);
    }
  }, [rewriteResult, parseResult, parsedContent, profile, songTitle, songArtist, llmSettings, onNewRewrite, onContentUpdated]);

  const handleNewSong = () => {
    onNewRewrite(null, null);
    setInput('');
    setParseResult(null);
    setParsedContent('');
    setParseStreamText('');
    setCompletedStatus(null);
    setError(null);
    setSongTitle('');
    setSongArtist('');
    setChatMessages([]);
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
    onContentUpdated(newText);
  }, [onContentUpdated]);

  const handleRewrittenBlur = useCallback(() => {
    if (currentSongId && rewriteResult) {
      api.updateSong(currentSongId, { rewritten_content: rewriteResult.rewritten_content } as Partial<import('@/types').Song>).catch(() => {});
    }
  }, [currentSongId, rewriteResult]);

  // Shared model selector + effort controls
  const modelControls = (disabled?: boolean) => (
    <div className={`flex items-end gap-3 flex-wrap ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
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
          disabled={disabled}
          onChange={e => onChangeReasoningEffort(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>
  );

  // Mobile pane toggle
  const mobilePaneToggle = (
    <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-3">
      <button
        className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${mobilePane === 'chat' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}
        onClick={() => setMobilePane('chat')}
      >
        Chat Workshop
      </button>
      <button
        className={`flex-1 py-2 text-sm font-semibold text-center transition-colors ${mobilePane === 'content' ? 'bg-primary text-white' : 'bg-card text-muted-foreground'}`}
        onClick={() => setMobilePane('content')}
      >
        Your Version
      </button>
    </div>
  );

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

      {/* INPUT state */}
      {isInput && !loading && (
        <>
          {modelControls()}

          <Card>
            <CardContent className="pt-6">
              <Textarea
                rows={10}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Paste lyrics, chords, or a copy from a tab site — any format works"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canParse) {
                    e.preventDefault();
                    handleParse();
                  }
                }}
              />

              <div className="flex items-center gap-3 mt-3">
                <Button onClick={handleParse} disabled={!canParse}>
                  Parse
                </Button>
                <span className="text-xs text-muted-foreground">
                  {parseBlocker ?? shortcutHint}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PARSING state (loading, no parse result yet) */}
      {loading && !parseResult && (
        <Card className="flex flex-col text-muted-foreground">
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="size-6 border-3 border-border border-t-primary rounded-full animate-spin" aria-hidden="true" />
            <span className="text-sm">Parsing song...</span>
            <Button variant="danger-outline" size="sm" onClick={handleCancelParse}>Cancel</Button>
          </div>
          {parseStreamText && (
            <pre className="px-4 pb-4 whitespace-pre-wrap break-words text-xs font-[family-name:var(--font-mono)] text-foreground max-h-[60vh] overflow-y-auto">{parseStreamText}</pre>
          )}
        </Card>
      )}

      {/* PARSED state */}
      {isParsed && (
        <div className="mt-2">
          {mobilePaneToggle}

          <ResizableColumns
            className="h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)]"
            columnClassName="flex-col min-h-0"
            mobilePane={mobilePane === 'chat' ? 'left' : 'right'}
            left={
              <>
                {modelControls()}

                <div className="flex gap-2 mb-2 flex-wrap">
                  <Button variant="secondary" onClick={handleNewSong}>
                    New Song
                  </Button>
                </div>

                <ChatPanel
                  songId={currentSongId}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  llmSettings={llmSettings}
                  onContentUpdated={handleChatUpdate}
                  initialLoading={false}
                  onBeforeSend={handleBeforeSend}
                />
              </>
            }
            right={
              <>
                <div className="flex flex-col gap-1 mb-2">
                  <input
                    className="text-xl font-bold border-0 border-b border-dashed border-border bg-transparent py-1 text-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground placeholder:font-normal"
                    type="text"
                    value={songTitle || ''}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Song title"
                    aria-label="Song title"
                  />
                  <input
                    className="text-base border-0 border-b border-dashed border-border bg-transparent py-0.5 text-muted-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                    type="text"
                    value={songArtist || ''}
                    onChange={e => handleArtistChange(e.target.value)}
                    placeholder="Artist"
                    aria-label="Artist"
                  />
                </div>

                <Card className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-3 sm:p-4 font-[family-name:var(--font-mono)] text-xs sm:text-[0.82rem] leading-relaxed flex-1 overflow-y-auto">
                    <Textarea
                      className="w-full h-full min-h-[200px] border-0 p-0 font-[family-name:var(--font-mono)] text-xs sm:text-[0.82rem] leading-relaxed resize-none focus-visible:ring-0"
                      value={parsedContent}
                      onChange={e => setParsedContent(e.target.value)}
                    />
                  </div>
                </Card>
              </>
            }
          />
        </div>
      )}

      {/* WORKSHOPPING state */}
      {isWorkshopping && (
        <div className="mt-2">
          {mobilePaneToggle}

          <ResizableColumns
            className="h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)]"
            columnClassName="flex-col min-h-0"
            mobilePane={mobilePane === 'chat' ? 'left' : 'right'}
            left={
              <>
                {modelControls()}

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
                  onContentUpdated={handleChatUpdate}
                  initialLoading={false}
                  onContentStreaming={handleChatUpdate}
                />
              </>
            }
            right={
              <>
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
                  original={rewriteResult!.original_content}
                  rewritten={rewriteResult!.rewritten_content}
                  onRewrittenChange={handleRewrittenChange}
                  onRewrittenBlur={handleRewrittenBlur}
                />
              </>
            }
          />
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
