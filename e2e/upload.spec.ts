import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { seedPassword } from "./fixtures/seedPassword";

// reviewer1 must keep only the book exercise (auth.spec.ts, report.spec.ts) and demo must stay
// untouched, so uploads happen as reviewer2. Imports accumulate in the never-reset test database,
// hence unique names.
const REVIEWER_EMAIL = "reviewer2@example.com";
const BOOK_EXERCISE_NAME = "Sample Music Sheet";
const BOOK_EXERCISE_FILE = "assets/Sample Music Sheet.musicxml";

const MESSAGES = {
  notMusicXml: "This file isn't a MusicXML score.",
  noNotes: "No notes were found in this file.",
  recognitionUnavailable:
    "Photo recognition isn't available on the connected Flat account. You can upload a MusicXML file instead, for example one exported from Flat.",
  insufficientCredits: "Your Flat account doesn't have enough credits to read this photo.",
  flatCouldNotRead: "Flat couldn't read this photo. Try a clear, well-lit photo of a single page.",
  uploadFailed: "Couldn't upload this file. Please try again.",
};

/** A valid 1×1 PNG, so the browser's createImageBitmap + canvas downscaling succeeds. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** A partwise score whose only note is a rest. */
const RESTS_ONLY_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef></attributes>
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
`;

function uniqueName(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(REVIEWER_EMAIL);
  await page.getByLabel("Password").fill(seedPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
}

async function openUploadPage(page: Page) {
  await page.getByRole("link", { name: "+ Upload an exercise" }).click();
  await expect(page).toHaveURL("/upload");
  await expect(page.getByRole("heading", { name: "Upload an exercise" })).toBeVisible();
}

/** Id of the book exercise, read from its link on the list (the page must show the list). */
async function bookExerciseId(page: Page): Promise<string> {
  const href = await page.getByRole("link", { name: BOOK_EXERCISE_NAME, exact: true }).getAttribute("href");
  const id = /^\/exercises\/([^/]+)$/.exec(href ?? "")?.[1];
  if (!id) throw new Error(`Unexpected exercise link: ${href}`);
  return id;
}

type FileToUpload = { name: string; mimeType: string; buffer: Buffer };

async function submitUpload(page: Page, exerciseName: string, file: FileToUpload) {
  await page.getByLabel("Exercise name").fill(exerciseName);
  await page.getByLabel("Photo or MusicXML file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload" }).click();
}

function photo(): FileToUpload {
  return { name: "page.png", mimeType: "image/png", buffer: TINY_PNG };
}

function musicXmlFile(name: string, content: string): FileToUpload {
  return { name, mimeType: "application/xml", buffer: Buffer.from(content) };
}

async function expectPracticePage(page: Page, exerciseName: string, exerciseId?: string) {
  await expect(page).toHaveURL(exerciseId ? `/exercises/${exerciseId}` : /\/exercises\/[^/]+$/);
  await expect(page.getByRole("heading", { name: exerciseName })).toBeVisible();
  // OSMD is the heaviest module on a cold dev server, so rendering gets extra time.
  await expect(page.getByTestId("score").locator("svg").first()).toBeVisible({ timeout: 15_000 });
}

test.describe("upload page", () => {
  test("shows the form, with Upload disabled until a file is chosen", async ({ page }) => {
    await signIn(page);
    await openUploadPage(page);

    await expect(page.getByLabel("Exercise name")).toHaveAttribute("required", "");
    const fileInput = page.getByLabel("Photo or MusicXML file");
    await expect(fileInput).toHaveAttribute("type", "file");
    await expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,.musicxml,.xml");
    await expect(fileInput).toHaveAccessibleDescription(
      "A photo of the page is read by Flat. A MusicXML file is imported as is.",
    );

    const upload = page.getByRole("button", { name: "Upload" });
    await expect(upload).toBeDisabled();
    await fileInput.setInputFiles(photo());
    await expect(upload).toBeEnabled();

    await page.getByRole("link", { name: "← Back to exercises" }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("MusicXML upload", () => {
  test("imports the file, opens its practice page, and lists it", async ({ page }) => {
    const name = uniqueName("Imported book exercise");
    await signIn(page);
    await openUploadPage(page);

    await submitUpload(
      page,
      name,
      musicXmlFile("Sample Music Sheet.musicxml", readFileSync(BOOK_EXERCISE_FILE, "utf8")),
    );
    await expectPracticePage(page, name);

    await page.getByRole("link", { name: "← Back to exercises" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  });

  test("rejects a file that isn't a MusicXML score", async ({ page }) => {
    await signIn(page);
    await openUploadPage(page);

    await submitUpload(page, uniqueName("Not a score"), musicXmlFile("page.xml", "<html><body>hi</body></html>"));

    await expect(page.getByRole("alert")).toHaveText(MESSAGES.notMusicXml);
    await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
    await expect(page).toHaveURL("/upload");
  });

  test("rejects a score without notes", async ({ page }) => {
    await signIn(page);
    await openUploadPage(page);

    await submitUpload(page, uniqueName("Only rests"), musicXmlFile("rests.musicxml", RESTS_ONLY_MUSICXML));

    await expect(page.getByRole("alert")).toHaveText(MESSAGES.noNotes);
    await expect(page).toHaveURL("/upload");
  });
});

// Flat is never called: our own OMR endpoints are stubbed at the browser boundary.
test.describe("photo upload", () => {
  test("shows Flat's progress and opens the recognized exercise", async ({ page }) => {
    await signIn(page);
    const exerciseId = await bookExerciseId(page);
    const name = uniqueName("Photo exercise");

    let postedBody: { name?: string; image?: { base64?: string; filename?: string } } | undefined;
    await page.route("**/api/omr", async (route) => {
      postedBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { uploadId: "u1" } });
    });
    let polls = 0;
    await page.route("**/api/omr/u1", async (route) => {
      polls += 1;
      await route.fulfill({
        json:
          polls === 1
            ? { status: "processing", percent: 42, stage: "Reading notes" }
            : { status: "done", exerciseId },
      });
    });

    await openUploadPage(page);
    await submitUpload(page, name, photo());

    await expect(page.getByRole("status")).toHaveText("Reading notes — 42%");
    await expectPracticePage(page, BOOK_EXERCISE_NAME, exerciseId);

    expect(postedBody?.name).toBe(name);
    expect(postedBody?.image?.filename).toBe("photo.jpg");
    expect(postedBody?.image?.base64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test("says when the Flat account can't read photos", async ({ page }) => {
    await signIn(page);
    await page.route("**/api/omr", (route) => route.fulfill({ status: 503, json: { error: "omr_not_available" } }));

    await openUploadPage(page);
    await submitUpload(page, uniqueName("Photo"), photo());

    await expect(page.getByRole("alert")).toHaveText(MESSAGES.recognitionUnavailable);
    await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  test("says when the Flat account is out of credits", async ({ page }) => {
    await signIn(page);
    await page.route("**/api/omr", (route) => route.fulfill({ status: 402, json: { error: "insufficient_credits" } }));

    await openUploadPage(page);
    await submitUpload(page, uniqueName("Photo"), photo());

    await expect(page.getByRole("alert")).toHaveText(MESSAGES.insufficientCredits);
  });

  test("shows Flat's message when it can't read the photo", async ({ page }) => {
    await signIn(page);
    await page.route("**/api/omr", (route) => route.fulfill({ status: 201, json: { uploadId: "u1" } }));
    await page.route("**/api/omr/u1", (route) =>
      route.fulfill({ json: { status: "error", message: MESSAGES.flatCouldNotRead } }),
    );

    await openUploadPage(page);
    await submitUpload(page, uniqueName("Photo"), photo());

    await expect(page.getByRole("alert")).toHaveText(MESSAGES.flatCouldNotRead);
    await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  test("says the upload failed when the file isn't a readable image", async ({ page }) => {
    await signIn(page);
    let omrCalled = false;
    await page.route("**/api/omr", (route) => {
      omrCalled = true;
      return route.fulfill({ status: 201, json: { uploadId: "u1" } });
    });

    await openUploadPage(page);
    await submitUpload(page, uniqueName("Photo"), {
      name: "broken.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not an image"),
    });

    await expect(page.getByRole("alert")).toHaveText(MESSAGES.uploadFailed);
    expect(omrCalled).toBe(false);
  });
});
