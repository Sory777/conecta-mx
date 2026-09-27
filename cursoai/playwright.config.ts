import { defineConfig, devices } from '@playwright/test';

// UI end-to-end tests against `wrangler dev` serving the built app (AI_PROVIDER=mock).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.APP_URL ?? 'http://localhost:8787',
    trace: 'off',
    // Each run looks like a new client IP so per-IP sign-up limits don't block repeated local runs.
    extraHTTPHeaders: { 'CF-Connecting-IP': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    screenshot: 'only-on-failure',
    // Optional: reuse a preinstalled Chromium instead of `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } } },
  ],
});
