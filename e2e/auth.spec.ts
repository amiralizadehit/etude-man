import { expect, test, type Page } from "@playwright/test";
import { seedPassword } from "./fixtures/seedPassword";

const REVIEWER_EMAIL = "reviewer1@example.com";

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function expectLoginForm(page: Page) {
  await expect(page.getByRole("heading", { name: "Etude Man" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}

async function expectExerciseList(page: Page, email: string) {
  await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // Every account is seeded with the verified book exercise.
  await expect(page.getByRole("listitem").filter({ hasText: "Sample Music Sheet" })).toBeVisible();
}

test.describe("login and exercise list", () => {
  test("signed-out visitor sees the login form", async ({ page }) => {
    await page.goto("/");
    await expectLoginForm(page);
  });

  test("seeded reviewer signs in and sees their exercise list", async ({ page }) => {
    await page.goto("/");
    await signIn(page, REVIEWER_EMAIL, seedPassword());
    await expectExerciseList(page, REVIEWER_EMAIL);
  });

  test("wrong password shows an error and keeps the login form", async ({ page }) => {
    await page.goto("/");
    await signIn(page, REVIEWER_EMAIL, `${seedPassword()}-wrong`);
    await expect(page.getByRole("alert")).toHaveText("Wrong email or password.");
    await expectLoginForm(page);
    await expect(page.getByRole("heading", { name: "Exercises" })).toHaveCount(0);
  });

  test("session survives a page reload", async ({ page }) => {
    await page.goto("/");
    await signIn(page, REVIEWER_EMAIL, seedPassword());
    await expectExerciseList(page, REVIEWER_EMAIL);

    await page.reload();
    await expectExerciseList(page, REVIEWER_EMAIL);
  });

  test("sign out returns to the login form", async ({ page }) => {
    await page.goto("/");
    await signIn(page, REVIEWER_EMAIL, seedPassword());
    await expectExerciseList(page, REVIEWER_EMAIL);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expectLoginForm(page);

    // The session is really gone, not just hidden.
    await page.reload();
    await expectLoginForm(page);
  });
});

test.describe("auth API", () => {
  test("sign-up is disabled", async ({ request, baseURL }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      headers: { Origin: baseURL! },
      data: { email: "new-user@example.com", password: "a-long-enough-password", name: "New User" },
    });
    expect(response.ok()).toBe(false);
    const body = await response.json();
    expect(body.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  test("exercise list requires a session", async ({ request }) => {
    const response = await request.get("/api/exercises");
    expect(response.status()).toBe(401);
  });
});
