import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Keep Playwright's transient traces/videos out of app/test-results/,
  // which stores committed DoD evidence artifacts.
  outputDir: './output/playwright/test-results',
  timeout: 45_000,
  maxFailures: 1,
  fullyParallel: false,
  workers: process.env.CI ? 4 : undefined,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
