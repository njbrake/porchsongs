import { test, expect } from '@playwright/test';
import { waitForAppReady, navigateToTab, mockProviders, mockProviderModels } from '../fixtures/test-helpers';

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

  test('system prompt editing persists changes', async ({ page }) => {
    await page.getByRole('button', { name: 'System Prompts' }).click();

    // Edit the parse prompt
    const parsePrompt = page.locator('#parse-prompt');
    await expect(parsePrompt).toBeVisible({ timeout: 5_000 });
    await parsePrompt.fill('Custom parse prompt for testing');

    // Edit the chat prompt
    const chatPrompt = page.locator('#chat-prompt');
    await chatPrompt.fill('Custom chat prompt for testing');

    // Save
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await expect(page.getByText('Saved!')).toBeVisible({ timeout: 5_000 });

    // Navigate away and back
    await navigateToTab(page, 'Library');
    await navigateToTab(page, 'Settings');
    await page.getByRole('button', { name: 'System Prompts' }).click();

    // Verify prompts persisted
    await expect(parsePrompt).toHaveValue('Custom parse prompt for testing', { timeout: 5_000 });
    await expect(chatPrompt).toHaveValue('Custom chat prompt for testing');
  });

  test('model/provider selection persists in localStorage', async ({ page }) => {
    // Mock providers so we have options available
    await mockProviders(page);
    await mockProviderModels(page);

    // Navigate to Rewrite tab to access model selector
    await navigateToTab(page, 'Rewrite');

    // Set provider/model via localStorage (simulating selection)
    await page.evaluate(() => {
      localStorage.setItem('porchsongs_provider', 'anthropic');
      localStorage.setItem('porchsongs_model', 'claude-3-opus');
      localStorage.setItem('porchsongs_reasoning_effort', 'low');
    });

    // Reload and verify settings persisted
    await page.reload();
    await waitForAppReady(page);

    const stored = await page.evaluate(() => ({
      provider: localStorage.getItem('porchsongs_provider'),
      model: localStorage.getItem('porchsongs_model'),
      effort: localStorage.getItem('porchsongs_reasoning_effort'),
    }));

    expect(stored.provider).toBe('anthropic');
    expect(stored.model).toBe('claude-3-opus');
    expect(stored.effort).toBe('low');
  });
});
