import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'tests/e2e/partner/.auth/partner.json';

setup('sign in as the staging partner', async ({ page }) => {
  const id = process.env.PARTNER_ID;
  const password = process.env.PARTNER_PASSWORD;
  if (!id || !password) throw new Error('Set PARTNER_ID and PARTNER_PASSWORD for a staging partner account.');

  await page.goto('/login');
  await page.locator('#login-identifier').fill(id);
  await page.locator('#login-password').fill(password);
  // The login form may ask for consent before enabling Log in.
  const consent = page.getByRole('checkbox', { name: /agree|consent|terms/i });
  if (await consent.count()) await consent.first().check();
  await page.getByRole('button', { name: /log in|sign in/i }).click();

  await expect(page).toHaveURL(/\/partner/);
  await page.context().storageState({ path: AUTH_FILE });
});

