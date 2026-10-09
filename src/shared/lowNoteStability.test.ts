import type { AudioFrame } from "./detector";
import { createLowNoteStabilityMonitor, type LowNoteStabilityMonitor } from "./lowNoteStability";

const FRAME_MS = 16;
const WRITTEN_E3 = 52; // low E string
const WRITTEN_E5 = 76; // high E string

function frequencyOf(soundingMidi: number) {
  return 440 * 2 ** ((soundingMidi - 69) / 12);
}

/** Feeds frames for `durationMs`; `frameAt(i)` describes frame i. Returns the last result. */
function feed(monitor: LowNoteStabilityMonitor, target: number, durationMs: number, frameAt: (i: number) => Partial<AudioFrame>) {
  let isUnstable = false;
  for (let i = 0; i * FRAME_MS < durationMs; i++) {
    const frame: AudioFrame = { timeMs: i * FRAME_MS, rms: 0.2, frequencyHz: frequencyOf(40), clarity: 0.95, ...frameAt(i) };
    isUnstable = monitor.step(frame, target);
  }
  return isUnstable;
}

test("a steady low note is stable", () => {
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E3, 1000, () => ({}))).toBe(false);
});

test("a steady wrong low note is a playing mistake, not instability", () => {
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E3, 1000, () => ({ frequencyHz: frequencyOf(41) }))).toBe(false);
});

test("loud but unclear readings on a low note are unstable", () => {
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E3, 1000, () => ({ clarity: 0.6 }))).toBe(true);
});

test("readings that jump between notes on a low note are unstable", () => {
  const jumping = (i: number) => ({ frequencyHz: frequencyOf(i % 2 === 0 ? 40 : 52 + (i % 3)) });
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E3, 1000, jumping)).toBe(true);
});

test("high-string targets are never flagged", () => {
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E5, 1000, () => ({ clarity: 0.6 }))).toBe(false);
});

test("quiet frames (not playing) are ignored", () => {
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E3, 1000, () => ({ rms: 0.001, clarity: 0.1 }))).toBe(false);
});

test("needs enough loud frames before judging", () => {
  expect(feed(createLowNoteStabilityMonitor(), WRITTEN_E3, 200, () => ({ clarity: 0.6 }))).toBe(false);
});
