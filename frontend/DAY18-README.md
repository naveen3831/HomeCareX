# Day 18: Partner staging E2E + responsive (Playwright)

Files
- playwright.partner.config.ts: 3 projects: mobile-360, tablet-768, desktop-1280 (plus a sign-in setup project)
- tests/e2e/partner/auth.setup.ts: logs in once, saves the session (git-ignored)
- tests/e2e/partner/routes.ts: the 15 partner pages in scope
- tests/e2e/partner/ops-finance.spec.ts: every page loads without 5xx or JS errors, plus availability toggle, blackout add/edit/remove, earnings range + CSV, transactions pagination, support form validation, role isolation
- tests/e2e/partner/responsive.spec.ts: per page and width: no horizontal scroll, no control cut off, first Tab is nameable; phone: tap targets, mobile nav

Run (PowerShell, from frontend/)
  npx playwright install chromium
  $env:STAGING_URL="https://<your staging url>"
  $env:PARTNER_ID="<staging partner email or phone>"
  $env:PARTNER_PASSWORD="<password>"
  npx playwright test -c playwright.partner.config.ts
  npx playwright show-report playwright-report-partner

Use a dedicated staging partner account: the tests toggle availability (and restore it) and create then delete one blackout date.

Vitest: add  exclude: ['tests/e2e/**', 'node_modules/**']  to the test section of your vitest config so it stops picking up the e2e specs.
Add playwright-report-partner/ and test-results/ to .gitignore.
