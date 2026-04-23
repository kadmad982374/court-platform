import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — real browser E2E against the live React app + live backend.
 *
 * Pre-conditions BEFORE running tests:
 *   1) Postgres up; backend running on http://localhost:8080
 *      (see scripts/run_backend.bat or docs/project/FINAL_DEMO_CHECKLIST.md)
 *   2) V22 demo seed migration applied (BUG-003 closed; 4 demo cases exist)
 *
 * The Vite dev server is started automatically via `webServer` below.
 *
 * NOTE: We DO NOT start the backend from here — the project documentation
 * leaves backend startup to the operator (Java/Maven/Postgres are out of scope
 * for the frontend `npm` tree).
 */
const PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/.artifacts/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // serial — tests share live DB state (e.g. created cases)
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: './e2e/.artifacts/html-report', open: 'never' }],
    ...(process.env.E2E_ROLES_JUNIT
      ? [['junit', { outputFile: './e2e/.artifacts/roles-junit.xml' }] as const]
      : []),
  ],
  use: {
    baseURL: BASE_URL,
    locale: 'ar',
    timezoneId: 'Asia/Damascus',
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    // Capture EVERYTHING on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // Original general E2E project — unchanged behaviour, just ignores
      // the new role-journey suite so it isn't double-executed.
      name: 'chromium',
      testIgnore: ['**/roles/**', '**/demo/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Dedicated role-journey suite (Phase 11 follow-up):
      //   - video recorded for EVERY test (not just on failure) per task spec
      //   - dedicated artifacts folder
      //   - trace + screenshot on failure (inherited)
      name: 'roles',
      testMatch: ['**/roles/**/*.spec.ts'],
      outputDir: './e2e/.artifacts/roles-results',
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      // Single-video full-system demo (one big serial test → one .webm).
      //   - slow-mo for readability
      //   - higher per-test timeout (one test walks ~6 roles)
      //   - dedicated outputDir so the single video is easy to locate
      name: 'demo',
      testMatch: ['**/demo/**/*.spec.ts'],
      outputDir: './e2e/.artifacts/demo-results',
      timeout: 25 * 60_000,
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        launchOptions: { slowMo: 250 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_BACKEND_URL: BACKEND_URL,
    },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

