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
