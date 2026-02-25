import { defineConfig, devices } from '@playwright/test';

const OSS_PORT = 8765;
const PREMIUM_PORT = 8766;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'oss',
      testDir: './e2e/oss',
      use: {
        baseURL: `http://127.0.0.1:${OSS_PORT}`,
      },
    },
    {
      name: 'premium',
      testDir: './e2e/premium',
      use: {
        baseURL: `http://127.0.0.1:${PREMIUM_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `bash e2e/scripts/start-server.sh ${OSS_PORT} "sqlite:////tmp/e2e_oss.db"`,
      port: OSS_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        DATABASE_URL: 'sqlite:////tmp/e2e_oss.db',
      },
    },
    {
      command: `bash e2e/scripts/start-server.sh ${PREMIUM_PORT} "sqlite:////tmp/e2e_premium.db" APP_SECRET=test-password JWT_SECRET=e2e-test-secret`,
      port: PREMIUM_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        DATABASE_URL: 'sqlite:////tmp/e2e_premium.db',
        APP_SECRET: 'test-password',
        JWT_SECRET: 'e2e-test-secret',
      },
    },
  ],
});
