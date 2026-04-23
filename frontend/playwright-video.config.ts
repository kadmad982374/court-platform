import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Extends the base config with video=on for every test.
 * Usage: npx playwright test --project=chromium --config=playwright-video.config.ts
 */
export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    video: 'on',
  },
});

