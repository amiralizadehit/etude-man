import { readFileSync } from "node:fs";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { pluckTrack, steadyTone, writeWavFixture, type Pluck } from "./fixtures/audio";

// reviewer1 belongs to auth.spec.ts and demo gets sample history later, so practice uses reviewer2.
const REVIEWER_EMAIL = "reviewer2@example.com";
const EXERCISE_NAME = "Sample Music Sheet";
const BOOK_EXERCISE_FILE = "assets/Sample Music Sheet.musicxml";

const CORRECT_COLOR = "#16a34a";
const MISSED_COLOR = "#dc2626";

/** Guitar sounds an octave below written pitch. */
const OCTAVE = 12;

function seedPassword(): string {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("SEED_PASSWORD is not set (see .env.example)");
  return password;
}

type PracticeFixtures = {
  /** Absolute path of the WAV the fake microphone plays (looped); null for no microphone input. */
  microphoneWav: string | null;
};

// Chromium takes the fake microphone file as a launch flag, and launch options can't vary per
// describe block within one file, so tests with a WAV get their own browser with fake-media flags.
const test = base.extend<PracticeFixtures>({
  microphoneWav: [null, { option: true }],
  page: async ({ microphoneWav, page, playwright, headless, baseURL, viewport }, use) => {
    if (!microphoneWav) {
      await use(page);
      return;
    }
    const browser = await playwright.chromium.launch({
      headless,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${microphoneWav}`,
      ],
    });
    const context = await browser.newContext({ baseURL, viewport });
    await use(await context.newPage());
    await browser.close();
  },
});

/**
 * Written MIDI notes of the book exercise in playing order: every pitched note, chords counted
 * once by their top note, rests skipped. Read from the MusicXML so the fixture follows the file.
 */
function bookExerciseSequence(): number[] {
  const stepSemitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const xml = readFileSync(BOOK_EXERCISE_FILE, "utf8");
  const sequence: number[] = [];
  for (const [, note] of xml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)) {
    const pitch = /<step>([A-G])<\/step>\s*(?:<alter>(-?\d+)<\/alter>\s*)?<octave>(\d)<\/octave>/.exec(note);
    if (!pitch || note.includes("<grace") || note.includes('<tie type="stop"')) continue;
    const midi = (Number(pitch[3]) + 1) * 12 + stepSemitones[pitch[1]] + Number(pitch[2] ?? 0);
    if (note.includes("<chord/>")) sequence[sequence.length - 1] = Math.max(sequence[sequence.length - 1], midi);
    else sequence.push(midi);
  }
  return sequence;
}

async function openBookExercise(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(REVIEWER_EMAIL);
  await page.getByLabel("Password").fill(seedPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: EXERCISE_NAME }).click();
  await expect(page).toHaveURL(/\/exercises\/[^/]+$/);
  await expect(page.getByRole("heading", { name: EXERCISE_NAME })).toBeVisible();
  // OSMD is the heaviest module on a cold dev server, so rendering gets extra time.
  await expect(score(page).locator("svg").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Start" })).toBeEnabled();
}

function score(page: Page): Locator {
  return page.getByTestId("score");
}

/** Rendered notes (VexFlow stave notes, including rests) in score order. */
function renderedNotes(page: Page): Locator {
  return score(page).locator("g.vf-stavenote");
}

function notesColored(page: Page, color: string): Locator {
  return renderedNotes(page).filter({ has: page.locator(`path[fill="${color}"]`) });
}

/** The live readout of the detected note. */
function readout(page: Page): Locator {
  return page.locator('p.font-mono[aria-live="polite"]');
}


type SavedNoteEvent = { noteIndex: number; expectedMidi: number; playedMidi: number; correct: boolean };
type SavedAttempt = { completed: boolean; noteEvents: SavedNoteEvent[] };

/** Runs the action and returns the attempt the page posts to the API meanwhile. */
async function savedAttempt(page: Page, action: () => Promise<void>, timeout?: number): Promise<SavedAttempt> {
  const request = page.waitForRequest(
    (posted) => posted.url().endsWith("/api/attempts") && posted.method() === "POST",
    { timeout },
  );
  await action();
  return (await request).postDataJSON() as SavedAttempt;
}

/**
 * A pluck the detector counts exactly once while `targetWrittenMidi` is the expected note: held at
 * a steady level just above the detector's volume threshold for that target. Every frame then
 * stays below onset ratio × threshold. The natural-pluck test below covers loud plucks with a real
 * attack (a regression test for one pluck once being counted twice).
 */
function cleanPluck(targetWrittenMidi: number, soundingMidi: number): Pluck {
  // DEFAULT_DETECTOR_SETTINGS: high-string targets from written B4 (71) use volume 0.004 and
  // onset ratio 1.4; lower targets use 0.01 and 1.8.
  const peakRms = targetWrittenMidi >= 71 ? 0.005 : 0.015;
  return { soundingMidi, amplitude: peakRms * Math.SQRT2, decayPerSecond: 0 };
}

const sequence = bookExerciseSequence();
/** 220 Hz: sounding A3, read as written A4. */
const A4_WRITTEN_AS_SOUNDING = 57;

test.describe("practice page", () => {
  test("opens the book exercise from the list, renders the score, and goes back", async ({ page }) => {
    await openBookExercise(page);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

    await page.getByRole("link", { name: "← Back to exercises" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Exercises" })).toBeVisible();
    await expect(page.getByRole("link", { name: EXERCISE_NAME })).toBeVisible();
  });
});

test.describe("starting the microphone on a steady tone", () => {
  // A 220 Hz tone that starts once, as the fake microphone opens, and then holds (seamless loop).
  // Quiet for the same reason as cleanPluck: the first note (C5) is a high-string target.
  const { amplitude } = cleanPluck(sequence[0], A4_WRITTEN_AS_SOUNDING);
  test.use({ microphoneWav: writeWavFixture("steady-220hz.wav", steadyTone(220, 4000, amplitude)) });

  test("shows the device picker and the written note, and counts one miss", async ({ page }) => {
    await openBookExercise(page);
    await page.getByRole("button", { name: "Start" }).click();

    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
    const picker = page.getByLabel("Microphone");
    await expect(picker).toBeVisible();
    await expect(picker.locator("option").first()).toHaveText("Default");
    expect(await picker.locator("option").count()).toBeGreaterThan(1);
    await expect(readout(page)).toHaveText("A4 +0¢");

    // The first note is written C5, so the A is a miss and the cursor stays on it.
    await expect(renderedNotes(page).first().locator(`path[fill="${MISSED_COLOR}"]`).first()).toBeAttached();
    await expect(notesColored(page, MISSED_COLOR)).toHaveCount(1);
    await expect(notesColored(page, CORRECT_COLOR)).toHaveCount(0);

    const attempt = await savedAttempt(page, () => page.getByRole("button", { name: "Stop" }).click());
    await expect(page.getByRole("status")).toHaveText("Stopped. Attempt saved.");
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await expect(readout(page)).toHaveCount(0);

    expect(attempt.completed).toBe(false);
    expect(attempt.noteEvents).toEqual([
      expect.objectContaining({ noteIndex: 0, expectedMidi: 72, playedMidi: 69, correct: false }),
    ]);
  });
});

test.describe("repeated wrong plucks", () => {
  // Long silent gaps, so the readout visibly drops to "—" between plucks.
  const plucks = Array.from({ length: 4 }, () => cleanPluck(sequence[0], A4_WRITTEN_AS_SOUNDING));
  test.use({
    microphoneWav: writeWavFixture("wrong-plucks.wav", pluckTrack(plucks, { gapMs: 700, tailMs: 5000 })),
  });

  test("keep the first note red and the cursor on it", async ({ page }) => {
    await openBookExercise(page);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(renderedNotes(page).first().locator(`path[fill="${MISSED_COLOR}"]`).first()).toBeAttached();

    // Wait out one more whole pluck after the first miss: silence, the A, silence again. The
    // silence shows for only ~200 ms, so poll faster than toHaveText's backoff.
    for (const shown of [/^—$/, /^A4 [+-]\d+¢$/, /^—$/]) {
      await expect.poll(() => readout(page).textContent(), { intervals: [50] }).toMatch(shown);
    }

    const attempt = await savedAttempt(page, () => page.getByRole("button", { name: "Stop" }).click());
    await expect(page.getByRole("status")).toHaveText("Stopped. Attempt saved.");

    expect(attempt.noteEvents.length).toBeGreaterThanOrEqual(2);
    for (const event of attempt.noteEvents) {
      expect(event).toMatchObject({ noteIndex: 0, expectedMidi: 72, playedMidi: 69, correct: false });
    }
    await expect(notesColored(page, MISSED_COLOR)).toHaveCount(1);
    await expect(notesColored(page, CORRECT_COLOR)).toHaveCount(0);
  });
});

test.describe("a miss, then the right notes", () => {
  // Written A4 (wrong), then the first three notes C5 C4 E5 correctly.
  const plucks = [
    cleanPluck(sequence[0], A4_WRITTEN_AS_SOUNDING),
    ...sequence.slice(0, 3).map((writtenMidi) => cleanPluck(writtenMidi, writtenMidi - OCTAVE)),
  ];
  test.use({ microphoneWav: writeWavFixture("miss-then-first-notes.wav", pluckTrack(plucks, { tailMs: 5000 })) });

  test("leave the missed note red, turn the others green, and move the cursor on", async ({ page }) => {
    await openBookExercise(page);
    await page.getByRole("button", { name: "Start" }).click();

    const notes = renderedNotes(page);
    await expect(notes.nth(2).locator(`path[fill="${CORRECT_COLOR}"]`).first()).toBeAttached();
    await expect(notes.nth(0).locator(`path[fill="${MISSED_COLOR}"]`).first()).toBeAttached();
    await expect(notes.nth(1).locator(`path[fill="${CORRECT_COLOR}"]`).first()).toBeAttached();

    const attempt = await savedAttempt(page, () => page.getByRole("button", { name: "Stop" }).click());
    await expect(page.getByRole("status")).toHaveText("Stopped. Attempt saved.");

    expect(attempt.completed).toBe(false);
    expect(attempt.noteEvents.map((event) => [event.noteIndex, event.playedMidi, event.correct])).toEqual([
      [0, 69, false],
      [0, 72, true],
      [1, 60, true],
      [2, 76, true],
    ]);
    await expect(notesColored(page, MISSED_COLOR)).toHaveCount(1);
    await expect(notesColored(page, CORRECT_COLOR)).toHaveCount(2);
  });
});

const PLAY_THROUGH_TIMEOUT_MS = 90_000;

async function playWholeExercise(page: Page): Promise<SavedAttempt> {
  await openBookExercise(page);
  return savedAttempt(
    page,
    async () => {
      await page.getByRole("button", { name: "Start" }).click();
      await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("Finished! Attempt saved.", {
        timeout: PLAY_THROUGH_TIMEOUT_MS,
      });
    },
    PLAY_THROUGH_TIMEOUT_MS,
  );
}

async function expectEveryNoteCorrect(page: Page, attempt: SavedAttempt) {
  expect(attempt.completed).toBe(true);
  expect(attempt.noteEvents).toEqual(
    sequence.map((writtenMidi, noteIndex) =>
      expect.objectContaining({ noteIndex, expectedMidi: writtenMidi, playedMidi: writtenMidi, correct: true }),
    ),
  );
  // The 73 played notes are green; the final rest is rendered but never colored.
  await expect(notesColored(page, CORRECT_COLOR)).toHaveCount(73);
  await expect(notesColored(page, MISSED_COLOR)).toHaveCount(0);
}

test.describe("a full correct play-through", () => {
  const plucks = sequence.map((writtenMidi) => cleanPluck(writtenMidi, writtenMidi - OCTAVE));
  test.use({ microphoneWav: writeWavFixture("book-exercise-clean.wav", pluckTrack(plucks, { tailMs: 5000 })) });

  test("turns every note green and finishes the attempt", async ({ page }) => {
    test.setTimeout(120_000);
    expect(sequence).toHaveLength(73);
    expect(sequence.slice(0, 8)).toEqual([72, 60, 76, 74, 72, 71, 69, 67]);

    const attempt = await playWholeExercise(page);
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await expect(readout(page)).toHaveCount(0);
    await expectEveryNoteCorrect(page, attempt);
  });
});

test.describe("a full correct play-through with natural plucks", () => {
  // Loud plucks (peak 0.3) with a 5 ms attack and a gentle decay, closer to a real string.
  const plucks = sequence.map((writtenMidi) => ({ soundingMidi: writtenMidi - OCTAVE }));
  test.use({ microphoneWav: writeWavFixture("book-exercise-natural.wav", pluckTrack(plucks, { tailMs: 5000 })) });

  test("counts each pluck once", async ({ page }) => {
    test.setTimeout(120_000);

    const attempt = await playWholeExercise(page);
    await expectEveryNoteCorrect(page, attempt);
  });
});
