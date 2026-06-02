import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4201',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix ../api run dev',
      url: 'http://127.0.0.1:3789/api/status',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm --prefix ../web start',
      url: 'http://localhost:4201',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
