import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import LoginPage from '@/components/LoginPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    authConfig: { method: 'oauth_google' },
    authState: 'login',
  }),
}));

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByText('porchsongs')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('disables the sign-in button until terms are accepted', () => {
    renderWithRouter(<LoginPage />);
    const button = screen.getByRole('button', { name: 'Sign in with Google' });
    expect(button).toBeDisabled();
  });

  it('enables the sign-in button after accepting terms', () => {
    renderWithRouter(<LoginPage />);
    const checkbox = screen.getByRole('checkbox', { name: 'Accept Terms and Privacy Policy' });
    fireEvent.click(checkbox);
    const button = screen.getByRole('button', { name: 'Sign in with Google' });
    expect(button).toBeEnabled();
  });

  it('shows links to Terms and Privacy Policy', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByText('Terms of Service')).toHaveAttribute('href', '/terms');
    expect(screen.getByText('Privacy Policy')).toHaveAttribute('href', '/privacy');
  });
});
