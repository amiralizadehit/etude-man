import { expect, test } from "@playwright/test";

test("home page shows the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Etude Man" })).toBeVisible();
});

test("API health check responds through the web server", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ ok: true });
});
