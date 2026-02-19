import { render, screen } from '@testing-library/react';
import ChatPanel from './ChatPanel';

describe('ChatPanel', () => {
  const defaults = {
    songId: 1,
    messages: [],
    setMessages: vi.fn(),
    llmSettings: { provider: 'openai', model: 'gpt-4o' },
    originalLyrics: 'Some lyrics',
    onLyricsUpdated: vi.fn(),
    initialLoading: false,
  };

  it('renders the Chat Workshop header', () => {
    render(<ChatPanel {...defaults} />);
    expect(screen.getByText('Chat Workshop')).toBeInTheDocument();
  });

  it('renders the input and send button', () => {
    render(<ChatPanel {...defaults} />);
    expect(screen.getByPlaceholderText(/Tell the AI/)).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('disables input and send when initialLoading', () => {
    render(<ChatPanel {...defaults} initialLoading={true} />);
    expect(screen.getByPlaceholderText(/Tell the AI/)).toBeDisabled();
    expect(screen.getByText('Send')).toBeDisabled();
    expect(screen.getByText('Rewriting your lyrics...')).toBeInTheDocument();
  });

  it('renders chat messages', () => {
    const messages = [
      { role: 'user', content: 'Make it about dogs' },
      { role: 'assistant', content: 'Changed truck to retriever' },
    ];
    render(<ChatPanel {...defaults} messages={messages} />);
    expect(screen.getByText('Make it about dogs')).toBeInTheDocument();
    expect(screen.getByText('Changed truck to retriever')).toBeInTheDocument();
  });

  it('renders note-style messages differently', () => {
    const messages = [
      { role: 'user', content: 'Pasted lyrics...', isNote: true },
    ];
    render(<ChatPanel {...defaults} messages={messages} />);
    expect(screen.getByText('Pasted lyrics...')).toBeInTheDocument();
  });
});
