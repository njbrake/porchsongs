import { useState, useRef, useEffect } from 'react';
import api from '@/api';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChatMessage, LlmSettings } from '@/types';

const MAX_MESSAGES = 20;

function ChatMessageBubble({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = msg.role === 'assistant' && !msg.isNote && msg.rawContent && msg.rawContent !== msg.content;

  const bubbleClass = msg.isNote
    ? 'bg-warning-bg text-warning-text self-center text-xs italic'
    : msg.role === 'user'
      ? 'bg-primary text-white self-end rounded-br-sm'
      : 'bg-panel text-foreground self-start rounded-bl-sm';

  return (
    <div className={`px-3 py-2 rounded-md text-sm leading-normal max-w-[95%] sm:max-w-[85%] break-words ${bubbleClass}`}>
      {expanded ? (
        <pre className="whitespace-pre-wrap break-words text-xs m-0 font-[family-name:var(--font-mono)] max-h-80 overflow-y-auto">{msg.rawContent}</pre>
      ) : (
        msg.content
      )}
      {hasRaw && (
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
  originalLyrics: string;
  onLyricsUpdated: (lyrics: string) => void;
  initialLoading: boolean;
}

export default function ChatPanel({ songId, messages, setMessages, llmSettings, originalLyrics: _originalLyrics, onLyricsUpdated, initialLoading }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !songId || sending) return;

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(updated);

    setSending(true);
    try {
      const apiMessages = updated
        .filter(m => !m.isNote)
        .map(m => ({ role: m.role, content: m.content }));

      const result = await api.chat({
        song_id: songId,
        messages: apiMessages,
        ...llmSettings,
      });

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.changes_summary,
        rawContent: result.assistant_message,
      };
      setMessages(prev => [...prev, assistantMsg].slice(-MAX_MESSAGES));
      onLyricsUpdated(result.rewritten_lyrics);
    } catch (err) {
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Error: ' + (err as Error).message };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mt-0 flex flex-col flex-1 overflow-hidden">
      <CardHeader>Chat Workshop</CardHeader>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.map((msg, i) => (
          <ChatMessageBubble key={i} msg={msg} />
        ))}
        {initialLoading && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
            <div className="size-6 border-3 border-border border-t-primary rounded-full animate-spin" />
            <span>Rewriting your lyrics...</span>
          </div>
        )}
        {sending && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
            <div className="size-6 border-3 border-border border-t-primary rounded-full animate-spin" />
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
        <Button onClick={handleSend} disabled={sending || initialLoading || !input.trim()}>
          Send
        </Button>
      </div>
    </Card>
  );
}
