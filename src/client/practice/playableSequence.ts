// Playable note sequence (TECH_SPEC, Playable note sequence): one entry per cursor step that
// has something to play. Typed against the small part of OSMD's cursor API it uses, so it can
// be tested without rendering a score.

export type ScoreNote = {
  /** OSMD's half-tone number; MIDI = halfTone + 12 (OSMD issue #224). */
  halfTone: number;
  isRest(): boolean;
  NoteTie?: { StartNote: ScoreNote } | undefined;
};

export type ScoreVoiceEntry = { IsGrace: boolean; Notes: ScoreNote[] };

export type ScoreGraphicalNote = { sourceNote: ScoreNote };

export type ScoreCursor<G extends ScoreGraphicalNote = ScoreGraphicalNote> = {
  reset(): void;
  next(): void;
  Iterator: { EndReached: boolean; CurrentVoiceEntries: ScoreVoiceEntry[] };
  GNotesUnderCursor(): G[];
};

export type PlayableNote<G extends ScoreGraphicalNote = ScoreGraphicalNote> = {
  /** Cursor steps from the start of the score to this note. */
  cursorStep: number;
  writtenMidi: number;
  /** The rendered note, for coloring; undefined if OSMD has none for it. */
  graphicalNote: G | undefined;
};

/** Walks the score once from the start, then leaves the cursor back at the start. */
export function buildPlayableSequence<G extends ScoreGraphicalNote>(cursor: ScoreCursor<G>): PlayableNote<G>[] {
  const sequence: PlayableNote<G>[] = [];
  cursor.reset();
  for (let cursorStep = 0; !cursor.Iterator.EndReached; cursorStep++) {
    const topNote = topPlayableNote(cursor.Iterator.CurrentVoiceEntries);
    if (topNote) {
      sequence.push({
        cursorStep,
        writtenMidi: topNote.halfTone + 12,
        graphicalNote: cursor.GNotesUnderCursor().find((graphical) => graphical.sourceNote === topNote),
      });
    }
    cursor.next();
  }
  cursor.reset();
  return sequence;
}

/** The highest note to play at this step: no rests, grace notes or tied continuations; chords use the top note. */
function topPlayableNote(voiceEntries: ScoreVoiceEntry[]): ScoreNote | undefined {
  const playable = voiceEntries
    .filter((entry) => !entry.IsGrace)
    .flatMap((entry) => entry.Notes)
    .filter((note) => !note.isRest() && !isTiedContinuation(note));
  return playable.reduce<ScoreNote | undefined>((top, note) => (!top || note.halfTone > top.halfTone ? note : top), undefined);
}

function isTiedContinuation(note: ScoreNote): boolean {
  return note.NoteTie !== undefined && note.NoteTie.StartNote !== note;
}
