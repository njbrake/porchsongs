import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/components/LoginPage';

vi.mock('@/api', () => ({
  default: {
    login: vi.fn(),
  },
}));

import api from '@/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the login form', () => {
    render(<LoginPage onLogin={vi.fn()} />);
    expect(screen.getByText('porchsongs')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  it('disables submit button when password is empty', () => {
    render(<LoginPage onLogin={vi.fn()} />);
    expect(screen.getByText('Log In')).toBeDisabled();
  });

  it('calls api.login and onLogin on successful submit', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    (api.login as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'abc123' });

    render(<LoginPage onLogin={onLogin} />);
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.click(screen.getByText('Log In'));

    expect(api.login).toHaveBeenCalledWith('secret');
    expect(onLogin).toHaveBeenCalledOnce();
    expect(localStorage.getItem('porchsongs_app_secret')).toBe('abc123');
  });

  it('shows error on failed login', async () => {
    const user = userEvent.setup();
    (api.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Bad password'));

    render(<LoginPage onLogin={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByText('Log In'));

    expect(screen.getByText('Wrong password. Please try again.')).toBeInTheDocument();
  });
});
