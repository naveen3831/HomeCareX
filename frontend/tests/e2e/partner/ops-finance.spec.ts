import { test, expect } from './fixtures';
import { PARTNER_ROUTES } from './routes';

/** P0 "Partner ops + finance on staging": every page loads for a real partner, with no crash and no failed API calls. */
for (const route of PARTNER_ROUTES) {
  test(`${route.group}: ${route.name} loads on staging`, async ({ page }) => {
    const badResponses: string[] = [];
    const pageErrors: string[] = [];
    page.on('response', (r) => {
      const url = r.url();
      if (url.includes('/api/') && r.status() >= 500) badResponses.push(`${r.status()} ${url}`);
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(route.path);
    await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));
    await expect(page.getByText(route.expects).first()).toBeVisible();
    await expect(page.getByText(/something went wrong|unexpected error|application error/i)).toHaveCount(0);

    expect(pageErrors, 'uncaught JavaScript errors').toEqual([]);
    expect(badResponses, '5xx API responses').toEqual([]);
  });
}

test('availability: toggling online/offline persists after a reload', async ({ page }) => {
  await page.goto('/partner/availability');
  const toggle = page.getByRole('switch', { name: /available for jobs/i });
  const heading = page.getByRole('heading', { name: /^(online|offline)$/i }).first();
  await expect(toggle).toBeVisible();
  const before = (await heading.innerText()).trim();
  const flipped = before.toLowerCase() === 'online' ? 'Offline' : 'Online';
  const wasChecked = before.toLowerCase() === 'online' ? 'true' : 'false';

  await toggle.click();
  await expect(heading).toHaveText(flipped);
  await page.reload();
  await expect(heading).toHaveText(flipped);

  // Put it back so the shared account is left as found, and wait until that is saved.
  await toggle.click();
  await expect(heading).toHaveText(before);
  await expect(toggle).toHaveAttribute('aria-checked', wasChecked);
});

test('blackout dates: add, edit and remove a date', async ({ page }) => {
  await page.goto('/partner/blackout-dates');
  // One blackout per date, so use a random day in the next 3 months to avoid clashing with leftovers.
  const d = new Date();
  d.setDate(d.getDate() + 30 + Math.floor(Math.random() * 90));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const reason = `E2E ${Date.now()}`;
  const edited = `${reason} edited`;

  await page.locator('input[type="date"]').first().fill(iso);
  await page.getByPlaceholder(/family event/i).fill(reason);
  await page.getByRole('button', { name: /add date/i }).click();
  await expect(page.getByText(reason, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(reason, { exact: true })).toBeVisible();

  // Edit the reason.
  await page.locator('li', { hasText: reason }).getByRole('button', { name: /edit/i }).click();
  await page.getByLabel(`Reason for ${iso}`).fill(edited);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(edited, { exact: true })).toBeVisible();

  // Remove it: Remove, then confirm with "Yes, remove".
  const row = page.locator('li', { hasText: edited });
  await row.getByRole('button', { name: /remove/i }).first().click();
  await row.getByRole('button', { name: /yes, remove/i }).click();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
});

test('earnings: a bad custom range is refused and CSV export needs a valid one', async ({ page }) => {
  await page.goto('/partner/earnings');
  await page.getByLabel('From', { exact: true }).fill('2026-10-20');
  await page.getByLabel('To', { exact: true }).fill('2026-10-10');
  await expect(page.getByText(/start date must be on or before the end date/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /download csv/i })).toBeDisabled();
});

test('earnings: CSV download works for a range that has earnings', async ({ page }) => {
  await page.goto('/partner/earnings');
  const btn = page.getByRole('button', { name: /download csv/i });
  await expect(btn).toBeVisible();
  await page.waitForLoadState('networkidle');

  // The button is enabled only when the selected range has earnings, so try each preset.
  let enabled = false;
  for (const name of [/this month/i, /last 30 days/i, /all time/i]) {
    await page.getByRole('button', { name }).click();
    await page.waitForLoadState('networkidle');
    if (await btn.isEnabled()) { enabled = true; break; }
  }
  test.skip(!enabled, 'No preset range has earnings for this partner, so there is nothing to export.');

  const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
});

test('transactions: the type filter and pagination do not break the list', async ({ page }) => {
  await page.goto('/partner/transactions');
  await expect(page.getByText(/transaction/i).first()).toBeVisible();

  // Pagination exists only on wider screens; on a phone the list loads more as you scroll.
  const next = page.getByRole('button', { name: /^next$/i });
  if ((await next.count()) > 0 && (await next.isEnabled())) {
    await next.click();
    await expect(page.getByText(/page 2 of/i)).toBeVisible();
    await page.getByRole('button', { name: /^previous$/i }).click();
    await expect(page.getByText(/page 1 of/i)).toBeVisible();
  }

  // Type filter: pick the first type; the list must load or say nothing matches, with no error shown.
  await page.getByRole('button', { name: /^filter$/i }).click();
  await page.getByRole('option').first().click();
  await expect(page.getByText(/something went wrong|unexpected error|application error/i)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('support: raising a ticket with empty fields is refused', async ({ page }) => {
  await page.goto('/partner/support');
  await page.getByRole('button', { name: /new ticket/i }).first().click();
  await page.getByRole('button', { name: /submit|send|create ticket|raise/i }).last().click();
  await expect(page.getByText(/add a short subject/i)).toBeVisible();
  await expect(page.getByText(/describe what happened/i)).toBeVisible();
});

test('security: a partner cannot open admin or customer areas', async ({ page }) => {
  for (const path of ['/admin', '/customer']) {
    await page.goto(path);
    await expect(page).not.toHaveURL(new RegExp(`${path}$`));
  }
});







