import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs from './Tabs';

describe('Tabs', () => {
  it('renders all three tab labels', () => {
    render(<Tabs active="rewrite" onChange={vi.fn()} />);
    expect(screen.getByText('Rewrite')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the active tab', () => {
    render(<Tabs active="library" onChange={vi.fn()} />);
    const libraryTab = screen.getByText('Library');
    expect(libraryTab).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Rewrite')).toHaveAttribute('data-state', 'inactive');
  });

  it('calls onChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs active="rewrite" onChange={onChange} />);
    await user.click(screen.getByText('Library'));
    expect(onChange).toHaveBeenCalledWith('library');
  });
});
