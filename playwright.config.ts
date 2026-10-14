import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:4173", headless: true, trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    env: { NODE_ENV: "development", PORT: "4173", DB_PATH: ":memory:",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test", GEMINI_API_KEY: "" },
    timeout: 60_000,
  },
});
