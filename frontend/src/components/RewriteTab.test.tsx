import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RewriteTab from '@/components/RewriteTab';
import type { AppShellContext } from '@/layouts/AppShell';
import type { ChatMessage, SavedModel } from '@/types';

// Mock react-router-dom — provide useOutletContext
const mockOutletContext: Partial<AppShellContext> = {};
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useOutletContext: () => mockOutletContext };
});

// Mock api module
vi.mock('@/api', () => ({
  default: {
    parseStream: vi.fn(),
    getChatHistory: vi.fn().mockResolvedValue([]),
    saveSong: vi.fn(),
    updateSong: vi.fn(),
    deleteSong: vi.fn(),
  },
  STORAGE_KEYS: {
    DRAFT_INPUT: 'test_draft_input',
    DRAFT_INSTRUCTION: 'test_draft_instruction',
    SPLIT_PERCENT: 'test_split_pct',
    CURRENT_SONG_ID: 'test_current_song_id',
  },
}));

import api from '@/api';

function makeProps(overrides: Partial<AppShellContext> = {}): AppShellContext {
  return {
    profile: { id: 1, user_id: 'u1', display_name: 'Test', parse_prompt: '', chat_prompt: '' },
    llmSettings: { provider: 'openai', model: 'gpt-4o', reasoning_effort: 'high' },
    rewriteResult: null,
    rewriteMeta: null,
    currentSongId: null,
    chatMessages: [] as ChatMessage[],
    setChatMessages: vi.fn(),
    onNewRewrite: vi.fn(),
    onSongSaved: vi.fn(),
    onContentUpdated: vi.fn(),
    onChangeProvider: vi.fn(),
    onChangeModel: vi.fn(),
    reasoningEffort: 'high',
    onChangeReasoningEffort: vi.fn(),
    savedModels: [] as SavedModel[],
    onOpenSettings: vi.fn(),
    ...overrides,
  } as unknown as AppShellContext;
}

describe('RewriteTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('uses flex layout instead of hardcoded height in workshop mode', () => {
    // ResizableColumns uses window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const props = makeProps({
      rewriteResult: {
        original_content: 'Hello World',
        rewritten_content: '[G]Hello [C]World',
        changes_summary: 'Added chords',
      },
      rewriteMeta: { profile_id: 1, title: 'Test', artist: 'Artist' },
      currentSongId: 42,
    });

    const { container } = render(<RewriteTab {...props} />);

    // The outer wrapper should use flex layout to fill remaining viewport height
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain('flex-1');
    expect(outerDiv.className).toContain('min-h-0');
    expect(outerDiv.className).toContain('flex-col');

    // Should NOT contain any hardcoded calc(100dvh-...) heights
    expect(container.innerHTML).not.toMatch(/calc\(100dvh/);
  });

  it('does not use flex fill in input mode', () => {
    const props = makeProps();
    const { container } = render(<RewriteTab {...props} />);

    // In input mode, the outer wrapper should NOT use flex-1 layout
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).not.toContain('flex-1');
  });

  it('aborts in-flight parse when unmounted', async () => {
    const abortSpy = vi.fn();

    // parseStream returns a promise that never resolves (simulates in-flight stream)
    vi.mocked(api.parseStream).mockImplementation((_data, _onToken, signal) => {
      signal?.addEventListener('abort', abortSpy);
      return new Promise(() => {}); // never resolves
    });

    const props = makeProps();
    const { unmount } = render(<RewriteTab {...props} />);

    // Type some input so the Parse button is enabled
    const textarea = screen.getByPlaceholderText(/Paste your lyrics/);
    fireEvent.change(textarea, { target: { value: 'Some lyrics here' } });

    // Click Parse to start the streaming request
    const parseButton = screen.getByText('Parse');
    fireEvent.click(parseButton);

    // Verify parseStream was called
    await waitFor(() => {
      expect(api.parseStream).toHaveBeenCalledTimes(1);
    });

    // Unmount the component (simulates navigating away)
    unmount();

    // The abort signal should have fired
    expect(abortSpy).toHaveBeenCalled();
  });
});
