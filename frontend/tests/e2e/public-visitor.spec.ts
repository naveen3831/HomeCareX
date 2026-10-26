import { test, expect } from "@playwright/test";

// Any API call for one service's details: GET .../api/.../services/<slug>
const serviceDetailsApi = (slug: string) =>
  new RegExp(`/api/.*/services/${slug}(\\?.*)?$`);

test.describe("HomeCareX public visitor journey", () => {
  test("visitor walks through the public site", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    for (const path of ["/services", "/about", "/contact", "/login"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading").first()).toBeVisible();
    }
  });

  test("home page opens and visitor can browse services", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/services");
    await expect(page).toHaveURL(/\/services/);
    await expect(
      page.getByRole("heading", { name: /services/i }).first()
    ).toBeVisible();
  });

  test("invalid service slug displays a not-found page", async ({ page }) => {
    await page.goto("/services/this-service-does-not-exist-js07");
    await expect(
      page.getByText(/not found|could not find|doesn't exist|does not exist/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("direct service deep link does not crash", async ({ page }) => {
    await page.goto("/services/home-cleaning");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("focusing a service link prefetches its details", async ({ page }) => {
    // Answer with a 404 so the test never depends on staging data; only the request matters.
    await page.route(serviceDetailsApi("plumbing"), (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Not found" }),
      })
    );

    await page.goto("/");
    const link = page.locator('a[href="/services/plumbing"]').first();
    await link.scrollIntoViewIfNeeded();

    const prefetch = page.waitForRequest((req) =>
      serviceDetailsApi("plumbing").test(req.url())
    );
    await link.focus();
    await prefetch;
  });

  test("hovering a service link prefetches its details", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover does not exist on touch devices");

    await page.route(serviceDetailsApi("electrical"), (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Not found" }),
      })
    );

    await page.goto("/");
    const link = page.locator('a[href="/services/electrical"]').first();
    await link.scrollIntoViewIfNeeded();

    const prefetch = page.waitForRequest((req) =>
      serviceDetailsApi("electrical").test(req.url())
    );
    await link.hover();
    await prefetch;
  });
});