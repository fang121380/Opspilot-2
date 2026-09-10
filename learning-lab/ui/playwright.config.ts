import { defineConfig } from "@playwright/test";

const port = process.env.WORKBENCH_E2E_PORT ?? "5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.WORKBENCH_BROWSER_CHANNEL || undefined,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { LAB_API_TARGET: "http://127.0.0.1:8788" },
  },
});
