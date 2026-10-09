import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { seedPassword } from "./fixtures/seedPassword";
import { BOOK_EXERCISE, SAMPLE_WEAK_PAIRS } from "../prisma/seedAccounts";
import { listPlayableWrittenMidis, normalizeMusicXml } from "../src/shared/musicxml";
import { generateSampleAttempts } from "../src/shared/sampleHistory";
import { analyzeAttempts } from "../src/shared/transitions";

// demo has the seeded sample history. reviewer1 never practices in any spec (auth.spec.ts only
// signs in), so it is the account with no history; reviewer2 gets attempts from practice.spec.ts.
const DEMO_EMAIL = "demo@example.com";
const EMPTY_HISTORY_EMAIL = "reviewer1@example.com";

const SAMPLE_LABEL = "Includes sample practice history";
const NOT_ENOUGH_PRACTICE =
  "Not enough practice yet. A transition shows up here once you've played it at least 3 times.";

/** The seeded weak pairs as the report writes them. */
const WEAK_TRANSITIONS = ["C5 → C4", "C4 → E3", "B4 → F5"];

const bookSequence = listPlayableWrittenMidis(normalizeMusicXml(readFileSync(BOOK_EXERCISE.path, "utf8")));

/**
 * First-try accuracy of the demo history, as the report rounds it. The seed is deterministic
 * (seed 42; dates don't affect the numbers), so regenerate the attempts the same way.
 */
function expectedDemoAccuracyPercent(): number {
  const attempts = generateSampleAttempts(bookSequence, {
    weakPairs: SAMPLE_WEAK_PAIRS,
    attemptCount: 6,
    seed: 42,
    now: new Date(),
  });
  const report = analyzeAttempts(
    attempts.map(({ noteEvents }) => ({ exerciseId: "book", exerciseName: BOOK_EXERCISE.name, sample: true, noteEvents })),
  );
  return Math.round(report.firstTryAccuracy! * 100);
}

/** "Sample Music Sheet: notes 2, 18": every place the pair occurs, note numbers from 1. */
function expectedWhere([fromMidi, toMidi]: readonly [number, number]): string {
  const noteNumbers = bookSequence.flatMap((midi, index) =>
    index > 0 && bookSequence[index - 1] === fromMidi && midi === toMidi ? [index + 1] : [],
  );
  return `${BOOK_EXERCISE.name}: ${noteNumbers.length === 1 ? "note" : "notes"} ${noteNumbers.join(", ")}`;
}

async function signInAndOpenReport(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(seedPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();

  await page.getByRole("link", { name: "Report" }).click();
  await expect(page).toHaveURL("/report");
  await expect(page.getByRole("heading", { name: "Weak transitions" })).toBeVisible();
}

test.describe("report of weak transitions", () => {
  test("demo account sees its sample history with the seeded weak transitions on top", async ({ page }) => {
    await signInAndOpenReport(page, DEMO_EMAIL);

    await expect(page.getByText(SAMPLE_LABEL)).toBeVisible();
    await expect(page.getByText(/^Overall accuracy:/)).toHaveText(
      `Overall accuracy: ${expectedDemoAccuracyPercent()}% of notes right on the first try (438 notes, 6 attempts).`,
    );

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText(["Transition", "Missed", "Median hesitation", "Where"]);

    const rows = table.locator("tbody").getByRole("row");
    await expect(rows.first()).toBeVisible();
    const topTransitions = await rows.locator("td:first-child").evaluateAll((cells) =>
      cells.slice(0, 3).map((cell) => cell.textContent),
    );
    expect([...topTransitions].sort()).toEqual([...WEAK_TRANSITIONS].sort());

    for (const [index, name] of WEAK_TRANSITIONS.entries()) {
      const row = rows.filter({ has: page.getByRole("cell", { name, exact: true }) });
      const cells = row.getByRole("cell");
      await expect(cells.nth(1)).toHaveText(/^\d+% \(\d+ of \d+\)$/);
      await expect(cells.nth(2)).toHaveText(/^\d+\.\d s$/);
      await expect(cells.nth(3)).toHaveText(expectedWhere(SAMPLE_WEAK_PAIRS[index]));
    }
  });

  test("account without practice history sees the not-enough-practice message and no sample data", async ({
    page,
  }) => {
    await signInAndOpenReport(page, EMPTY_HISTORY_EMAIL);

    await expect(page.getByText(NOT_ENOUGH_PRACTICE)).toBeVisible();
    await expect(page.getByText(/Overall accuracy/)).toHaveCount(0);
    await expect(page.getByText(SAMPLE_LABEL)).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("back link returns to the exercise list", async ({ page }) => {
    await signInAndOpenReport(page, EMPTY_HISTORY_EMAIL);

    await page.getByRole("link", { name: "← Back to exercises" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
  });
});
