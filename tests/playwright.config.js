// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Crate is a single-file vanilla PWA (index.html with one inline <script>, no build).
// We serve the repo root (one level above tests/) over http and drive the REAL app in a
// real browser, calling its window-scoped functions via page.evaluate. No app code is
// modified or re-implemented here.
module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: true,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8217',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Serve the repo root so http://localhost:8217/index.html is the real app.
    command: 'python3 -m http.server 8217 --directory ..',
    url: 'http://localhost:8217/index.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
