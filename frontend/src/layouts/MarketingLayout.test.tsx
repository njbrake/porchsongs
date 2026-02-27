import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '@/test/test-utils';
import MarketingLayout from '@/layouts/MarketingLayout';

let mockAuthState = 'login';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    authState: mockAuthState,
  }),
}));

describe('MarketingLayout', () => {
  beforeEach(() => {
    mockAuthState = 'login';
    localStorage.clear();
  });

  it('renders nav links', () => {
    renderWithRouter(<MarketingLayout />);
    // Nav and footer both contain these links, so expect 2 of each
    expect(screen.getAllByText('Home')).toHaveLength(2);
    expect(screen.getAllByText('Pricing')).toHaveLength(2);
    expect(screen.getAllByText('About')).toHaveLength(2);
    expect(screen.getAllByText('How-To')).toHaveLength(2);
  });

  it('shows Sign In button when not logged in', () => {
    mockAuthState = 'login';
    renderWithRouter(<MarketingLayout />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.queryByText('Go to Studio')).not.toBeInTheDocument();
  });

  it('shows Go to Studio button when logged in', () => {
    mockAuthState = 'ready';
    renderWithRouter(<MarketingLayout />);
    expect(screen.getByText('Go to Studio')).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    renderWithRouter(<MarketingLayout />);
    expect(screen.getByText(/porchsongs. All rights reserved/)).toBeInTheDocument();
  });

  it('renders hamburger button for mobile', () => {
    renderWithRouter(<MarketingLayout />);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('toggles mobile menu on hamburger click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MarketingLayout />);

    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();

    await user.click(button);
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    // All 4 nav links should appear in the mobile menu (plus desktop nav + footer = 3 each)
    expect(screen.getAllByText('Pricing')).toHaveLength(3);

    // Button label should change
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    // Close menu
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });

  it('hamburger button has aria-controls linking to mobile menu', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MarketingLayout />);

    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-controls', 'mobile-nav');

    await user.click(button);
    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(nav).toHaveAttribute('id', 'mobile-nav');
  });
});
