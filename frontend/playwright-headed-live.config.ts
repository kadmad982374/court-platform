import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Headed-live config — used by scripts/run-live-video.ps1.
 *
 * - Runs ONLY the blueprint-journey spec, which walks one litigation case
 *   through every role of the system (matches FINAL_ARABIC_BLUEPRINT_*.md).
 * - Headed + slowMo so the operator can watch every gesture in real time.
 * - Per-test video=on so the video pipeline can stitch one continuous MP4.
 *
 * Usage:
 *   npx playwright test --project=chromium --config=playwright-headed-live.config.ts --reporter=line,json
 */
export default defineConfig({
  ...baseConfig,
  // CRITICAL: only run the customer-facing journey, not the 80+ regression tests.
  // The regression suite still runs from the default playwright.config.ts.
  testMatch: ['**/blueprint-journey.spec.ts'],
  use: {
    ...baseConfig.use,
    headless: false,
    // Record EVERY test at full viewport resolution. Playwright's default
    // is 800x450 (downscaled), which made the stitched MP4 look fuzzy.
    // Pinning size to the viewport (1440x900 from baseConfig) gives a
    // crisp 1:1 capture of the chromium content area.
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
    launchOptions: { slowMo: 120 },
  },
});



