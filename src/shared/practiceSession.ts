// Wait-mode practice state (TECH_SPEC, Note events and onsets): the cursor stays on the expected
// note until it is played correctly, misses are recorded, and the cursor never moves back.
import type { NoteEventRecord } from "./attempt";
import type { NoteEvent, NoteTarget } from "./detector";
import { soundingToWritten } from "./pitch";

export type NoteResult = "correct" | "missed";

export type PracticeState = {
  /** Written MIDI note of each playable note. */
  sequence: readonly number[];
  currentIndex: number;
  /** Green if correct on the first try, red if missed at least once. */
  results: ReadonlyMap<number, NoteResult>;
  noteEvents: readonly NoteEventRecord[];
};

export function createPracticeState(sequence: readonly number[]): PracticeState {
  return { sequence, currentIndex: 0, results: new Map(), noteEvents: [] };
}

export function isFinished(state: PracticeState): boolean {
  return state.currentIndex >= state.sequence.length;
}

/** What the detector should listen for now; null once every note is played. */
export function currentTarget(state: PracticeState): NoteTarget | null {
  if (isFinished(state)) return null;
  return {
    writtenMidi: state.sequence[state.currentIndex],
    previousWrittenMidi: state.currentIndex > 0 ? state.sequence[state.currentIndex - 1] : null,
  };
}

export function applyNoteEvent(state: PracticeState, event: NoteEvent, attemptStartMs: number): PracticeState {
  if (isFinished(state)) return state;
  const index = state.currentIndex;
  const record: NoteEventRecord = {
    noteIndex: index,
    expectedMidi: state.sequence[index],
    playedMidi: soundingToWritten(event.playedSoundingMidi),
    correct: event.correct,
    timestampMs: Math.max(0, Math.round(event.timeMs - attemptStartMs)),
  };
  const results = new Map(state.results);
  results.set(index, event.correct && results.get(index) !== "missed" ? "correct" : "missed");
  return {
    ...state,
    currentIndex: event.correct ? index + 1 : index,
    results,
    noteEvents: [...state.noteEvents, record],
  };
}
