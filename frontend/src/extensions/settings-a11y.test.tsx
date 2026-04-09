import { renderPremiumSettingsTab } from './settings';

describe('renderPremiumSettingsTab accessibility (OSS)', () => {
  it('returns null since premium features are not available in OSS', () => {
    // Premium AccountTab with progress bars and billing UI is tested in the premium repo.
    // In OSS, this function always returns null.
    expect(renderPremiumSettingsTab('account')).toBeNull();
  });
});
