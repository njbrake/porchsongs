import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import HomePage from '@/pages/marketing/HomePage';

describe('HomePage', () => {
  it('renders the hero heading and subtext', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('Make every song yours')).toBeInTheDocument();
    expect(screen.getByText(/your voice, your family, and your style/)).toBeInTheDocument();
    expect(screen.getByText(/anyone who plays at home/)).toBeInTheDocument();
  });

  it('renders how-it-works feature cards', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText('Smart Rewriting')).toBeInTheDocument();
    expect(screen.getByText('Iterative Chat')).toBeInTheDocument();
    expect(screen.getByText('Song Library')).toBeInTheDocument();
  });

  it('renders CTA links', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByText('Get Started Free')).toBeInTheDocument();
    expect(screen.getByText('View Pricing')).toBeInTheDocument();
  });

  it('renders demo video', () => {
    renderWithRouter(<HomePage />);
    const video = document.querySelector('video[aria-label="porchsongs demo showing song rewriting"]');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', '/porchsongs-demo.mp4');
  });
});
