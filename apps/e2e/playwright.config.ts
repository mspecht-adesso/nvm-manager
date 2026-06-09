import { defineConfig, devices } from '@playwright/test';

// Slows every browser action down (in ms) so the click flow can be followed by
// eye in headed mode. Set via `PW_SLOWMO` (the `test:headed` script uses 400).
const slowMo = Number(process.env['PW_SLOWMO'] ?? 0);

// Visual mode records a trace + video for every test so a run can be replayed
// afterwards via `npm run report`. Enabled by the `test:headed` script; kept off
// by default to keep the plain (CI) run fast and free of artifacts.
const visual = process.env['PW_VISUAL'] === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4201',
    trace: visual ? 'on' : 'on-first-retry',
    video: visual ? 'on' : 'retain-on-failure',
    launchOptions: { slowMo },
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
