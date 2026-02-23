import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import api, { STORAGE_KEYS } from '@/api';
import ComparisonView from '@/components/ComparisonView';
import ChatPanel from '@/components/ChatPanel';
import ModelSelector from '@/components/ModelSelector';
import ResizableColumns from '@/components/ui/resizable-columns';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import StreamingPre from '@/components/ui/streaming-pre';
import { Alert } from '@/components/ui/alert';
import { cn, copyToClipboard } from '@/lib/utils';
import type { Profile, Song, RewriteResult, RewriteMeta, ChatMessage, LlmSettings, SavedModel, ParseResult } from '@/types';

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
  /** When true, provider/model selection is managed by the platform. */
  isPremium?: boolean;
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
  isPremium,
}: RewriteTabProps) {
  const [input, setInputRaw] = useState(
    () => sessionStorage.getItem(STORAGE_KEYS.DRAFT_INPUT) || ''
  );

  const setInput = useCallback((val: string) => {
    setInputRaw(val);
    sessionStorage.setItem(STORAGE_KEYS.DRAFT_INPUT, val);
  }, []);

  const [instruction, setInstructionRaw] = useState(
    () => sessionStorage.getItem(STORAGE_KEYS.DRAFT_INSTRUCTION) || ''
  );
  const setInstruction = useCallback((val: string) => {
    setInstructionRaw(val);
    sessionStorage.setItem(STORAGE_KEYS.DRAFT_INSTRUCTION, val);
  }, []);
  const [loading, setLoading] = useState(false);
  const parseAbortRef = useRef<AbortController | null>(null);
  const [mobilePane, setMobilePane] = useState<'chat' | 'content'>('chat');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | null>(null);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);

  // Parse state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsedContent, setParsedContent] = useState('');
  const [parseStreamText, setParseStreamText] = useState('');
  const [parseReasoningText, setParseReasoningText] = useState('');
  const [parseReasoningExpanded, setParseReasoningExpanded] = useState(false);

  useEffect(() => {
    if (rewriteMeta) {
      setSongTitle(rewriteMeta.title || '');
      setSongArtist(rewriteMeta.artist || '');
    }
  }, [rewriteMeta]);

  useEffect(() => {
    setSaveStatus(null);
  }, [currentSongId]);

  const needsProfile = !profile?.id;
  const hasModel = isPremium || (llmSettings.provider && llmSettings.model);
  const canParse = !needsProfile && hasModel && !loading && input.trim().length > 0;

  const parseBlocker = needsProfile
    ? 'Create a profile first'
    : !hasModel
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

  // Height for the two-pane layout: account for header + tabs + mobile pane toggle
  const splitHeight = 'h-[calc(100dvh-11rem)] md:h-[calc(100dvh-7rem)]';

  const handleParse = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const controller = new AbortController();
    parseAbortRef.current = controller;
    setLoading(true);
    setError(null);
    setParseStreamText('');
    setParseReasoningText('');
    onNewRewrite(null, null);
    setParseResult(null);

    let reasoningAccumulated = '';
    try {
      const result = await api.parseStream(
        {
          profile_id: profile!.id,
          content: trimmedInput,
          ...llmSettings,
          ...(instruction.trim() && { instruction: instruction.trim() }),
        },
        (token: string) => {
          setParseStreamText(prev => prev + token);
        },
        controller.signal,
        (reasoningToken: string) => {
          reasoningAccumulated += reasoningToken;
          setParseReasoningText(reasoningAccumulated);
        },
      );

      setParseResult(result);
      setParsedContent(result.original_content);
      setSongTitle(result.title || '');
      setSongArtist(result.artist || '');
      setInstruction('');
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
    setParseReasoningText('');
    setParseReasoningExpanded(false);
    setSaveStatus(null);
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

  const handleSave = async () => {
    if (!currentSongId || !rewriteResult) return;
    setSaveStatus('saving');
    try {
      await api.updateSong(currentSongId, {
        title: songTitle || null,
        artist: songArtist || null,
        rewritten_content: rewriteResult.rewritten_content,
        original_content: rewriteResult.original_content,
      } as Partial<Song>);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setError('Failed to save: ' + (err as Error).message);
      setSaveStatus(null);
    }
  };

  const handleSaveAs = async () => {
    if (!currentSongId || !rewriteResult) return;
    setSaveStatus('saving');
    try {
      // Save current state first
      await api.updateSong(currentSongId, {
        title: songTitle || null,
        artist: songArtist || null,
        rewritten_content: rewriteResult.rewritten_content,
        original_content: rewriteResult.original_content,
      } as Partial<Song>);
      // Duplicate
      const copy = await api.duplicateSong(currentSongId);
      setSaveStatus(null);
      // Switch to editing the copy
      setSongTitle(copy.title || '');
      setSongArtist(copy.artist || '');
      setChatMessages([]);
      onNewRewrite(
        {
          original_content: copy.original_content,
          rewritten_content: copy.rewritten_content,
          changes_summary: copy.changes_summary || '',
        },
        {
          profile_id: copy.profile_id,
          title: copy.title || undefined,
          artist: copy.artist || undefined,
          llm_provider: copy.llm_provider || undefined,
          llm_model: copy.llm_model || undefined,
        },
      );
      onSongSaved(copy.id);
      toast.success('Saved as copy');
    } catch (err) {
      setError('Failed to save as copy: ' + (err as Error).message);
      setSaveStatus(null);
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
      api.updateSong(currentSongId, { title: songTitle || null, artist: songArtist || null } as Partial<Song>).catch(() => {});
    }
  }, [currentSongId, songTitle, songArtist]);

  const handleOriginalContentUpdated = useCallback((newOriginal: string) => {
    if (!rewriteResult && parseResult) {
      // PARSED state — update the editable parsed content
      setParsedContent(newOriginal);
    } else if (rewriteResult) {
      // WORKSHOPPING state — update the original in the rewrite result
      onNewRewrite(
        { ...rewriteResult, original_content: newOriginal },
        rewriteMeta,
      );
    }
    // Persist to DB
    if (currentSongId) {
      api.updateSong(currentSongId, { original_content: newOriginal } as Partial<Song>).catch(() => {});
    }
  }, [rewriteResult, parseResult, rewriteMeta, currentSongId, onNewRewrite]);

  const handleRewrittenChange = useCallback((newText: string) => {
    onContentUpdated(newText);
  }, [onContentUpdated]);

  const handleRewrittenBlur = useCallback(() => {
    if (currentSongId && rewriteResult) {
      api.updateSong(currentSongId, { rewritten_content: rewriteResult.rewritten_content } as Partial<Song>).catch(() => {});
    }
  }, [currentSongId, rewriteResult]);

  const handleShare = useCallback(async () => {
    if (!rewriteResult) return;

    const titleLine = songTitle ? `# ${songTitle}` : '# Untitled Song';
    const artistLine = songArtist ? `*${songArtist}*` : '';
    const header = [titleLine, artistLine].filter(Boolean).join('\n');

    const sections: string[] = [header];

    sections.push('\n---\n\n## Original\n```\n' + rewriteResult.original_content + '\n```');

    if (chatMessages.length > 0) {
      const chatLines = chatMessages
        .filter(m => !m.isNote)
        .map(m => m.role === 'user' ? `**You:** ${m.content}` : `**AI:** ${m.content}`)
        .join('\n\n');
      sections.push('\n---\n\n## Conversation\n' + chatLines);
    }

    sections.push('\n---\n\n## Final Version\n```\n' + rewriteResult.rewritten_content + '\n```');

    const text = sections.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: songTitle || 'Song Workshop', text });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Fall through to clipboard
      }
    }

    if (copyToClipboard(text)) {
      toast.success('Summary copied to clipboard');
    } else {
      toast.error('Could not copy to clipboard — try selecting and copying manually');
    }
  }, [rewriteResult, chatMessages, songTitle, songArtist]);

  const titleArtistInputs = (withBlur?: boolean) => (
    <div className="flex flex-col gap-1 mb-2">
      <input
        className="text-xl font-bold border-0 border-b border-dashed border-border bg-transparent py-1 text-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground placeholder:font-normal"
        type="text"
        value={songTitle || ''}
        onChange={e => handleTitleChange(e.target.value)}
        onBlur={withBlur ? handleMetaBlur : undefined}
        placeholder="Song title"
        aria-label="Song title"
      />
      <input
        className="text-base border-0 border-b border-dashed border-border bg-transparent py-0.5 text-muted-foreground w-full focus:outline-none focus:border-primary placeholder:text-muted-foreground"
        type="text"
        value={songArtist || ''}
        onChange={e => handleArtistChange(e.target.value)}
        onBlur={withBlur ? handleMetaBlur : undefined}
        placeholder="Artist"
        aria-label="Artist"
      />
    </div>
  );

  // Shared model selector + effort controls
  const modelControls = (disabled?: boolean) => (
    <div className={cn('flex items-end gap-3 flex-wrap', disabled && 'opacity-50 pointer-events-none')}>
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
        <Select
          id="reasoning-effort"
          className="w-auto py-1.5 px-2 text-sm"
          value={reasoningEffort}
          disabled={disabled}
          onChange={e => onChangeReasoningEffort(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
      </div>
    </div>
  );

  // Mobile pane toggle
  const mobilePaneToggle = (
    <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-3">
      <button
        className={cn('flex-1 py-2 text-sm font-semibold text-center transition-colors', mobilePane === 'chat' ? 'bg-primary text-white' : 'bg-card text-muted-foreground')}
        onClick={() => setMobilePane('chat')}
      >
        Chat Workshop
      </button>
      <button
        className={cn('flex-1 py-2 text-sm font-semibold text-center transition-colors', mobilePane === 'content' ? 'bg-primary text-white' : 'bg-card text-muted-foreground')}
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
          <Button variant="ghost" size="sm" className="text-error-text p-1 leading-none" onClick={() => setError(null)}>
            &times;
          </Button>
        </Alert>
      )}

      {/* INPUT state */}
      {isInput && !loading && (
        <>
          {!isPremium && modelControls()}

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

              <Textarea
                rows={2}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="Optional instructions — e.g. &quot;only grab the first song&quot; or &quot;skip the intro&quot;"
                className="mt-3"
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
            <Spinner size="sm" />
            <span className="text-sm">{parseReasoningText ? 'Thinking...' : 'Parsing song...'}</span>
            <Button variant="danger-outline" size="sm" onClick={handleCancelParse}>Cancel</Button>
          </div>
          {parseReasoningText && !parseStreamText && (
            <StreamingPre className="px-4 pb-4 text-xs font-mono text-foreground max-h-[40vh] overflow-y-auto opacity-70">{parseReasoningText}</StreamingPre>
          )}
          {parseStreamText && (
            <pre className="px-4 pb-4 whitespace-pre-wrap break-words text-xs font-mono text-foreground max-h-[60vh] overflow-y-auto">{parseStreamText}</pre>
          )}
        </Card>
      )}

      {/* PARSED state */}
      {isParsed && (
        <div className="mt-2">
          {mobilePaneToggle}

          <ResizableColumns
            className={splitHeight}
            columnClassName="flex-col min-h-0"
            mobilePane={mobilePane === 'chat' ? 'left' : 'right'}
            left={
              <>
                {!isPremium && modelControls()}

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
                  onOriginalContentUpdated={handleOriginalContentUpdated}
                />
              </>
            }
            right={
              <>
                {titleArtistInputs()}

                {parseResult?.reasoning && (
                  <div className="mb-2">
                    <button
                      className="bg-transparent border-0 p-0 text-xs text-primary cursor-pointer underline opacity-80 hover:opacity-100"
                      onClick={() => setParseReasoningExpanded(prev => !prev)}
                    >
                      {parseReasoningExpanded ? 'Hide parse thinking' : 'Show parse thinking'}
                    </button>
                    {parseReasoningExpanded && (
                      <pre className="whitespace-pre-wrap break-words text-xs mt-1 font-mono max-h-60 overflow-y-auto opacity-70">{parseResult.reasoning}</pre>
                    )}
                  </div>
                )}

                <Card className="flex flex-col flex-1 overflow-hidden">
                  <Textarea
                    className="flex-1 min-h-[200px] border-0 p-3 sm:p-4 font-mono text-xs sm:text-code leading-relaxed resize-none focus-visible:ring-0"
                    value={parsedContent}
                    onChange={e => setParsedContent(e.target.value)}
                  />
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
            className={splitHeight}
            columnClassName="flex-col min-h-0"
            mobilePane={mobilePane === 'chat' ? 'left' : 'right'}
            left={
              <>
                {!isPremium && modelControls()}

                <div className="flex gap-2 mb-2 flex-wrap">
                  <Button variant="secondary" onClick={handleNewSong}>
                    New Song
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSave}
                    disabled={saveStatus === 'saving' || !currentSongId}
                  >
                    {saveStatus === 'saved' ? 'Saved!' :
                     saveStatus === 'saving' ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveAs}
                    disabled={saveStatus === 'saving' || !currentSongId}
                  >
                    Save As Copy
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleShare}
                  >
                    Share
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
                  onOriginalContentUpdated={handleOriginalContentUpdated}
                />
              </>
            }
            right={
              <>
                {titleArtistInputs(true)}

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
