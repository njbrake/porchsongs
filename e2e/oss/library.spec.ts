import { test, expect } from '@playwright/test';
import { waitForAppReady, navigateToTab, createSongViaApi, getDefaultProfileId } from '../fixtures/test-helpers';
import { makeSongCreatePayload, makeSecondSongPayload, PARSED_TITLE, PARSED_ARTIST, PARSED_CONTENT } from '../fixtures/mock-data';

test.describe('OSS Library', () => {
  test('empty library shows empty state', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToTab(page, 'Library');

    // Should show the empty state message
    await expect(
      page.getByText(/Your library is empty/)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('songs created via API appear in list', async ({ page, baseURL }) => {
    // Seed songs via API
    const profileId = await getDefaultProfileId(baseURL!);
    await createSongViaApi(baseURL!, makeSongCreatePayload(profileId));
    await createSongViaApi(baseURL!, makeSecondSongPayload(profileId));

    await page.goto('/');
    await waitForAppReady(page);
    await navigateToTab(page, 'Library');

    // Both songs should appear
    await expect(page.getByText('Amazing Grace').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Hallelujah').first()).toBeVisible();
  });

  test('search filters songs by title', async ({ page, baseURL }) => {
    // Ensure songs exist (may already exist from prior test, but idempotent to add more)
    const profileId = await getDefaultProfileId(baseURL!);
    await createSongViaApi(baseURL!, makeSongCreatePayload(profileId));
    await createSongViaApi(baseURL!, makeSecondSongPayload(profileId));

    await page.goto('/');
    await waitForAppReady(page);
    await navigateToTab(page, 'Library');

    // Wait for songs to load
    await expect(page.getByText('Amazing Grace').first()).toBeVisible({ timeout: 5_000 });

    // Search for "Hallelujah"
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Hallelujah');

    // Only Hallelujah should be visible
    await expect(page.getByText('Hallelujah').first()).toBeVisible();
    await expect(page.getByText('Amazing Grace')).not.toBeVisible();
  });

  test('song detail view loads from library click', async ({ page, baseURL }) => {
    const profileId = await getDefaultProfileId(baseURL!);
    await createSongViaApi(baseURL!, makeSongCreatePayload(profileId));

    await page.goto('/');
    await waitForAppReady(page);
    await navigateToTab(page, 'Library');

    // Wait for the song list to appear, then click on the artist text
    // (clicking the title span triggers rename due to stopPropagation, so click the card area instead)
    await expect(page.getByText(/by John Newton/).first()).toBeVisible({ timeout: 5_000 });
    await page.getByText(/by John Newton/).first().click();

    // Should open the song detail view with an "All Songs" back button and "Edit in Rewrite"
    await expect(page.getByRole('button', { name: /All Songs/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /Edit in Rewrite/i })).toBeVisible();
  });

  test('Edit in Rewrite loads song into rewrite tab', async ({ page, baseURL }) => {
    const profileId = await getDefaultProfileId(baseURL!);
    await createSongViaApi(baseURL!, makeSongCreatePayload(profileId));

    await page.goto('/');
    await waitForAppReady(page);
    await navigateToTab(page, 'Library');

    // Open song detail
    await expect(page.getByText(/by John Newton/).first()).toBeVisible({ timeout: 5_000 });
    await page.getByText(/by John Newton/).first().click();

    // Click "Edit in Rewrite"
    await expect(page.getByRole('button', { name: /Edit in Rewrite/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Edit in Rewrite/i }).click();

    // Should navigate to the Rewrite tab with song content loaded
    await expect(page).toHaveURL(/\/app\/rewrite/);
    await expect(page.getByPlaceholder('Song title')).toHaveValue(PARSED_TITLE, { timeout: 5_000 });
    await expect(page.getByPlaceholder('Artist')).toHaveValue(PARSED_ARTIST);

    // Chat input should be visible (song is in WORKSHOPPING state)
    await expect(page.getByPlaceholder('Tell the AI how to change the song...')).toBeVisible();

    // Song content should be displayed (check for chord annotation from PARSED_CONTENT)
    await expect(page.getByText(/Amazing grace how/).first()).toBeVisible();
  });
});
