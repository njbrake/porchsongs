import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/components/SettingsPage';

// Minimal props for SettingsPage (Profile sub-tab is shown by default)
const defaults = {
  provider: '',
  model: '',
  savedModels: [],
  onSave: vi.fn(),
  onAddModel: vi.fn(),
  onRemoveModel: vi.fn(),
  connections: [],
  onAddConnection: vi.fn(),
  onRemoveConnection: vi.fn(),
  profile: null,
  onSaveProfile: vi.fn(),
  activeTab: 'profile',
  onChangeTab: vi.fn(),
  reasoningEffort: 'high',
  onChangeReasoningEffort: vi.fn(),
};

describe('SettingsPage – Profile sub-tab', () => {
  it('renders the heading and form fields', () => {
    render(<SettingsPage {...defaults} />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('populates form from existing profile', () => {
    const profile = { id: 1, user_id: 1, name: 'Alice', is_default: true, created_at: '' };
    render(<SettingsPage {...defaults} profile={profile} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Alice');
  });

  it('calls onSaveProfile with form data on submit', async () => {
    const user = userEvent.setup();
    const onSaveProfile = vi.fn().mockResolvedValue({});
    render(<SettingsPage {...defaults} onSaveProfile={onSaveProfile} />);

    await user.type(screen.getByLabelText('Name'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSaveProfile).toHaveBeenCalledWith({
      name: 'Bob',
      is_default: true,
    });
  });

  it('shows "Saved!" status message after successful save', async () => {
    const user = userEvent.setup();
    const onSaveProfile = vi.fn().mockResolvedValue({});
    render(<SettingsPage {...defaults} profile={{ id: 1, user_id: 1, name: 'Test', is_default: true, created_at: '' }} onSaveProfile={onSaveProfile} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });
});
