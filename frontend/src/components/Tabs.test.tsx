import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import Tabs from '@/components/Tabs';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isPremium: false }),
}));

describe('Tabs', () => {
  it('renders all three tab labels', () => {
    renderWithRouter(<Tabs />, { route: '/app/rewrite' });
    expect(screen.getByText('Rewrite')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the active tab based on URL', () => {
    renderWithRouter(<Tabs />, { route: '/app/library' });
    const libraryTab = screen.getByText('Library');
    expect(libraryTab).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Rewrite')).toHaveAttribute('data-state', 'inactive');
  });

  it('defaults to rewrite tab for unknown paths', () => {
    renderWithRouter(<Tabs />, { route: '/app/unknown' });
    expect(screen.getByText('Rewrite')).toHaveAttribute('data-state', 'active');
  });
});
