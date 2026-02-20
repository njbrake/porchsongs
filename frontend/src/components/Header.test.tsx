import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '@/components/Header';

describe('Header', () => {
  const defaults = {
    onHomeClick: vi.fn(),
    user: null,
    authRequired: false,
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app name and tagline', () => {
    render(<Header {...defaults} />);
    expect(screen.getByText('porchsongs')).toBeInTheDocument();
    expect(screen.getByText('Make every song yours')).toBeInTheDocument();
  });

  it('calls onHomeClick when logo is clicked', async () => {
    const user = userEvent.setup();
    render(<Header {...defaults} />);
    await user.click(screen.getByText('porchsongs'));
    expect(defaults.onHomeClick).toHaveBeenCalledOnce();
  });

  it('shows logout button when auth is required', () => {
    render(<Header {...defaults} authRequired={true} />);
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('hides logout button when auth is not required', () => {
    render(<Header {...defaults} authRequired={false} />);
    expect(screen.queryByText('Log out')).not.toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    render(<Header {...defaults} authRequired={true} />);
    await user.click(screen.getByText('Log out'));
    expect(defaults.onLogout).toHaveBeenCalledOnce();
  });

  it('shows user name when user is provided', () => {
    render(<Header {...defaults} user={{ id: 1, email: 'test@test.com', name: 'Test User', role: 'user', is_active: true, created_at: '' }} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
