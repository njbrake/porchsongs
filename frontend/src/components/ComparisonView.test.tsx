import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComparisonView from '@/components/ComparisonView';

describe('ComparisonView', () => {
  const defaults = {
    original: 'Original content here',
    rewritten: 'Rewritten content here',
    onRewrittenChange: vi.fn(),
    onRewrittenBlur: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the rewritten content in a textarea', () => {
    render(<ComparisonView {...defaults} />);
    const textarea = screen.getByDisplayValue('Rewritten content here');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('shows "Your Version" header', () => {
    render(<ComparisonView {...defaults} />);
    expect(screen.getByText('Your Version')).toBeInTheDocument();
  });

  it('does not show original content by default', () => {
    render(<ComparisonView {...defaults} />);
    expect(screen.queryByText('Original content here')).not.toBeInTheDocument();
  });

  it('shows original content in a dialog after clicking "Show Original"', async () => {
    const user = userEvent.setup();
    render(<ComparisonView {...defaults} />);
    await user.click(screen.getByText('Show Original'));
    expect(screen.getByText('Original content here')).toBeInTheDocument();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('hides original content when dialog is dismissed', async () => {
    const user = userEvent.setup();
    render(<ComparisonView {...defaults} />);
    await user.click(screen.getByText('Show Original'));
    expect(screen.getByText('Original content here')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Original content here')).not.toBeInTheDocument();
  });

  it('textarea background does not change on focus', () => {
    render(<ComparisonView {...defaults} />);
    const textarea = screen.getByDisplayValue('Rewritten content here');
    expect(textarea.className).not.toContain('focus:bg-focus-bg');
  });

  it('calls onRewrittenChange when textarea content changes', async () => {
    const user = userEvent.setup();
    render(<ComparisonView {...defaults} />);
    const textarea = screen.getByDisplayValue('Rewritten content here');
    await user.type(textarea, '!');
    expect(defaults.onRewrittenChange).toHaveBeenCalled();
  });
});
