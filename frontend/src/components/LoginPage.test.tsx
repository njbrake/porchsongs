import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '@/test/test-utils';
import LoginPage from '@/components/LoginPage';

vi.mock('@/api', () => ({
  default: {
    login: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    authConfig: { method: 'password', required: true },
    handleLogin: mockHandleLogin,
  }),
}));

const mockHandleLogin = vi.fn();

import api from '@/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
});
