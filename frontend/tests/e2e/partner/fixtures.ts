import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

async function signIn(page: Page) {
  const id = process.env.PARTNER_ID;
  const password = process.env.PARTNER_PASSWORD;
  if (!id || !password) throw new Error('Set PARTNER_ID and PARTNER_PASSWORD for a staging partner account.');

  let lastUrl = '';
  let lastAlert: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('/login');
    await page.locator('#login-identifier').fill(id);
    await page.locator('#login-password').fill(password);
    const consent = page.getByRole('checkbox', { name: /agree|consent|terms/i });
    if (await consent.count()) await consent.first().check();
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    const outcome = await Promise.race([
      page.waitForURL(/\/partner/, { timeout: 15_000 }).then(() => 'ok' as const),
      page.getByRole('alert').first().waitFor({ timeout: 15_000 }).then(() => 'alert' as const),
    ]).catch(() => 'timeout' as const);
    if (outcome === 'ok') return;

    lastUrl = page.url();
    lastAlert = await page.getByRole('alert').first().textContent().catch(() => null);
    if (lastAlert && /invalid|incorrect|wrong/i.test(lastAlert)) {
      throw new Error(`Login refused: ${lastAlert}. Check PARTNER_ID and PARTNER_PASSWORD.`);
    }
    // The backend allows 5 login attempts per minute; wait out the window before trying again.
    await page.waitForTimeout(lastAlert && /too many/i.test(lastAlert) ? 62_000 : 1500 * attempt);
  }
  throw new Error(`Could not sign in after 3 attempts. Last URL: ${lastUrl}. Page message: ${lastAlert ?? 'none'}`);
}

/**
 * The app restores a session only through a refresh cookie that changes on every page load,
 * so a saved login file can be used once. Instead each worker signs in once and keeps that
 * browser context; every test gets a new page in it, so reloads keep using the newest cookie.
 */
export const test = base.extend<object, { partnerContext: BrowserContext }>({
  partnerContext: [
    async ({ browser }, use, workerInfo) => {
      const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = workerInfo.project.use;
      const context = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
      const page = await context.newPage();
      await signIn(page);
      await page.close();
      await use(context);
      await context.close();
    },
    { scope: 'worker', timeout: 300_000 },
  ],

  page: async ({ partnerContext }, use, testInfo) => {
    const page = await partnerContext.newPage();
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        await testInfo.attach('screenshot-on-failure', { body: await page.screenshot(), contentType: 'image/png' });
      } catch {
        /* page already closed */
      }
    }
    // Let in-flight requests (including the session refresh) finish so the newest cookie is kept.
    await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
    await page.close();
  },
});

export { expect };
