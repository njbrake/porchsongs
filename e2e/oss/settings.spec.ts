import { test, expect } from '@playwright/test';
import { waitForAppReady, navigateToTab } from '../fixtures/test-helpers';

test.describe('OSS Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToTab(page, 'Settings');
  });

  test('models tab shown by default in OSS mode', async ({ page }) => {
    await expect(page).toHaveURL(/\/settings\/models$/);
    // Models sub-tab should be active
    await expect(page.getByRole('button', { name: 'Models' })).toBeVisible();
  });

  test('switch between models and prompts sub-tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'System Prompts' }).click();
    await expect(page).toHaveURL(/\/settings\/prompts$/);

    await page.getByRole('button', { name: 'Models' }).click();
    await expect(page).toHaveURL(/\/settings\/models$/);
  });

  test('prompts tab shows prompt editing area', async ({ page }) => {
    await page.getByRole('button', { name: 'System Prompts' }).click();

    // Should show the System Prompts heading and parse/chat prompt textareas
    await expect(page.getByText('System Prompts').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#parse-prompt')).toBeVisible();
    await expect(page.locator('#chat-prompt')).toBeVisible();
  });

  test('account tab NOT visible in OSS mode', async ({ page }) => {
    // In OSS (non-premium) mode, there should be no "Account" sub-tab
    await expect(page.getByRole('button', { name: 'Account' })).not.toBeVisible();
  });
});
