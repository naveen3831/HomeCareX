
import { test, expect } from "@playwright/test";

test.describe("HomeCareX public visitor journey", () => {
  test("home page opens and visitor can browse services", async ({ page }) => {
    await page.goto("/");

    // Verify the home page loads.
    await expect(page.locator("body")).toBeVisible();

    // Navigate to the public services page.
    await page.goto("/services");
    await expect(page).toHaveURL(/\/services/);

    // The services page should render meaningful content.
    await expect(
      page.getByRole("heading", { name: /services/i }).first()
    ).toBeVisible();
  });

  test("invalid service slug displays a not-found page", async ({ page }) => {
    await page.goto("/services/this-service-does-not-exist-js07");

    // The page should communicate that the requested service was not found.
    await expect(
      page.getByText(/not found|could not find|doesn't exist|does not exist/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("direct service deep link does not crash", async ({ page }) => {
    await page.goto("/services/home-cleaning");

    // The app should render the page even if this particular slug is unavailable.
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
