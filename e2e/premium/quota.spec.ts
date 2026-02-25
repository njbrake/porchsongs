import { test, expect } from '@playwright/test';
import { loginWithPassword } from '../fixtures/auth-helpers';
import { waitForAppReady, mockProviders, mockProviderModels, presetLlmSettings } from '../fixtures/test-helpers';
import { interceptParseWith429 } from '../fixtures/mock-sse';
import { RAW_LYRICS } from '../fixtures/mock-data';

test.describe('Premium Quota', () => {
  test('429 on parse shows quota exhausted error', async ({ page, baseURL }) => {
    // Pre-set provider/model
    await presetLlmSettings(page, baseURL!);
    await mockProviders(page);
    await mockProviderModels(page);
    await interceptParseWith429(page);

    await page.goto('/');
    await loginWithPassword(page, 'test-password');
    await waitForAppReady(page);

    const textarea = page.getByPlaceholder('Paste your lyrics');
    await textarea.fill(RAW_LYRICS);
    await page.getByRole('button', { name: 'Parse' }).click();

    // Error about quota should be visible
    await expect(page.getByText(/quota|upgrade/i)).toBeVisible({ timeout: 10_000 });
  });
});
