/** Start a tier-local preview server for browser journeys at the configured origin. */
import 'dotenv/config';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${process.env.VITE_PREVIEW_PORT || 4173}`;
const origin = new URL(baseURL);
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 30000,
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host ${origin.hostname} --port ${origin.port || 80} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
