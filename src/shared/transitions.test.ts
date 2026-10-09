import type { NoteEventRecord } from "./attempt";
import { analyzeAttempts, MIN_OCCURRENCES, type AttemptForAnalysis } from "./transitions";

const C5 = 72;
const C4 = 60;
const E5 = 76;

type Step = { index: number; expected: number; misses?: number; correctAt?: number | null };

/** Builds an attempt from per-note steps: some misses, then a correct event at `correctAt` (null = never). */
function attempt(steps: Step[], overrides: Partial<AttemptForAnalysis> = {}): AttemptForAnalysis {
  const noteEvents: NoteEventRecord[] = [];
  for (const { index, expected, misses = 0, correctAt = index * 1000 } of steps) {
    for (let miss = 0; miss < misses; miss++) {
      noteEvents.push({ noteIndex: index, expectedMidi: expected, playedMidi: expected + 1, correct: false, timestampMs: index * 1000 - 100 + miss });
    }
    if (correctAt !== null) {
      noteEvents.push({ noteIndex: index, expectedMidi: expected, playedMidi: expected, correct: true, timestampMs: correctAt });
    }
  }
  return { exerciseId: "book", exerciseName: "Sample Music Sheet", sample: false, noteEvents, ...overrides };
}

/** C5 → C4 → E5, with options for the second note. */
const threeNotes = (second: Partial<Step> = {}) =>
  attempt([{ index: 0, expected: C5 }, { index: 1, expected: C4, ...second }, { index: 2, expected: E5 }]);

const repeat = <T,>(count: number, make: () => T) => Array.from({ length: count }, make);

test("counts one occurrence per consecutive pair per attempt, keyed by written pitch", () => {
  const report = analyzeAttempts(repeat(MIN_OCCURRENCES, () => threeNotes()));
  expect(report.transitions.map(({ fromMidi, toMidi, occurrences }) => ({ fromMidi, toMidi, occurrences }))).toEqual(
    expect.arrayContaining([
      { fromMidi: C5, toMidi: C4, occurrences: 3 },
      { fromMidi: C4, toMidi: E5, occurrences: 3 },
    ]),
  );
});

test(`ignores pairs with fewer than ${MIN_OCCURRENCES} occurrences`, () => {
  expect(analyzeAttempts(repeat(MIN_OCCURRENCES - 1, () => threeNotes())).transitions).toEqual([]);
});

test("miss rate is the share of occurrences with at least one miss, not misses per attempt", () => {
  const report = analyzeAttempts([threeNotes({ misses: 3 }), threeNotes(), threeNotes(), threeNotes({ misses: 1 })]);
  const pair = report.transitions.find((t) => t.fromMidi === C5 && t.toMidi === C4)!;
  expect(pair.missedOccurrences).toBe(2);
  expect(pair.missRate).toBe(0.5);
});

test("hesitation is the time from the first note's correct event to the second's; reported as the median", () => {
  const report = analyzeAttempts([
    threeNotes({ correctAt: 1500 }), // 1500 ms after C5 at 0
    threeNotes({ correctAt: 600 }),
    threeNotes({ correctAt: 900 }),
  ]);
  expect(report.transitions.find((t) => t.toMidi === C4)!.medianHesitationMs).toBe(900);
});

test("ranks by miss rate, then by median hesitation", () => {
  const slowButClean = repeat(3, () =>
    attempt([{ index: 0, expected: E5 }, { index: 1, expected: C5, correctAt: 3000 }]),
  );
  const fastButClean = repeat(3, () => attempt([{ index: 0, expected: C4 }, { index: 1, expected: E5, correctAt: 1200 }]));
  const missed = repeat(3, () => attempt([{ index: 0, expected: C5 }, { index: 1, expected: C4, misses: 1 }]));
  const order = analyzeAttempts([...fastButClean, ...slowButClean, ...missed]).transitions.map((t) => [t.fromMidi, t.toMidi]);
  expect(order).toEqual([
    [C5, C4],
    [E5, C5],
    [C4, E5],
  ]);
});

test("aggregates the same pair across positions and exercises, listing where it came from", () => {
  const book = attempt([{ index: 4, expected: C5 }, { index: 5, expected: C4 }]);
  const bookAgain = attempt([{ index: 0, expected: C5 }, { index: 1, expected: C4 }]);
  const upload = attempt([{ index: 7, expected: C5 }, { index: 8, expected: C4 }], { exerciseId: "up", exerciseName: "Scales" });
  const [pair] = analyzeAttempts([book, bookAgain, upload]).transitions;
  expect(pair.occurrences).toBe(3);
  expect(pair.sources).toEqual([
    { exerciseId: "book", exerciseName: "Sample Music Sheet", noteIndex: 1 },
    { exerciseId: "book", exerciseName: "Sample Music Sheet", noteIndex: 5 },
    { exerciseId: "up", exerciseName: "Scales", noteIndex: 8 },
  ]);
});

test("partial attempts count every occurrence actually reached", () => {
  // Stopped on the second note after a miss: the pair was reached and missed, with no hesitation.
  const stopped = attempt([{ index: 0, expected: C5 }, { index: 1, expected: C4, misses: 1, correctAt: null }]);
  const [pair] = analyzeAttempts([stopped, threeNotes(), threeNotes()]).transitions;
  expect(pair).toMatchObject({ fromMidi: C5, toMidi: C4, occurrences: 3, missedOccurrences: 1 });
});

test("a pair isn't an occurrence until the first note is played correctly and the second is played", () => {
  const neverLeftFirst = attempt([{ index: 0, expected: C5, misses: 2, correctAt: null }, { index: 1, expected: C4, correctAt: null }]);
  const neverPlayedSecond = attempt([{ index: 0, expected: C5 }]);
  expect(analyzeAttempts(repeat(5, () => neverLeftFirst).concat(repeat(5, () => neverPlayedSecond))).transitions).toEqual([]);
});

test("overall accuracy is the share of played notes right on the first try", () => {
  const report = analyzeAttempts([threeNotes({ misses: 1 }), threeNotes()]);
  expect(report.notesPlayed).toBe(6);
  expect(report.firstTryAccuracy).toBeCloseTo(5 / 6);
  expect(report.attemptCount).toBe(2);
});

test("an empty history has no accuracy and no transitions", () => {
  expect(analyzeAttempts([])).toEqual({ attemptCount: 0, notesPlayed: 0, firstTryAccuracy: null, includesSample: false, transitions: [] });
});

test("flags reports and transitions that include sample data", () => {
  const report = analyzeAttempts([threeNotes(), threeNotes(), { ...threeNotes(), sample: true }]);
  expect(report.includesSample).toBe(true);
  expect(report.transitions.every((t) => t.includesSample)).toBe(true);
});
