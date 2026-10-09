import { readFileSync } from "node:fs";
import { saveAttemptSchema } from "./attempt";
import { listPlayableWrittenMidis } from "./musicxml";
import { generateSampleAttempts, type SampleHistoryOptions } from "./sampleHistory";
import { analyzeAttempts } from "./transitions";

const BOOK_SEQUENCE = listPlayableWrittenMidis(readFileSync("assets/Sample Music Sheet.musicxml", "utf8"));
const WEAK_PAIRS = [
  [72, 60],
  [60, 52],
  [71, 77],
] as const;
const OPTIONS: SampleHistoryOptions = { weakPairs: WEAK_PAIRS, attemptCount: 6, seed: 42, now: new Date("2026-10-09T18:00:00Z") };

const attempts = generateSampleAttempts(BOOK_SEQUENCE, OPTIONS);

test("is deterministic for a given seed", () => {
  expect(generateSampleAttempts(BOOK_SEQUENCE, OPTIONS)).toEqual(attempts);
  expect(generateSampleAttempts(BOOK_SEQUENCE, { ...OPTIONS, seed: 7 })).not.toEqual(attempts);
});

test("produces completed attempts a day apart, before now", () => {
  expect(attempts).toHaveLength(6);
  const days = attempts.map((attempt) => attempt.startedAt.toISOString().slice(0, 10));
  expect(days).toEqual(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]);
  for (const attempt of attempts) {
    expect(attempt.noteEvents.filter((event) => event.correct)).toHaveLength(BOOK_SEQUENCE.length);
    expect(attempt.finishedAt.getTime()).toBeGreaterThan(attempt.startedAt.getTime());
  }
});

test("every attempt is valid input for the attempts API", () => {
  for (const attempt of attempts) {
    const request = { exerciseId: "book", startedAt: attempt.startedAt.toISOString(), finishedAt: attempt.finishedAt.toISOString(), completed: true, noteEvents: attempt.noteEvents };
    expect(saveAttemptSchema.safeParse(request).success).toBe(true);
  }
});

test("events are in time order within each attempt", () => {
  for (const { noteEvents } of attempts) {
    const times = noteEvents.map((event) => event.timestampMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  }
});

test("the weak pairs come out as the top weak transitions in the report", () => {
  const report = analyzeAttempts(
    attempts.map((attempt) => ({ exerciseId: "book", exerciseName: "Sample Music Sheet", sample: true, noteEvents: attempt.noteEvents })),
  );
  const top3 = report.transitions.slice(0, 3).map((t) => [t.fromMidi, t.toMidi]);
  expect(top3).toEqual(expect.arrayContaining(WEAK_PAIRS.map((pair) => [...pair])));
  expect(report.transitions[0].missRate).toBeGreaterThan(0.3);
  expect(report.transitions[3].missRate).toBeLessThan(report.transitions[2].missRate);
});
