import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '@/components/Header';

describe('Header', () => {
  const defaults = {
    onHomeClick: vi.fn(),
    authActive: false,
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

  it('shows logout button when auth is active', () => {
    render(<Header {...defaults} authActive={true} />);
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('hides logout button when auth is not active', () => {
    render(<Header {...defaults} authActive={false} />);
    expect(screen.queryByText('Log out')).not.toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    render(<Header {...defaults} authActive={true} />);
    await user.click(screen.getByText('Log out'));
    expect(defaults.onLogout).toHaveBeenCalledOnce();
  });
});
