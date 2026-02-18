import { useState, useRef, useEffect } from 'react';
import api from '../api';

const MAX_MESSAGES = 20;

function ChatMessage({ msg }) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = msg.role === 'assistant' && !msg.isNote && msg.rawContent && msg.rawContent !== msg.content;

  return (
    <div className={`chat-msg ${msg.isNote ? 'chat-msg-note' : `chat-msg-${msg.role}`}`}>
      {expanded ? (
        <pre className="chat-raw-content">{msg.rawContent}</pre>
      ) : (
        msg.content
      )}
      {hasRaw && (
        <button
          className="chat-toggle-raw"
          onClick={() => setExpanded(prev => !prev)}
        >
          {expanded ? 'Show summary' : 'Show full response'}
        </button>
      )}
    </div>
  );
}

export default function ChatPanel({ songId, messages, setMessages, llmSettings, originalLyrics, onLyricsUpdated, initialLoading }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !songId || sending) return;

    setInput('');
    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(updated);

    setSending(true);
    try {
      // Send only role/content pairs (strip isNote)
      const apiMessages = updated
        .filter(m => !m.isNote)
        .map(m => ({ role: m.role, content: m.content }));

      const result = await api.chat({
        song_id: songId,
        messages: apiMessages,
        ...llmSettings,
      });

      const assistantMsg = {
        role: 'assistant',
        content: result.changes_summary,
        rawContent: result.assistant_message,
      };
      setMessages(prev => [...prev, assistantMsg].slice(-MAX_MESSAGES));
      onLyricsUpdated(result.rewritten_lyrics);

      // Persist the new messages (backend also saves, but this covers the frontend view)
      // The backend chat handler already persists these, so no extra call needed here
    } catch (err) {
      const errorMsg = { role: 'assistant', content: 'Error: ' + err.message };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>Chat Workshop</h3>
      </div>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}
        {initialLoading && (
          <div className="chat-typing">
            <div className="spinner" />
            <span>Rewriting your lyrics...</span>
          </div>
        )}
        {sending && (
          <div className="chat-typing">
            <div className="spinner" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
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
        />
        <button className="btn primary" onClick={handleSend} disabled={sending || initialLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
