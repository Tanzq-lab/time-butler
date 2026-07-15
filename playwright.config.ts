import { defineConfig } from "@playwright/test";

const e2ePort = 1422;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `E2E=true npm run dev -- --port ${e2ePort}`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
