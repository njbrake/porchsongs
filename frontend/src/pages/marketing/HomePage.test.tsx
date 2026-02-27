import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import HomePage from '@/pages/marketing/HomePage';

describe('HomePage', () => {
  it('renders the hero heading', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('Make every song yours')).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText(/Smart Rewriting/)).toBeInTheDocument();
    expect(screen.getByText(/Iterative Chat/)).toBeInTheDocument();
    expect(screen.getByText(/Song Library/)).toBeInTheDocument();
  });

  it('renders CTA links', () => {
    renderWithRouter(<HomePage />);
    // "Get Started Free" appears in hero and bottom CTA
    expect(screen.getAllByText('Get Started Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('View Pricing')).toBeInTheDocument();
  });

  it('renders demo GIF image', () => {
    renderWithRouter(<HomePage />);
    const img = screen.getByAltText('porchsongs demo showing song rewriting');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/porchsongs-demo.gif');
  });
});
