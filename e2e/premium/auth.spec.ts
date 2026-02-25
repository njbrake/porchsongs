import { test, expect } from '@playwright/test';
import { loginWithPassword, logout } from '../fixtures/auth-helpers';
import { waitForAppReady } from '../fixtures/test-helpers';

test.describe('Premium Auth', () => {
  test('shows login page when APP_SECRET is set', async ({ page }) => {
    await page.goto('/');
    // Should show password input (login page)
    await expect(page.getByPlaceholder('Password')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();

    // Tabs should NOT be visible
    await expect(page.getByRole('tab', { name: 'Rewrite' })).not.toBeVisible();
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Password')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log In' }).click();

    // Error message should appear
    await expect(page.getByText(/wrong password/i)).toBeVisible({ timeout: 5_000 });

    // Should still be on login page
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('correct password logs in and app loads', async ({ page }) => {
    await page.goto('/');
    await loginWithPassword(page, 'test-password');

    // App should be loaded with tabs
    await expect(page.getByRole('tab', { name: 'Rewrite' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Library' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  });

  test('logout returns to login page', async ({ page }) => {
    await page.goto('/');
    await loginWithPassword(page, 'test-password');
    await waitForAppReady(page);

    await logout(page);

    // Should be back on login page
    await expect(page.getByPlaceholder('Password')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: 'Rewrite' })).not.toBeVisible();
  });

  test('auth config returns required true with method password', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/auth/config`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.required).toBe(true);
    expect(body.method).toBe('password');
  });
});
