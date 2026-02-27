import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';
import PricingPage from '@/pages/marketing/PricingPage';

describe('PricingPage', () => {
  it('renders both plan cards', () => {
    renderWithRouter(<PricingPage />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('shows accurate free plan features', () => {
    renderWithRouter(<PricingPage />);
    expect(screen.getByText('10 rewrites per month (parse + chat)')).toBeInTheDocument();
    expect(screen.getByText('1 profile')).toBeInTheDocument();
    expect(screen.getByText('25 saved songs')).toBeInTheDocument();
    expect(screen.getByText('PDF export')).toBeInTheDocument();
  });

  it('shows accurate pro plan features', () => {
    renderWithRouter(<PricingPage />);
    expect(screen.getByText('200 rewrites per month (parse + chat)')).toBeInTheDocument();
    expect(screen.getByText('Unlimited profiles & saved songs')).toBeInTheDocument();
    expect(screen.getByText('Longer songs & responses')).toBeInTheDocument();
  });

  it('does not mention priority processing or email support', () => {
    renderWithRouter(<PricingPage />);
    expect(screen.queryByText(/Priority processing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Email support/)).not.toBeInTheDocument();
  });

  it('shows rewrite counting explanation', () => {
    renderWithRouter(<PricingPage />);
    expect(
      screen.getByText(/Each rewrite counts as one use/)
    ).toBeInTheDocument();
  });
});
