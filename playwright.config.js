require('dotenv').config();
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './src/tests',
  timeout:  90_000,   // 30s is NOT enough: 3 broken locators × Groq latency + assertion
  retries:  0,        // retries are handled by the healer, not Playwright
  workers:  1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never', port: 9324 }],
  ],
  use: {
    headless:   true,
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
  },
});