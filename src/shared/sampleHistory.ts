// Sample practice history for the demo account (SCOPE, Demo setup), so the report is meaningful
// without a guitar. Deterministic: the same seed always produces the same attempts.
import type { NoteEventRecord } from "./attempt";

export type SampleAttempt = {
  startedAt: Date;
  finishedAt: Date;
  noteEvents: NoteEventRecord[];
};

export type SampleHistoryOptions = {
  /** Written-pitch pairs the sample player struggles with. */
  weakPairs: readonly (readonly [number, number])[];
  attemptCount: number;
  seed: number;
  /** The last attempt happens the day before this date; earlier ones a day apart before it. */
  now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_NOTE_DELAY_MS = 800;

export function generateSampleAttempts(sequence: readonly number[], options: SampleHistoryOptions): SampleAttempt[] {
  const random = mulberry32(options.seed);
  const isWeakPair = (from: number, to: number) => options.weakPairs.some(([a, b]) => a === from && b === to);

  return Array.from({ length: options.attemptCount }, (_, attemptNumber) => {
    // Weak spots improve a little with each attempt.
    const practiceBonus = attemptNumber * 0.05;
    const noteEvents: NoteEventRecord[] = [];
    let timeMs = FIRST_NOTE_DELAY_MS;

    sequence.forEach((expectedMidi, noteIndex) => {
      const isWeak = noteIndex > 0 && isWeakPair(sequence[noteIndex - 1], expectedMidi);
      const hesitationMs = noteIndex === 0 ? 0 : isWeak ? 1400 + random() * 700 : 550 + random() * 250;
      const missCount = isWeak
        ? (random() < 0.65 - practiceBonus ? 1 : 0) + (random() < 0.25 ? 1 : 0)
        : random() < 0.04
          ? 1
          : 0;

      for (let miss = 1; miss <= missCount; miss++) {
        const wrongBy = (random() < 0.5 ? 1 : -1) * (random() < 0.6 ? 1 : 2);
        noteEvents.push({
          noteIndex,
          expectedMidi,
          playedMidi: expectedMidi + wrongBy,
          correct: false,
          timestampMs: Math.round(timeMs + (hesitationMs * miss) / (missCount + 1)),
        });
      }
      timeMs += hesitationMs;
      noteEvents.push({ noteIndex, expectedMidi, playedMidi: expectedMidi, correct: true, timestampMs: Math.round(timeMs) });
    });

    const startedAt = new Date(options.now.getTime() - (options.attemptCount - attemptNumber) * DAY_MS);
    return { startedAt, finishedAt: new Date(startedAt.getTime() + timeMs + 500), noteEvents };
  });
}

/** Small seeded PRNG (mulberry32): uniform numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
