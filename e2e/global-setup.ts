import { execSync } from "node:child_process";

// Brings the test database up to date before every run: applies pending migrations
// (creating the database if needed) and runs the idempotent seed. Non-destructive by
// design; tests create any other data they need. Both URLs are TEST_DATABASE_URL, so
// this never touches the dev database.
export default function globalSetup() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL!;
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl, DIRECT_DATABASE_URL: testDatabaseUrl };
  execSync("bunx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("bun prisma/seed.ts", { env, stdio: "inherit" });
}
