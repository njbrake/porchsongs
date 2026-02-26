import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import NotFoundPage from '@/components/NotFoundPage';

describe('NotFoundPage', () => {
  it('renders 404 heading and message', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText(/doesn.t exist/)).toBeInTheDocument();
  });

  it('has a link to the app', () => {
    renderWithRouter(<NotFoundPage />);
    const link = screen.getByRole('link', { name: 'Go to app' });
    expect(link).toHaveAttribute('href', '/app');
  });
});
