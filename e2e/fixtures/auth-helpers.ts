import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Log in via the password form. */
export async function loginWithPassword(page: Page, password: string): Promise<void> {
  const input = page.getByPlaceholder('Password');
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  // Wait for the app to load (tabs visible)
  await expect(page.getByRole('tab', { name: 'Rewrite' })).toBeVisible({ timeout: 15_000 });
}

/** Click the Log out button and wait for the login page. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByPlaceholder('Password')).toBeVisible({ timeout: 10_000 });
}
