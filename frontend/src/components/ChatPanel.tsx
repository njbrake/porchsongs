import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import api from '@/api';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import StreamingPre from '@/components/ui/streaming-pre';
import { StreamParser } from '@/lib/streamParser';
import type { ChatMessage, LlmSettings } from '@/types';

const MAX_MESSAGES = 20;

function ChatMessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const hasRaw = msg.role === 'assistant' && !msg.isNote && msg.rawContent && msg.rawContent !== msg.content;
  const hasReasoning = msg.role === 'assistant' && !msg.isNote && !!msg.reasoning;

  const bubbleClass = msg.isNote
    ? 'bg-warning-bg text-warning-text self-center text-xs italic'
    : msg.role === 'user'
      ? 'bg-primary text-white self-end rounded-br-sm'
      : 'bg-panel text-foreground self-start rounded-bl-sm';

  return (
    <div className={cn('px-3 py-2 rounded-md text-sm leading-normal max-w-[95%] sm:max-w-[85%] break-words', bubbleClass)}>
      {hasReasoning && (
        <>
          <button
            className="block mb-1.5 bg-transparent border-0 p-0 text-xs text-primary cursor-pointer underline opacity-80 hover:opacity-100"
            onClick={() => setThinkingExpanded(prev => !prev)}
          >
            {thinkingExpanded ? 'Hide thinking' : 'Show thinking'}
          </button>
          {thinkingExpanded && (
            <pre className="whitespace-pre-wrap break-words text-xs m-0 mb-2 font-mono max-h-80 overflow-y-auto opacity-70">{msg.reasoning}</pre>
          )}
        </>
      )}
      {isStreaming ? (
        <pre className="whitespace-pre-wrap break-words text-xs m-0 font-mono">{msg.content}</pre>
      ) : expanded ? (
        <pre className="whitespace-pre-wrap break-words text-xs m-0 font-mono max-h-80 overflow-y-auto">{msg.rawContent}</pre>
      ) : (
        msg.content
      )}
      {hasRaw && !isStreaming && (
        <button
          className="block mt-1.5 bg-transparent border-0 p-0 text-xs text-primary cursor-pointer underline opacity-80 hover:opacity-100"
          onClick={() => setExpanded(prev => !prev)}
        >
          {expanded ? 'Show summary' : 'Show full response'}
        </button>
      )}
    </div>
  );
}

interface ChatPanelProps {
  songId: number | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  llmSettings: LlmSettings;
  onContentUpdated: (content: string) => void;
  initialLoading: boolean;
  onBeforeSend?: () => Promise<number>;
  onContentStreaming?: (partialContent: string) => void;
  onOriginalContentUpdated?: (content: string) => void;
}

export default function ChatPanel({ songId, messages, setMessages, llmSettings, onContentUpdated, initialLoading, onBeforeSend, onContentStreaming, onOriginalContentUpdated }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [reasoningText, setReasoningText] = useState('');
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reasoningText]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRetry = () => {
    if (!lastFailedInput) return;
    // Remove the error message and the user message that caused it
    setMessages(prev => {
      const updated = [...prev];
      // Remove trailing error bubble
      if (updated.length > 0 && updated[updated.length - 1]?.role === 'assistant') {
        updated.pop();
      }
      // Remove the failed user message
      if (updated.length > 0 && updated[updated.length - 1]?.role === 'user') {
        updated.pop();
      }
      return updated;
    });
    setInput(lastFailedInput);
    setLastFailedInput(null);
    // Trigger send on next tick after state settles
    retryPendingRef.current = true;
  };

  const retryPendingRef = useRef(false);
  useEffect(() => {
    if (retryPendingRef.current && input.trim() && !sending) {
      retryPendingRef.current = false;
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    let effectiveSongId = songId;
    if (!effectiveSongId && onBeforeSend) {
      setInput('');
      const userMsg: ChatMessage = { role: 'user', content: text };
      setMessages(prev => [...prev, userMsg].slice(-MAX_MESSAGES));
      setSending(true);
      try {
        effectiveSongId = await onBeforeSend();
      } catch (err) {
        const errorMsg: ChatMessage = { role: 'assistant', content: 'Error: ' + (err as Error).message };
        setMessages(prev => [...prev, errorMsg]);
        setSending(false);
        return;
      }
    } else {
      setInput('');
      const userMsg: ChatMessage = { role: 'user', content: text };
      setMessages(prev => [...prev, userMsg].slice(-MAX_MESSAGES));
    }
    if (!effectiveSongId) return;

    const controller = new AbortController();
    abortRef.current = controller;
    if (!sending) setSending(true);
    let streamStarted = false;
    const parser = new StreamParser();
    let reasoningAccumulated = '';
    setReasoningText('');

    try {
      const apiMessages = [{ role: 'user' as const, content: text }];

      const result = await api.chatStream(
        {
          song_id: effectiveSongId,
          messages: apiMessages,
          ...llmSettings,
        },
        (token: string) => {
          const { contentDelta, originalSongDelta } = parser.processToken(token);

          if (contentDelta && onContentStreaming) {
            onContentStreaming(parser.contentText);
          }

          if (originalSongDelta && onOriginalContentUpdated) {
            onOriginalContentUpdated(parser.originalSongText);
          }

          // Determine what to show in the chat bubble
          const isInTag = (parser.phase === 'content' || parser.phase === 'original_song') && !parser.chatText;
          const bubbleContent = isInTag
            ? 'Updating song...'
            : parser.chatText || 'Updating song...';

          if (!streamStarted) {
            streamStarted = true;
            setStreaming(true);
            setMessages(prev => [...prev, { role: 'assistant' as const, content: bubbleContent }].slice(-MAX_MESSAGES));
          } else {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: bubbleContent };
              }
              return updated;
            });
          }
        },
        controller.signal,
        (reasoningToken: string) => {
          reasoningAccumulated += reasoningToken;
          setReasoningText(reasoningAccumulated);
        },
      );

      // Replace the streaming bubble with the final parsed result
      const reasoning = (result.reasoning ?? reasoningAccumulated) || undefined;
      const hasContent = result.rewritten_content !== null;
      const finalMsg: ChatMessage = hasContent
        ? { role: 'assistant', content: result.changes_summary, rawContent: result.assistant_message, reasoning }
        : { role: 'assistant', content: result.assistant_message, reasoning };
      if (streamStarted) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = finalMsg;
          return updated;
        });
      } else {
        // No tokens were streamed (unlikely but handle it)
        setMessages(prev => [...prev, finalMsg].slice(-MAX_MESSAGES));
      }
      if (result.rewritten_content !== null) {
        onContentUpdated(result.rewritten_content);
      }
      if (result.original_content && onOriginalContentUpdated) {
        onOriginalContentUpdated(result.original_content);
      }
      setLastFailedInput(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        const cancelMsg: ChatMessage = { role: 'assistant', content: 'Cancelled.' };
        setMessages(prev => [...prev, cancelMsg]);
      } else {
        setLastFailedInput(text);
        const errorMsg: ChatMessage = { role: 'assistant', content: 'Error: ' + (err as Error).message };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      abortRef.current = null;
      setSending(false);
      setStreaming(false);
      setReasoningText('');
    }
  };

  return (
    <Card className="mt-0 flex flex-col flex-1 overflow-hidden">
      <CardHeader>Chat Workshop</CardHeader>
      {messages.length >= MAX_MESSAGES && (
        <div className="px-4 py-2 bg-warning-bg border-b border-warning-border text-warning-text text-xs">
          Chat history limit reached ({MAX_MESSAGES} messages). Older messages will be dropped.
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <ChatMessageBubble msg={msg} isStreaming={streaming && i === messages.length - 1} />
            {lastFailedInput && i === messages.length - 1 && msg.role === 'assistant' && msg.content.startsWith('Error:') && (
              <Button variant="secondary" size="sm" className="mt-1" onClick={handleRetry}>
                Retry
              </Button>
            )}
          </div>
        ))}
        {initialLoading && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
            <Spinner size="sm" />
            <span>Parsing song...</span>
          </div>
        )}
        {sending && !streaming && (
          <div className="py-2 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span>Thinking...</span>
            </div>
            {reasoningText && (
              <StreamingPre className="text-xs mt-2 ml-6 font-mono max-h-40 overflow-y-auto opacity-70">{reasoningText}</StreamingPre>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-3 px-4 py-3 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tell the AI how to change the song..."
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending || initialLoading}
          className="flex-1"
        />
        {sending ? (
          <Button variant="danger-outline" onClick={handleCancel}>
            Cancel
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={initialLoading || !input.trim() || (!songId && !onBeforeSend)}>
            Send
          </Button>
        )}
      </div>
    </Card>
  );
}
