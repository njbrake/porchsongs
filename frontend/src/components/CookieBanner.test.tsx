import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import CookieBanner from '@/components/CookieBanner';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the banner when not previously acknowledged', () => {
    renderWithRouter(<CookieBanner />);
    expect(screen.getByText(/essential cookies only/)).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('hides the banner after clicking "Got it"', () => {
    renderWithRouter(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/essential cookies only/)).not.toBeInTheDocument();
    expect(localStorage.getItem('porchsongs_cookie_acknowledged')).toBe('1');
  });

  it('does not show the banner if previously acknowledged', () => {
    localStorage.setItem('porchsongs_cookie_acknowledged', '1');
    renderWithRouter(<CookieBanner />);
    expect(screen.queryByText(/essential cookies only/)).not.toBeInTheDocument();
  });

  it('links to the privacy policy page', () => {
    renderWithRouter(<CookieBanner />);
    const link = screen.getByText('Privacy Policy');
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('dismiss button has focus-visible ring classes', () => {
    renderWithRouter(<CookieBanner />);
    const btn = screen.getByRole('button', { name: 'Got it' });
    expect(btn.className).toContain('focus-visible:ring-2');
  });
});
