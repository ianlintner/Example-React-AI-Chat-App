import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the new stack (apps/web). Legacy e2e lives in tests/ and keeps its
 * own config until card 12. Runs against the production build (`vite
 * preview`) so it exercises SSR + hydration; `npm run -w apps/web build`
 * must run first (CI does this; locally `npm run e2e` does both).
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run -w apps/web preview',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
