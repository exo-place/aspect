import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: "bun run server.ts",
    port: 3001,
    env: {
      PORT: "3001",
      DATA_DIR: "/tmp/aspect-e2e-data",
    },
    reuseExistingServer: false,
  },
  globalSetup: "e2e/global-setup.ts",
});
