import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelSelector from '@/components/ModelSelector';

describe('ModelSelector', () => {
  const savedModels = [
    { id: 1, profile_id: 1, provider: 'openai', model: 'gpt-4o' },
    { id: 2, profile_id: 1, provider: 'anthropic', model: 'claude-sonnet' },
  ];

  it('shows "No models configured" when no models and no provider', () => {
    render(
      <ModelSelector
        provider=""
        model=""
        savedModels={[]}
        onChangeProvider={vi.fn()}
        onChangeModel={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(screen.getByText(/No models configured/)).toBeInTheDocument();
  });

  it('calls onOpenSettings when "Open Settings" link is clicked', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <ModelSelector
        provider=""
        model=""
        savedModels={[]}
        onChangeProvider={vi.fn()}
        onChangeModel={vi.fn()}
        onOpenSettings={onOpenSettings}
      />
    );
    await user.click(screen.getByText('Open Settings'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('renders a select with saved models', () => {
    render(
      <ModelSelector
        provider="openai"
        model="gpt-4o"
        savedModels={savedModels}
        onChangeProvider={vi.fn()}
        onChangeModel={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(screen.getByText('openai / gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('anthropic / claude-sonnet')).toBeInTheDocument();
    expect(screen.getByText('Manage models...')).toBeInTheDocument();
  });

  it('calls onOpenSettings when "Manage models..." is selected', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(
      <ModelSelector
        provider="openai"
        model="gpt-4o"
        savedModels={savedModels}
        onChangeProvider={vi.fn()}
        onChangeModel={vi.fn()}
        onOpenSettings={onOpenSettings}
      />
    );
    await user.selectOptions(screen.getByRole('combobox'), '__manage__');
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
