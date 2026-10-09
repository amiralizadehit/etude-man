import { saveAttemptSchema } from "./attempt";

const validAttempt = {
  exerciseId: "exercise-1",
  startedAt: "2026-10-09T10:00:00.000Z",
  finishedAt: "2026-10-09T10:01:30.000Z",
  completed: true,
  noteEvents: [
    { noteIndex: 0, expectedMidi: 64, playedMidi: 65, correct: false, timestampMs: 900 },
    { noteIndex: 0, expectedMidi: 64, playedMidi: 64, correct: true, timestampMs: 1500 },
  ],
};

test("accepts a well-formed attempt", () => {
  expect(saveAttemptSchema.safeParse(validAttempt).success).toBe(true);
});

test("accepts an attempt with no events (stopped before playing)", () => {
  expect(saveAttemptSchema.safeParse({ ...validAttempt, noteEvents: [], completed: false }).success).toBe(true);
});

test.each([
  ["a non-integer note", { expectedMidi: 64.5 }],
  ["a note outside MIDI range", { playedMidi: 128 }],
  ["a negative note index", { noteIndex: -1 }],
  ["a negative timestamp", { timestampMs: -5 }],
])("rejects an event with %s", (_description, override) => {
  const attempt = { ...validAttempt, noteEvents: [{ ...validAttempt.noteEvents[0], ...override }] };
  expect(saveAttemptSchema.safeParse(attempt).success).toBe(false);
});

test("rejects timestamps that are not ISO date-times", () => {
  expect(saveAttemptSchema.safeParse({ ...validAttempt, startedAt: "yesterday" }).success).toBe(false);
});

test("rejects more than 5000 events", () => {
  const noteEvents = Array.from({ length: 5001 }, () => validAttempt.noteEvents[1]);
  expect(saveAttemptSchema.safeParse({ ...validAttempt, noteEvents }).success).toBe(false);
});
