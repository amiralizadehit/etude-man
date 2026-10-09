import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Unit and component tests only; Playwright owns e2e/.
      include: ["src/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      // Lets Testing Library register its automatic cleanup after each test.
      globals: true,
      setupFiles: ["./src/client/test/setup.ts"],
    },
  }),
);
