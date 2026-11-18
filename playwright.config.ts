import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npm run dev -w apps/api",
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env.CI,
      env: { MOCK_MODE: "true" },
    },
    {
      command: "npm run dev -w apps/web",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
