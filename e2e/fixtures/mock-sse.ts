import type { Page, Route } from '@playwright/test';

/**
 * Build an SSE response body from a list of events.
 * Each event is { event: string, data: string | object }.
 */
export function buildSseBody(
  events: Array<{ event: string; data: string | object }>
): string {
  return events
    .map((e) => {
      const data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      return `event: ${e.event}\ndata: ${data}\n\n`;
    })
    .join('');
}

/** Build token events that stream text one chunk at a time. */
function tokenEvents(text: string, chunkSize = 20): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    events.push({ event: 'token', data: JSON.stringify(text.slice(i, i + chunkSize)) });
  }
  return events;
}

export interface ParseDonePayload {
  original_content: string;
  title: string | null;
  artist: string | null;
  reasoning: string | null;
}

export interface ChatDonePayload {
  rewritten_content: string | null;
  original_content: string | null;
  assistant_message: string;
  changes_summary: string;
  version: number;
  reasoning: string | null;
  usage: { input_tokens: number; output_tokens: number } | null;
}

/** Build a complete SSE body for a successful parse/stream response. */
export function mockParseStreamResponse(
  streamedText: string,
  done: ParseDonePayload,
  reasoning?: string
): string {
  const events: Array<{ event: string; data: string | object }> = [];
  if (reasoning) {
    events.push({ event: 'reasoning', data: JSON.stringify(reasoning) });
  }
  events.push(...tokenEvents(streamedText));
  events.push({ event: 'done', data: done });
  return buildSseBody(events);
}

/** Build a complete SSE body for a successful chat/stream response. */
export function mockChatStreamResponse(
  streamedText: string,
  done: ChatDonePayload,
  reasoning?: string
): string {
  const events: Array<{ event: string; data: string | object }> = [];
  if (reasoning) {
    events.push({ event: 'reasoning', data: JSON.stringify(reasoning) });
  }
  events.push(...tokenEvents(streamedText));
  events.push({ event: 'done', data: done });
  return buildSseBody(events);
}

/** Build an SSE body for an error response. */
export function mockSseError(detail: string): string {
  return buildSseBody([{ event: 'error', data: { detail } }]);
}

/** Fulfill an SSE route with the given body. */
async function fulfillSse(route: Route, body: string, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'text/event-stream',
    headers: {
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
    body,
  });
}

/**
 * Intercept parse/stream and chat/stream endpoints with mock SSE responses.
 * Returns functions to update the mock responses dynamically.
 */
export async function interceptLlmEndpoints(
  page: Page,
  opts: {
    parseBody?: string;
    chatBody?: string;
    parseStatus?: number;
    chatStatus?: number;
  } = {}
): Promise<void> {
  const { parseBody, chatBody, parseStatus = 200, chatStatus = 200 } = opts;

  if (parseBody !== undefined) {
    await page.route('**/api/parse/stream', async (route) => {
      await fulfillSse(route, parseBody, parseStatus);
    });
  }

  if (chatBody !== undefined) {
    await page.route('**/api/chat/stream', async (route) => {
      await fulfillSse(route, chatBody, chatStatus);
    });
  }
}

/** Intercept parse/stream to return a 429 quota exceeded error. */
export async function interceptParseWith429(page: Page): Promise<void> {
  await page.route('**/api/parse/stream', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Quota exceeded. Please upgrade your plan.' }),
    });
  });
}
