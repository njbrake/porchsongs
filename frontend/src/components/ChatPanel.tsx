import { useState, useRef, useEffect } from 'react';
import api from '@/api';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChatMessage, LlmSettings } from '@/types';

const MAX_MESSAGES = 20;

function ChatMessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = msg.role === 'assistant' && !msg.isNote && msg.rawContent && msg.rawContent !== msg.content;

  const bubbleClass = msg.isNote
    ? 'bg-warning-bg text-warning-text self-center text-xs italic'
    : msg.role === 'user'
      ? 'bg-primary text-white self-end rounded-br-sm'
      : 'bg-panel text-foreground self-start rounded-bl-sm';

  return (
    <div className={`px-3 py-2 rounded-md text-sm leading-normal max-w-[95%] sm:max-w-[85%] break-words ${bubbleClass}`}>
      {isStreaming ? (
        <pre className="whitespace-pre-wrap break-words text-xs m-0 font-[family-name:var(--font-mono)]">{msg.content}</pre>
      ) : expanded ? (
        <pre className="whitespace-pre-wrap break-words text-xs m-0 font-[family-name:var(--font-mono)] max-h-80 overflow-y-auto">{msg.rawContent}</pre>
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
  onLyricsUpdated: (lyrics: string) => void;
  initialLoading: boolean;
  onBeforeSend?: () => Promise<number>;
}

export default function ChatPanel({ songId, messages, setMessages, llmSettings, onLyricsUpdated, initialLoading, onBeforeSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

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

    try {
      const apiMessages = [{ role: 'user' as const, content: text }];

      const result = await api.chatStream(
        {
          song_id: effectiveSongId,
          messages: apiMessages,
          ...llmSettings,
        },
        (token: string) => {
          if (!streamStarted) {
            streamStarted = true;
            setStreaming(true);
            // Add the streaming bubble with the first token
            setMessages(prev => [...prev, { role: 'assistant' as const, content: token }].slice(-MAX_MESSAGES));
          } else {
            // Append token to the streaming bubble
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + token };
              }
              return updated;
            });
          }
        },
        controller.signal,
      );

      // Replace the streaming bubble with the final parsed result
      if (streamStarted) {
        setMessages(prev => {
          const updated = [...prev];
          const finalMsg: ChatMessage = {
            role: 'assistant',
            content: result.changes_summary,
            rawContent: result.assistant_message,
          };
          updated[updated.length - 1] = finalMsg;
          return updated;
        });
      } else {
        // No tokens were streamed (unlikely but handle it)
        const finalMsg: ChatMessage = {
          role: 'assistant',
          content: result.changes_summary,
          rawContent: result.assistant_message,
        };
        setMessages(prev => [...prev, finalMsg].slice(-MAX_MESSAGES));
      }
      onLyricsUpdated(result.rewritten_lyrics);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        const cancelMsg: ChatMessage = { role: 'assistant', content: 'Cancelled.' };
        setMessages(prev => [...prev, cancelMsg]);
      } else {
        const errorMsg: ChatMessage = { role: 'assistant', content: 'Error: ' + (err as Error).message };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      abortRef.current = null;
      setSending(false);
      setStreaming(false);
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
          <ChatMessageBubble key={i} msg={msg} isStreaming={streaming && i === messages.length - 1} />
        ))}
        {initialLoading && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
            <div className="size-6 border-3 border-border border-t-primary rounded-full animate-spin" aria-hidden="true" />
            <span>Parsing lyrics...</span>
          </div>
        )}
        {sending && !streaming && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
            <div className="size-6 border-3 border-border border-t-primary rounded-full animate-spin" aria-hidden="true" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-3 px-4 py-3 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tell the AI how to change the lyrics..."
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
