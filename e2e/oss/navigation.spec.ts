import { test, expect } from '@playwright/test';
import { waitForAppReady, navigateToTab } from '../fixtures/test-helpers';

test.describe('OSS Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('tab switching updates URL', async ({ page }) => {
    // Start on rewrite (default)
    expect(page.url()).toMatch(/\/$/);

    await navigateToTab(page, 'Library');
    await expect(page).toHaveURL(/\/library$/);

    await navigateToTab(page, 'Settings');
    await expect(page).toHaveURL(/\/settings\/models$/);

    await navigateToTab(page, 'Rewrite');
    await expect(page).toHaveURL(/\/$/);
  });

  test('direct URL navigation works', async ({ page }) => {
    await page.goto('/library');
    await waitForAppReady(page);
    await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute(
      'data-state',
      'active'
    );

    await page.goto('/settings/prompts');
    await waitForAppReady(page);
    await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
      'data-state',
      'active'
    );
  });

  test('settings sub-tabs (models, prompts)', async ({ page }) => {
    await navigateToTab(page, 'Settings');
    await expect(page).toHaveURL(/\/settings\/models$/);

    // Click "System Prompts" sub-tab
    await page.getByRole('button', { name: 'System Prompts' }).click();
    await expect(page).toHaveURL(/\/settings\/prompts$/);

    // Click "Models" sub-tab
    await page.getByRole('button', { name: 'Models' }).click();
    await expect(page).toHaveURL(/\/settings\/models$/);
  });

  test('browser back/forward preserves state', async ({ page }) => {
    await navigateToTab(page, 'Library');
    await expect(page).toHaveURL(/\/library$/);

    await navigateToTab(page, 'Settings');
    await expect(page).toHaveURL(/\/settings\/models$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute(
      'data-state',
      'active'
    );

    await page.goForward();
    await expect(page).toHaveURL(/\/settings\/models$/);
    await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
      'data-state',
      'active'
    );
  });
});
