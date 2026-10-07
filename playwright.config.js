import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  timeout: 20000, expect: { timeout: 5000 }, reporter: 'list',
  use: { browserName: 'firefox', headless: true, viewport: { width: 1100, height: 900 }, trace: 'retain-on-failure' },
});
