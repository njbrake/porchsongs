import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '@/api';
import type { ChatMessage, ChatHistoryRow, RewriteResult, Song } from '@/types';
import { stripXmlTags } from '@/lib/utils';

/** Delay (ms) after tab becomes visible before re-fetching, giving the
 *  backend time to finish persisting if the LLM call was still running. */
const RECOVERY_DELAY_MS = 2500;

function chatHistoryToMessages(rows: ChatHistoryRow[]): ChatMessage[] {
  return rows.map(row => {
    const role = row.role as 'user' | 'assistant';
    if (role === 'assistant' && !row.is_note) {
      const stripped = stripXmlTags(row.content);
      const hadXml = stripped !== row.content;
      return {
        role,
        content: hadXml ? (stripped || 'Chat edit applied.') : stripped,
        rawContent: hadXml ? row.content : undefined,
        isNote: row.is_note,
        reasoning: row.reasoning ?? undefined,
        model: row.model ?? undefined,
      };
    }
    return { role, content: row.content, isNote: row.is_note };
  });
}

interface RecoveryDeps {
  songUuid: string | null;
  /** True while the chat or parse SSE stream is actively running. */
  isStreaming: boolean;
  setRewriteResult: React.Dispatch<React.SetStateAction<RewriteResult | null>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

/**
 * Re-syncs song content and chat history from the backend when the browser
 * tab becomes visible again after being hidden during an active stream.
 *
 * This handles mobile browsers suspending tabs mid-generation: the backend
 * continues the LLM call and persists the result, and this hook picks it up
 * when the user returns.
 */
export default function useVisibilityRecovery({
  songUuid,
  isStreaming,
  setRewriteResult,
  setChatMessages,
}: RecoveryDeps): void {
  // Track whether a stream was active when the tab was hidden.
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasStreamingRef.current = isStreaming;
      } else if (document.visibilityState === 'visible' && wasStreamingRef.current) {
        wasStreamingRef.current = false;

        if (!songUuid) return;
        const uuid = songUuid;

        // Wait for the backend to finish persisting, then re-fetch.
        const timer = setTimeout(async () => {
          try {
            const [song, history]: [Song, ChatHistoryRow[]] = await Promise.all([
              api.getSong(uuid),
              api.getChatHistory(uuid),
            ]);
            setRewriteResult(prev => {
              // Only update if the song actually changed (backend persisted
              // a new version while we were away).
              if (
                prev &&
                prev.rewritten_content === song.rewritten_content &&
                prev.original_content === song.original_content
              ) {
                return prev;
              }
              return {
                original_content: song.original_content,
                rewritten_content: song.rewritten_content,
                changes_summary: song.changes_summary || '',
              };
            });
            setChatMessages(chatHistoryToMessages(history));
            toast.info('Restored latest changes');
          } catch {
            // Silently ignore — the user can manually refresh.
          }
        }, RECOVERY_DELAY_MS);

        return () => clearTimeout(timer);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [songUuid, isStreaming, setRewriteResult, setChatMessages]);
}
