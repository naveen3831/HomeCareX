// Run from /frontend:  npm run lh:build
// Uses the production build (vite preview, gzip on).
//
// Real data:
//   - Local: start the backend on :5000 (vite preview proxies /api to it).
//   - Staging: set LH_BASE_URL=https://your-staging-url (no local server is started).
// Service details page: set LH_SERVICE_SLUG to a REAL slug (a wrong slug measures the 404 page).
// Desktop numbers: set LH_PRESET=desktop (default is Lighthouse's mobile emulation).

const external = Boolean(process.env.LH_BASE_URL);
const base = (process.env.LH_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const slug = process.env.LH_SERVICE_SLUG || "home-cleaning";
const preset = process.env.LH_PRESET === "desktop" ? "desktop" : undefined;

module.exports = {
  ci: {
    collect: {
      url: [
        `${base}/`,
        `${base}/services`,
        `${base}/services/${slug}`,
        `${base}/about`,
        `${base}/contact`,
        `${base}/login`,
      ],
      numberOfRuns: 3, // median of 3 runs avoids one noisy result
      ...(external
        ? {}
        : {
            startServerCommand: "npm run preview -- --host 127.0.0.1 --port 3000",
            startServerReadyPattern: "Local",
            startServerReadyTimeout: 60000,
          }),
      settings: {
        chromeFlags: "--no-sandbox",
        ...(preset ? { preset } : {}),
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./lighthouse-report",
    },
  },
};