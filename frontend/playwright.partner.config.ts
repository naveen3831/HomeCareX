import { defineConfig, devices } from '@playwright/test';

/**
 * Day 18: partner staging E2E + responsive.
 * Run:  $env:STAGING_URL="https://staging.example.com"; $env:PARTNER_ID="..."; $env:PARTNER_PASSWORD="..."
 *       npx playwright test -c playwright.partner.config.ts
 */
const baseURL = process.env.STAGING_URL;
if (!baseURL) throw new Error('Set STAGING_URL (for example https://staging.homecarex.example) before running.');

export default defineConfig({
  testDir: './tests/e2e/partner',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-partner' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'mobile-360',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } },
    },
    {
      name: 'tablet-768',
      testMatch: /.*\.spec\.ts/,
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      testMatch: /.*\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});


