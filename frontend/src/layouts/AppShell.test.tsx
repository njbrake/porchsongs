import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test/test-utils';

vi.mock('@/api', () => ({
  default: {
    listProfiles: vi.fn().mockResolvedValue([]),
  },
  STORAGE_KEYS: {
    PROVIDER: 'test_provider',
    MODEL: 'test_model',
    REASONING_EFFORT: 'test_effort',
    CURRENT_SONG_ID: 'test_song_id',
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    authState: 'ready',
    currentAuthUser: null,
    authConfig: { required: false },
    isPremium: false,
    handleLogout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProviderConnections', () => ({
  default: () => ({ connections: [], addConnection: vi.fn(), removeConnection: vi.fn() }),
}));

vi.mock('@/hooks/useSavedModels', () => ({
  default: () => ({ savedModels: [], addModel: vi.fn(), removeModel: vi.fn(), refresh: vi.fn() }),
}));

import AppShell from '@/layouts/AppShell';

describe('AppShell layout', () => {
  it('renders header and tabs inside a sticky wrapper', () => {
    renderWithRouter(<AppShell />, { route: '/app/rewrite' });

    const header = screen.getByRole('banner');
    const stickyWrapper = header.parentElement!;
    expect(stickyWrapper.className).toContain('sticky');
    expect(stickyWrapper.className).toContain('top-0');

    // Tabs are also inside the same sticky wrapper
    expect(stickyWrapper).toContainElement(screen.getByText('Rewrite'));
    expect(stickyWrapper).toContainElement(screen.getByText('Library'));
    expect(stickyWrapper).toContainElement(screen.getByText('Settings'));
  });
});
