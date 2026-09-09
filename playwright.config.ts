import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3001',
  },
  webServer: {
    command: 'npm run dev:test',
    url: 'http://localhost:3001/api/health',
    timeout: 30_000,
    reuseExistingServer: false,
  },
});
