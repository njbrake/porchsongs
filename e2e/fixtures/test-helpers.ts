import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Wait for the app to be fully loaded (tabs visible). */
export async function waitForAppReady(page: Page): Promise<void> {
  // The tab bar renders TabsTrigger elements with role="tab"
  await expect(page.getByRole('tab', { name: 'Rewrite' })).toBeVisible({ timeout: 15_000 });
}

/** Click a main tab by name (Rewrite, Library, Settings). */
export async function navigateToTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name }).click();
}

/** Create a song via the API (bypassing the UI for seeding test data). */
export async function createSongViaApi(
  baseUrl: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/api/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to create song: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Get the auto-created default profile ID. */
export async function getDefaultProfileId(baseUrl: string): Promise<number> {
  const res = await fetch(`${baseUrl}/api/profiles`);
  if (!res.ok) {
    throw new Error(`Failed to fetch profiles: ${res.status}`);
  }
  const profiles = (await res.json()) as Array<{ id: number; is_default: boolean }>;
  const def = profiles.find((p) => p.is_default) ?? profiles[0];
  if (!def) {
    throw new Error('No profiles found');
  }
  return def.id;
}

/** Intercept /api/providers to return a fake provider list. */
export async function mockProviders(page: Page): Promise<void> {
  await page.route('**/api/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: [
          { name: 'openai', local: false },
          { name: 'anthropic', local: false },
        ],
        platform_enabled: false,
      }),
    });
  });
}

/**
 * Intercept /api/providers/{provider}/models to return a fake model list.
 */
export async function mockProviderModels(page: Page): Promise<void> {
  await page.route('**/api/providers/*/models*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['gpt-4', 'gpt-4o', 'gpt-3.5-turbo']),
    });
  });
}

/** Set localStorage keys to pre-configure a provider+model so tests skip model selection. */
export async function presetLlmSettings(page: Page, baseUrl: string): Promise<void> {
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.setItem('porchsongs_provider', 'openai');
    localStorage.setItem('porchsongs_model', 'gpt-4');
    localStorage.setItem('porchsongs_reasoning_effort', 'high');
  });
}
