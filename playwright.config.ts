import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Cada test registra su propio usuario (uniqueEmail) y no comparte estado —
  // no hay motivo para forzar serialización contra la misma API/DB de test.
  fullyParallel: true,
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
    // En CI siempre arranca de cero; en local reusa un server que ya esté
    // corriendo (ej. `npm run dev:test` en otra terminal) en vez de fallar
    // por puerto ocupado.
    reuseExistingServer: !process.env.CI,
  },
});
