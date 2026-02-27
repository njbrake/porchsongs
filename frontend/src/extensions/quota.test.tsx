import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import { QuotaBanner, OnboardingBanner, isQuotaError } from './quota';

const mockGetSubscription = vi.fn();

vi.mock('./api', () => ({
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
}));

describe('QuotaBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows remaining rewrites for normal usage', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 3,
      rewrites_per_month: 10,
    });

    renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(screen.getByText(/7 of 10 rewrites remaining/)).toBeInTheDocument();
    });
  });

  it('shows warning when quota is low', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 8,
      rewrites_per_month: 10,
    });

    renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(screen.getByText(/2 rewrites remaining/)).toBeInTheDocument();
      expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });
  });

  it('shows warning icon for low quota', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 9,
      rewrites_per_month: 10,
    });

    const { container } = renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('shows exhausted message when limit reached', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 10,
      rewrites_per_month: 10,
    });

    renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Monthly rewrite limit reached/)).toBeInTheDocument();
      expect(screen.getByText('Upgrade')).toBeInTheDocument();
    });
  });

  it('shows warning icon for exhausted quota', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 10,
      rewrites_per_month: 10,
    });

    const { container } = renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('does not show icon for normal usage', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 3,
      rewrites_per_month: 10,
    });

    const { container } = renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(screen.getByText(/7 of 10/)).toBeInTheDocument();
    });

    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders nothing for unlimited plan', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'pro',
      rewrites_used: 50,
      rewrites_per_month: -1,
    });

    const { container } = renderWithRouter(<QuotaBanner />);

    // Wait a tick for the effect to resolve
    await waitFor(() => {
      expect(mockGetSubscription).toHaveBeenCalled();
    });

    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('renders nothing when API call fails', async () => {
    mockGetSubscription.mockRejectedValue(new Error('Network error'));

    const { container } = renderWithRouter(<QuotaBanner />);

    await waitFor(() => {
      expect(mockGetSubscription).toHaveBeenCalled();
    });

    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
  });
});

describe('isQuotaError', () => {
  it('returns true for quota exceeded messages', () => {
    expect(isQuotaError('Monthly rewrite limit reached. Upgrade your plan.')).toBe(true);
  });

  it('returns true for service at capacity messages', () => {
    expect(isQuotaError('Free tier is temporarily at capacity')).toBe(true);
  });

  it('returns true for quota_exceeded error code', () => {
    expect(isQuotaError('Error: quota_exceeded')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isQuotaError('Network timeout')).toBe(false);
    expect(isQuotaError('Internal server error')).toBe(false);
  });
});

describe('OnboardingBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows welcome guide on first visit', () => {
    renderWithRouter(<OnboardingBanner />);
    expect(screen.getByText('Welcome to porchsongs!')).toBeInTheDocument();
    expect(screen.getByText(/Paste your lyrics/)).toBeInTheDocument();
    expect(screen.getByText(/Hit Parse/)).toBeInTheDocument();
    expect(screen.getByText(/Refine with chat/)).toBeInTheDocument();
    expect(screen.getByText(/Save and export/)).toBeInTheDocument();
  });

  it('dismisses and does not show again', () => {
    const { unmount } = renderWithRouter(<OnboardingBanner />);
    expect(screen.getByText('Welcome to porchsongs!')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Got it/));
    expect(screen.queryByText('Welcome to porchsongs!')).not.toBeInTheDocument();
    expect(localStorage.getItem('porchsongs_onboarding_dismissed')).toBe('1');

    // Re-render — should not show
    unmount();
    renderWithRouter(<OnboardingBanner />);
    expect(screen.queryByText('Welcome to porchsongs!')).not.toBeInTheDocument();
  });

  it('does not show if previously dismissed', () => {
    localStorage.setItem('porchsongs_onboarding_dismissed', '1');
    renderWithRouter(<OnboardingBanner />);
    expect(screen.queryByText('Welcome to porchsongs!')).not.toBeInTheDocument();
  });
});
