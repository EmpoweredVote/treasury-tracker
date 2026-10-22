import { defineConfig, devices } from '@playwright/test';
import { PREVIEW_ORIGIN as baseURL, QA_USER_AGENT } from './e2e/constants';

// Browser journeys: the PR's own build, served by `vite preview`, talking to
// the live API through the preview proxy. See e2e/ and CLAUDE.md.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // A user's main content must show within 5 s.
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        userAgent: `${devices['Desktop Chrome'].userAgent} ${QA_USER_AGENT}`,
      },
    },
    {
      name: 'phone',
      grep: /@phone/,
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 812 },
        userAgent: `${devices['Pixel 5'].userAgent} ${QA_USER_AGENT}`,
      },
    },
  ],
  webServer: {
    command: 'npm run e2e:serve',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
