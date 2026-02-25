import { screen } from '@testing-library/react';
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
    expect(screen.queryByText('Open App')).not.toBeInTheDocument();
  });

  it('shows Open App button when logged in', () => {
    mockAuthState = 'ready';
    renderWithRouter(<MarketingLayout />);
    expect(screen.getByText('Open App')).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    renderWithRouter(<MarketingLayout />);
    expect(screen.getByText(/porchsongs. All rights reserved/)).toBeInTheDocument();
  });
});
