import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/components/LoginPage';

vi.mock('@/api', () => ({
  default: {
    login: vi.fn(),
  },
}));

import api from '@/api';

const defaultAuthConfig = { method: 'password' as const, required: true };

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the login form', () => {
    render(<LoginPage authConfig={defaultAuthConfig} onLogin={vi.fn()} />);
    expect(screen.getByText('porchsongs')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  it('disables submit button when password is empty', () => {
    render(<LoginPage authConfig={defaultAuthConfig} onLogin={vi.fn()} />);
    expect(screen.getByText('Log In')).toBeDisabled();
  });

  it('calls api.login and onLogin on successful submit', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    const mockUser = { id: 1, email: 'local@porchsongs.local', name: 'Local User', role: 'admin', is_active: true, created_at: '' };
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({ access_token: 'jwt', refresh_token: 'rt', user: mockUser });

    render(<LoginPage authConfig={defaultAuthConfig} onLogin={onLogin} />);
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.click(screen.getByText('Log In'));

    expect(api.login).toHaveBeenCalledWith('secret');
    expect(onLogin).toHaveBeenCalledWith(mockUser);
  });

  it('shows error on failed login', async () => {
    const user = userEvent.setup();
    (api.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Bad password'));

    render(<LoginPage authConfig={defaultAuthConfig} onLogin={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByText('Log In'));

    expect(screen.getByText('Wrong password. Please try again.')).toBeInTheDocument();
  });
});
