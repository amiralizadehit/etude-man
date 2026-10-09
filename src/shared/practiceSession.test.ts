import { applyNoteEvent, createPracticeState, currentTarget, isFinished, type PracticeState } from "./practiceSession";

const SEQUENCE = [72, 60, 76]; // written C5, C4, E5
const START_MS = 1000;

function play(state: PracticeState, playedWrittenMidi: number, correct: boolean, timeMs: number) {
  return applyNoteEvent(state, { correct, playedSoundingMidi: playedWrittenMidi - 12, timeMs }, START_MS);
}

test("starts on the first note with no previous note", () => {
  const state = createPracticeState(SEQUENCE);
  expect(currentTarget(state)).toEqual({ writtenMidi: 72, previousWrittenMidi: null });
  expect(isFinished(state)).toBe(false);
});

test("a correct note marks it green and moves to the next note", () => {
  const state = play(createPracticeState(SEQUENCE), 72, true, 1500);
  expect(state.results.get(0)).toBe("correct");
  expect(currentTarget(state)).toEqual({ writtenMidi: 60, previousWrittenMidi: 72 });
});

test("a miss marks the note red and keeps the cursor on it", () => {
  const state = play(createPracticeState(SEQUENCE), 74, false, 1500);
  expect(state.results.get(0)).toBe("missed");
  expect(state.currentIndex).toBe(0);
});

test("a note missed before being played correctly stays red", () => {
  let state = play(createPracticeState(SEQUENCE), 74, false, 1500);
  state = play(state, 72, true, 2000);
  expect(state.results.get(0)).toBe("missed");
  expect(state.currentIndex).toBe(1);
});

test("records every event in written pitch with time from the attempt start", () => {
  let state = play(createPracticeState(SEQUENCE), 74, false, 1500.4);
  state = play(state, 72, true, 2000);
  expect(state.noteEvents).toEqual([
    { noteIndex: 0, expectedMidi: 72, playedMidi: 74, correct: false, timestampMs: 500 },
    { noteIndex: 0, expectedMidi: 72, playedMidi: 72, correct: true, timestampMs: 1000 },
  ]);
});

test("finishes after the last note and ignores further events", () => {
  let state = createPracticeState(SEQUENCE);
  state = play(state, 72, true, 1100);
  state = play(state, 60, true, 1200);
  state = play(state, 76, true, 1300);
  expect(isFinished(state)).toBe(true);
  expect(currentTarget(state)).toBeNull();
  expect(play(state, 76, true, 1400)).toBe(state);
});

test("does not change the previous state (pure)", () => {
  const initial = createPracticeState(SEQUENCE);
  play(initial, 72, true, 1100);
  expect(initial.currentIndex).toBe(0);
  expect(initial.results.size).toBe(0);
  expect(initial.noteEvents).toEqual([]);
});
