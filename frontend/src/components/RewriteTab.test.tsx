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
  },
  STORAGE_KEYS: {
    DRAFT_INPUT: 'test_draft_input',
    DRAFT_INSTRUCTION: 'test_draft_instruction',
    SPLIT_PERCENT: 'test_split_pct',
    CURRENT_SONG_ID: 'test_current_song_id',
  },
}));

// Mock heavy child components to isolate RewriteTab layout tests
vi.mock('@/components/ChatPanel', () => ({ default: () => <div data-testid="chat-panel" /> }));
vi.mock('@/components/ComparisonView', () => ({ default: () => <div data-testid="comparison-view" /> }));
vi.mock('@/components/ui/resizable-columns', () => ({
  default: ({ className, left, right }: { className?: string; left?: React.ReactNode; right?: React.ReactNode }) => (
    <div data-testid="resizable-columns" className={className}>
      {left}
      {right}
    </div>
  ),
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

  it('uses flex layout instead of hardcoded viewport-height offset in workshopping state', () => {
    const props = makeProps({
      rewriteResult: {
        original_content: '[C]Hello [G]World',
        rewritten_content: '[C]Hello [G]World',
        changes_summary: 'No changes',
      },
      rewriteMeta: { title: 'Test', artist: 'Test' },
      currentSongId: 1,
    });
    const { container } = render(<RewriteTab {...props} />);

    // No element should use a calc-based viewport height (the old fragile pattern)
    const allElements = container.querySelectorAll('*');
    for (const el of allElements) {
      expect(el.className).not.toMatch(/calc\(100dvh/);
    }

    // The ResizableColumns container should use flex-1 to fill remaining space
    const resizable = screen.getByTestId('resizable-columns');
    expect(resizable.className).toContain('flex-1');
  });

  it('collapses Scrap into overflow menu on mobile in workshopping state', () => {
    const props = makeProps({
      rewriteResult: {
        original_content: '[C]Hello [G]World',
        rewritten_content: '[C]Hello [G]World',
        changes_summary: 'No changes',
      },
      rewriteMeta: { title: 'Test', artist: 'Test' },
      currentSongId: 1,
    });
    render(<RewriteTab {...props} />);

    // "New Song" and "Save" should be always-visible buttons (no hidden class)
    const newSongBtn = screen.getByRole('button', { name: 'New Song' });
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(newSongBtn.className).not.toContain('hidden');
    expect(saveBtn.className).not.toContain('hidden');

    // "Scrap This" button should be hidden on mobile (have hidden md:inline-flex)
    const scrapBtn = screen.getByRole('button', { name: 'Scrap This' });
    expect(scrapBtn.className).toContain('hidden');
    expect(scrapBtn.className).toContain('md:inline-flex');

    // A mobile overflow trigger ("More actions") should exist with md:hidden
    const overflowTrigger = screen.getByRole('button', { name: 'More actions' });
    expect(overflowTrigger.className).toContain('md:hidden');
  });
});
