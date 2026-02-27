import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import { renderPremiumSettingsTab } from './settings';

const mockGetSubscription = vi.fn();
const mockListPlans = vi.fn();

vi.mock('./api', () => ({
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  listPlans: (...args: unknown[]) => mockListPlans(...args),
  createCheckout: vi.fn(),
  createPortal: vi.fn(),
  deleteAccount: vi.fn(),
}));

describe('AccountTab accessibility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('progress bar has role and aria-value attributes', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'free',
      rewrites_used: 5,
      rewrites_per_month: 10,
      stripe_customer_id: null,
    });
    mockListPlans.mockResolvedValue([
      { name: 'free', display_name: 'Free', price_cents: 0, rewrites_per_month: 10 },
    ]);

    renderWithRouter(<>{renderPremiumSettingsTab('account')}</>);

    await waitFor(() => {
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '5');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '10');
      expect(progressbar).toHaveAttribute('aria-label', '5 of 10 rewrites used');
    });
  });

  it('does not show progress bar for unlimited plan', async () => {
    mockGetSubscription.mockResolvedValue({
      plan: 'pro',
      rewrites_used: 50,
      rewrites_per_month: -1,
      stripe_customer_id: 'cus_123',
    });
    mockListPlans.mockResolvedValue([
      { name: 'pro', display_name: 'Pro', price_cents: 800, rewrites_per_month: -1 },
    ]);

    renderWithRouter(<>{renderPremiumSettingsTab('account')}</>);

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
