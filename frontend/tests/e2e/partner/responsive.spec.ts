import { test, expect } from './fixtures';
import { PARTNER_ROUTES } from './routes';

/**
 * 360 / 768 / 1280 are the three Playwright projects, so each test below runs at all three widths.
 * Checks: no sideways scroll, nothing clipped off the right edge, readable tap targets on phones, and keyboard reach.
 */
for (const route of PARTNER_ROUTES) {
  test(`${route.name}: fits the screen with no horizontal scroll`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByText(route.expects).first()).toBeVisible();
    await page.waitForLoadState('networkidle');

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `page is ${scrollWidth}px wide in a ${clientWidth}px window`).toBeLessThanOrEqual(clientWidth + 1);
  });

  test(`${route.name}: no visible control is cut off at the right edge`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');
    const vw = page.viewportSize()!.width;
    const clipped = await page.evaluate((width) => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea').forEach((el) => {
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        // Skip things inside a deliberately scrollable strip (tabs, chips, tables).
        let p: HTMLElement | null = el.parentElement;
        let inScroller = false;
        while (p) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) { inScroller = true; break; } p = p.parentElement; }
        if (visible && !inScroller && r.right > width + 1) out.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || '').slice(0, 30)}" ends at ${Math.round(r.right)}px`);
      });
      return out;
    }, vw);
    expect(clipped).toEqual([]);
  });

  test(`${route.name}: the first Tab lands on a nameable control`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByText(route.expects).first()).toBeVisible();
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return '';
      return (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || (el as HTMLInputElement).placeholder || '').trim();
    });
    expect(name.length, 'focused element has no accessible name').toBeGreaterThan(0);
  });
}

test('phone: tap targets on the main actions are at least 40px', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-360', 'Phone only.');
  const small: string[] = [];
  for (const route of PARTNER_ROUTES) {
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');
    const found = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>('button, [role="button"], a.btn, input[type="checkbox"], select').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40) && getComputedStyle(el).visibility !== 'hidden') {
          out.push(`${(el.innerText || el.getAttribute('aria-label') || el.tagName).slice(0, 24)} (${Math.round(r.width)}x${Math.round(r.height)})`);
        }
      });
      return out;
    });
    if (found.length) small.push(`${route.name}: ${found.slice(0, 5).join(', ')}`);
  }
  // Reported as a soft check: it names the offenders so they can be fixed, without blocking the E2E run.
  expect.soft(small, 'controls smaller than 40px on a phone').toEqual([]);
});

test('mobile menu: the partner navigation is reachable at 360px', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-360', 'Phone only.');
  await page.goto('/partner/availability');
  const nav = page.getByRole('navigation').first();
  await expect(nav).toBeVisible();
});

