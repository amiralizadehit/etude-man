import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) process.loadEnvFile(".env");

// End-to-end tests run their own API and Vite servers on ports separate from
// `bun run dev`, against a separate database, so they never touch dev data.
const API_PORT = 3101;
const WEB_PORT = 5174;
const WEB_URL = `http://localhost:${WEB_PORT}`;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "api",
      command: "bun src/server/dev.ts",
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: testDatabaseUrl,
        DIRECT_DATABASE_URL: testDatabaseUrl,
        BETTER_AUTH_URL: WEB_URL,
      },
      // Never reuse: a server already on this port may point at another database.
      reuseExistingServer: false,
    },
    {
      name: "web",
      command: `bunx vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
  ],
});
