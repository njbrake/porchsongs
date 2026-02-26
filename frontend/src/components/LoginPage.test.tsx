import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '@/test/test-utils';
import LoginPage from '@/components/LoginPage';

vi.mock('@/api', () => ({
  default: {
    login: vi.fn(),
  },
}));

const mockHandleLogin = vi.fn();
let mockAuthConfig: { method: string; required: boolean } = { method: 'password', required: true };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    authConfig: mockAuthConfig,
    handleLogin: mockHandleLogin,
  }),
}));

import api from '@/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthConfig = { method: 'password', required: true };
  });

  it('renders the login form', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByText('porchsongs')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  it('disables submit button when password is empty', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByText('Log In')).toBeDisabled();
  });

  it('calls api.login and handleLogin on successful submit', async () => {
    const user = userEvent.setup();
    const mockUser = { id: 1, email: 'local@porchsongs.local', name: 'Local User', role: 'admin', is_active: true, created_at: '' };
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({ access_token: 'jwt', refresh_token: 'rt', user: mockUser });

    renderWithRouter(<LoginPage />);
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.click(screen.getByText('Log In'));

    expect(api.login).toHaveBeenCalledWith('secret');
    expect(mockHandleLogin).toHaveBeenCalledWith(mockUser);
  });

  it('shows error on failed login', async () => {
    const user = userEvent.setup();
    (api.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Bad password'));

    renderWithRouter(<LoginPage />);
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByText('Log In'));

    expect(screen.getByText('Wrong password. Please try again.')).toBeInTheDocument();
  });

  it('renders OAuth login with back-to-homepage link', () => {
    mockAuthConfig = { method: 'oauth_google', required: true };
    renderWithRouter(<LoginPage />);
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    const link = screen.getByText('Back to homepage');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('does not show back-to-homepage link for password login', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.queryByText('Back to homepage')).not.toBeInTheDocument();
  });
});
