import { test, expect } from '@playwright/test';
import { loginWithPassword } from '../fixtures/auth-helpers';
import { waitForAppReady, navigateToTab } from '../fixtures/test-helpers';

test.describe('Premium Account', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginWithPassword(page, 'test-password');
  });

  test('header shows logout button after login', async ({ page }) => {
    await waitForAppReady(page);
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  test('settings defaults to models tab (password mode is not premium)', async ({ page }) => {
    await waitForAppReady(page);
    await navigateToTab(page, 'Settings');

    // Password mode (APP_SECRET) is NOT isPremium (that requires oauth_google),
    // so it should show Models and System Prompts sub-tabs (not Account)
    await expect(page).toHaveURL(/\/settings\/models$/);
    await expect(page.getByRole('button', { name: 'Models' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'System Prompts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account' })).not.toBeVisible();
  });
});
