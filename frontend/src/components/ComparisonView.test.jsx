import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComparisonView from './ComparisonView';

describe('ComparisonView', () => {
  const defaults = {
    original: 'Original lyrics here',
    rewritten: 'Rewritten lyrics here',
    onRewrittenChange: vi.fn(),
    onRewrittenBlur: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the rewritten lyrics in a textarea', () => {
    render(<ComparisonView {...defaults} />);
    const textarea = screen.getByDisplayValue('Rewritten lyrics here');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('shows "Your Version" header', () => {
    render(<ComparisonView {...defaults} />);
    expect(screen.getByText('Your Version')).toBeInTheDocument();
  });

  it('does not show original lyrics by default', () => {
    render(<ComparisonView {...defaults} />);
    expect(screen.queryByText('Original lyrics here')).not.toBeInTheDocument();
  });

  it('shows original lyrics after clicking "Show Original"', async () => {
    const user = userEvent.setup();
    render(<ComparisonView {...defaults} />);
    await user.click(screen.getByText('Show Original'));
    expect(screen.getByText('Original lyrics here')).toBeInTheDocument();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('hides original lyrics when toggled back', async () => {
    const user = userEvent.setup();
    render(<ComparisonView {...defaults} />);
    await user.click(screen.getByText('Show Original'));
    expect(screen.getByText('Original lyrics here')).toBeInTheDocument();
    await user.click(screen.getByText('Hide Original'));
    expect(screen.queryByText('Original lyrics here')).not.toBeInTheDocument();
  });

  it('calls onRewrittenChange when textarea content changes', async () => {
    const user = userEvent.setup();
    render(<ComparisonView {...defaults} />);
    const textarea = screen.getByDisplayValue('Rewritten lyrics here');
    await user.type(textarea, '!');
    expect(defaults.onRewrittenChange).toHaveBeenCalled();
  });
});
