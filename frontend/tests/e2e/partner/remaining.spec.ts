import { test, expect } from './fixtures';

const ERR = /something went wrong|unexpected error|application error/i;

// ---- Settings: every sub-page loads, has a heading, no error, no sideways scroll ----
const SETTINGS = [
  '/partner/settings', '/partner/settings/account', '/partner/settings/notifications',
  '/partner/settings/privacy', '/partner/settings/security', '/partner/settings/security/password',
  '/partner/settings/security/sessions', '/partner/settings/security/history',
  '/partner/settings/other', '/partner/settings/other/terms', '/partner/settings/other/privacy-policy',
];
for (const url of SETTINGS) {
  test(`settings: ${url} loads cleanly`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(ERR)).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
}

// ---- Working hours: seven day switches, and a switch flips ----
test('working hours: seven days, and a day can be switched off and on', async ({ page }) => {
  await page.goto('/partner/working-hours');
  const days = page.getByRole('switch', { name: /is a working day/i });
  await expect(days).toHaveCount(7);
  const first = days.first();
  const before = await first.getAttribute('aria-checked');
  await first.click();
  await expect(first).not.toHaveAttribute('aria-checked', before ?? '');
  await first.click(); // put it back (not saved, so nothing is stored)
  await expect(first).toHaveAttribute('aria-checked', before ?? '');
});

// ---- Support: filter tabs and ticket thread ----
test('support: status tabs switch without errors', async ({ page }) => {
  await page.goto('/partner/support');
  await page.waitForLoadState('networkidle');
  test.skip(!(await page.locator('[role="tab"]:visible').count()), 'Status tabs are hidden at this width.');
  for (const name of [/^\s*active/i, /^\s*closed/i, /^\s*all/i]) {
    await page.locator('button:visible, [role="tab"]:visible').filter({ hasText: name }).first().click();
    await expect(page.getByText(ERR)).toHaveCount(0);
  }
});

test('support: opening a ticket shows its thread and a reply box', async ({ page }) => {
  await page.goto('/partner/support');
  await page.waitForLoadState('networkidle');
  const link = page.locator('a[href^="/partner/support/"]:visible').first();
  test.skip((await link.count()) === 0, 'This partner has no tickets to open.');
  await link.click();
  await expect(page).toHaveURL(/\/partner\/support\/[^/]+$/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
  await expect(page.getByText(ERR)).toHaveCount(0);
});

// ---- Safety: the three emergency actions from the spec are present ----
test('safety: emergency call, contact HomeCareX and share location are offered', async ({ page }) => {
  await page.goto('/partner/safety');
  await expect(page.getByText(/emergency|police|ambulance|112|100/i).first()).toBeVisible();
  await expect(page.getByText(/homecarex|support/i).first()).toBeVisible();
  await expect(page.getByText(/share.*location|live location/i).first()).toBeVisible();
});

// ---- Error state: when the data requests fail, the app shell must survive ----
for (const url of ['/partner/earnings', '/partner/wallet', '/partner/payouts', '/partner/incentives',
                   '/partner/performance', '/partner/reviews', '/partner/transactions', '/partner/schedule']) {
  test(`error state: ${url} survives failed data requests`, async ({ page }) => {
    await page.route(/\/partner\/(earnings|wallet|payouts|incentives|performance|reviews|transactions|schedule)/, (route) =>
      ['fetch', 'xhr'].includes(route.request().resourceType()) ? route.abort() : route.continue());
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(/application error/i)).toHaveCount(0);
  });
}

// ---- Keyboard: five Tabs in a row always land on something with a name ----
for (const url of ['/partner/availability', '/partner/earnings', '/partner/support', '/partner/settings']) {
  test(`keyboard: first five Tab stops on ${url} are nameable`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return '';
        return (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
      });
      expect(name, `Tab stop ${i + 1} has no accessible name`).not.toBe('');
    }
  });
}
