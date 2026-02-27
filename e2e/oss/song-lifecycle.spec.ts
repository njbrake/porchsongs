import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  navigateToTab,
  mockProviders,
  mockProviderModels,
  presetLlmSettings,
  createSongViaApi,
  getDefaultProfileId,
} from '../fixtures/test-helpers';
import {
  interceptLlmEndpoints,
  mockParseStreamResponse,
  mockChatStreamResponse,
} from '../fixtures/mock-sse';
import {
  RAW_LYRICS,
  PARSED_TITLE,
  PARSED_ARTIST,
  PARSED_CONTENT,
  REWRITTEN_CONTENT,
  CHANGES_SUMMARY,
} from '../fixtures/mock-data';

test.describe('Song Lifecycle', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await presetLlmSettings(page, baseURL!);
    await mockProviders(page);
    await mockProviderModels(page);
  });

  test('parsed song is saved on first chat and appears in library', async ({ page }) => {
    // Mock both parse and chat SSE endpoints
    const parseResponse = mockParseStreamResponse(PARSED_CONTENT, {
      original_content: PARSED_CONTENT,
      title: PARSED_TITLE,
      artist: PARSED_ARTIST,
      reasoning: null,
    });

    const chatResponse = mockChatStreamResponse(
      `<content>\n${REWRITTEN_CONTENT}\n</content>\n\n${CHANGES_SUMMARY}`,
      {
        rewritten_content: REWRITTEN_CONTENT,
        original_content: null,
        assistant_message: CHANGES_SUMMARY,
        changes_summary: CHANGES_SUMMARY,
        version: 2,
        reasoning: null,
        usage: null,
      },
    );

    await interceptLlmEndpoints(page, {
      parseBody: parseResponse,
      chatBody: chatResponse,
    });

    // Navigate and parse
    await page.goto('/');
    await waitForAppReady(page);

    const textarea = page.getByPlaceholder(/Paste your lyrics/);
    await textarea.fill(RAW_LYRICS);
    await page.getByRole('button', { name: 'Parse' }).click();

    // Wait for parse to complete
    await expect(page.getByPlaceholder('Song title')).toHaveValue(PARSED_TITLE, { timeout: 10_000 });

    // Send a chat message — this triggers auto-save via onBeforeSend
    const chatInput = page.getByPlaceholder('Tell the AI how to change the song...');
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
    await chatInput.fill('Change "wretch" to "soul"');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for the chat response to complete (assistant message appears)
    await expect(page.getByText(CHANGES_SUMMARY).first()).toBeVisible({ timeout: 10_000 });

    // Now navigate to Library and verify the song appears
    await navigateToTab(page, 'Library');
    await expect(page.getByText(PARSED_TITLE).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(new RegExp(`by ${PARSED_ARTIST}`)).first()).toBeVisible();
  });
});
