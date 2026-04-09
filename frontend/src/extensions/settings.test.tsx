import { renderPremiumSettingsTab } from './settings';

describe('renderPremiumSettingsTab (OSS)', () => {
  it('returns null for any tab key', () => {
    expect(renderPremiumSettingsTab('account')).toBeNull();
    expect(renderPremiumSettingsTab('unknown')).toBeNull();
  });
});
