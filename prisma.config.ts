import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrations) uses the direct connection; the app uses the pooled
  // DATABASE_URL through the driver adapter in src/server/db.ts.
  datasource: { url: env("DIRECT_DATABASE_URL") },
});
