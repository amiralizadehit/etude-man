// Transition analysis (TECH_SPEC, Transition analysis): per written-pitch pair, how often the
// player missed the second note and how long they took to get from the first to the second.
import type { NoteEventRecord } from "./attempt";

export const MIN_OCCURRENCES = 3;

export type AttemptForAnalysis = {
  exerciseId: string;
  exerciseName: string;
  sample: boolean;
  /** In the order they were played. */
  noteEvents: readonly NoteEventRecord[];
};

export type TransitionSource = { exerciseId: string; exerciseName: string; /** Index of the second note. */ noteIndex: number };

export type TransitionStats = {
  fromMidi: number;
  toMidi: number;
  occurrences: number;
  missedOccurrences: number;
  /** Share of occurrences with at least one miss on the second note, 0–1. */
  missRate: number;
  /** Null when no occurrence reached the second note's correct event. */
  medianHesitationMs: number | null;
  sources: TransitionSource[];
  includesSample: boolean;
};

export type TransitionReport = {
  attemptCount: number;
  notesPlayed: number;
  /** Share of played notes that were right on the first try; null when nothing was played. */
  firstTryAccuracy: number | null;
  includesSample: boolean;
  /** Pairs with at least MIN_OCCURRENCES occurrences, weakest first. */
  transitions: TransitionStats[];
};

type PlayedNote = { expectedMidi: number; events: NoteEventRecord[]; correctAtMs: number | null };

type Occurrence = { key: string; fromMidi: number; toMidi: number; missed: boolean; hesitationMs: number | null; source: TransitionSource; sample: boolean };

export function analyzeAttempts(attempts: readonly AttemptForAnalysis[]): TransitionReport {
  const playedNotes = attempts.flatMap((attempt) => [...notesByIndex(attempt.noteEvents).values()]);
  const firstTryCorrect = playedNotes.filter((note) => note.events[0].correct).length;
  return {
    attemptCount: attempts.length,
    notesPlayed: playedNotes.length,
    firstTryAccuracy: playedNotes.length > 0 ? firstTryCorrect / playedNotes.length : null,
    includesSample: attempts.some((attempt) => attempt.sample),
    transitions: rankTransitions(attempts.flatMap(occurrencesIn)),
  };
}

function notesByIndex(noteEvents: readonly NoteEventRecord[]): Map<number, PlayedNote> {
  const notes = new Map<number, PlayedNote>();
  for (const event of noteEvents) {
    const note = notes.get(event.noteIndex) ?? { expectedMidi: event.expectedMidi, events: [], correctAtMs: null };
    note.events.push(event);
    if (event.correct && note.correctAtMs === null) note.correctAtMs = event.timestampMs;
    notes.set(event.noteIndex, note);
  }
  return notes;
}

/** An occurrence: the first note was played correctly (cursor moved on) and the second was played at least once. */
function occurrencesIn(attempt: AttemptForAnalysis): Occurrence[] {
  const notes = notesByIndex(attempt.noteEvents);
  const occurrences: Occurrence[] = [];
  for (const [index, second] of notes) {
    const first = notes.get(index - 1);
    if (!first || first.correctAtMs === null) continue;
    occurrences.push({
      key: `${first.expectedMidi}->${second.expectedMidi}`,
      fromMidi: first.expectedMidi,
      toMidi: second.expectedMidi,
      missed: second.events.some((event) => !event.correct),
      hesitationMs: second.correctAtMs === null ? null : second.correctAtMs - first.correctAtMs,
      source: { exerciseId: attempt.exerciseId, exerciseName: attempt.exerciseName, noteIndex: index },
      sample: attempt.sample,
    });
  }
  return occurrences;
}

function rankTransitions(occurrences: Occurrence[]): TransitionStats[] {
  const byPair = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    byPair.set(occurrence.key, [...(byPair.get(occurrence.key) ?? []), occurrence]);
  }
  return [...byPair.values()]
    .filter((pairOccurrences) => pairOccurrences.length >= MIN_OCCURRENCES)
    .map(summarize)
    .sort(
      (a, b) =>
        b.missRate - a.missRate || (b.medianHesitationMs ?? -1) - (a.medianHesitationMs ?? -1),
    );
}

function summarize(occurrences: Occurrence[]): TransitionStats {
  const missedOccurrences = occurrences.filter((occurrence) => occurrence.missed).length;
  const hesitations = occurrences.flatMap((occurrence) => (occurrence.hesitationMs === null ? [] : [occurrence.hesitationMs]));
  return {
    fromMidi: occurrences[0].fromMidi,
    toMidi: occurrences[0].toMidi,
    occurrences: occurrences.length,
    missedOccurrences,
    missRate: missedOccurrences / occurrences.length,
    medianHesitationMs: hesitations.length > 0 ? median(hesitations) : null,
    sources: uniqueSources(occurrences.map((occurrence) => occurrence.source)),
    includesSample: occurrences.some((occurrence) => occurrence.sample),
  };
}

function uniqueSources(sources: TransitionSource[]): TransitionSource[] {
  const unique = new Map(sources.map((source) => [`${source.exerciseId}#${source.noteIndex}`, source]));
  return [...unique.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.noteIndex - b.noteIndex);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
