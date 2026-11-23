import { defineConfig, devices } from '@playwright/test';

/**
 * E2E for the <agent-chat> embed demo. Serves apps/embed with Vite dev and
 * runs apps/agent against the deterministic mock model (no network LLM).
 * Run: npx playwright test -c playwright.embed.config.ts
 */
const PORT = Number(process.env.E2E_EMBED_PORT ?? 4182);

export default defineConfig({
  testDir: './e2e-embed',
  fullyParallel: false,
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
      },
    },
    {
      command: 'npm run -w apps/embed dev',
      url: `http://127.0.0.1:${PORT}`,
      env: { E2E_EMBED_PORT: String(PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
