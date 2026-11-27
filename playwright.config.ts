import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the web app: production build (`vite preview`), SSR + hydration,
 * axe, all eight AI states and streaming. `npm run -w apps/web build` must
 * run first (CI runs `npm run build`; locally `npm run e2e` does both).
 * The embed web component has its own config: playwright.embed.config.ts.
 */
const PORT = Number(process.env.E2E_WEB_PORT ?? 4181);

export default defineConfig({
  testDir: './e2e',
  testIgnore: /embed\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run -w apps/agent start',
      url: 'http://127.0.0.1:8787/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        LLM_PROVIDER: 'mock',
        SESSION_SECRET: 'playwright-local-session-secret-32-chars',
        WEB_ORIGIN: `http://127.0.0.1:${PORT}`,
        // INNGEST_DEV intentionally unset: the Inngest endpoint stays
        // unmounted in e2e. Passing '' fails the min(1) env schema.
      },
    },
    {
      // Keep the preview port in sync with PORT above. Playwright's webServer
      // env applies here, so the shell default in apps/web/package.json is
      // never relied on for the port we actually probe.
      command: 'npm run -w apps/web preview',
      url: `http://127.0.0.1:${PORT}`,
      env: { E2E_WEB_PORT: String(PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
