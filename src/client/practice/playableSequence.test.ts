import { buildPlayableSequence, type ScoreCursor, type ScoreNote, type ScoreVoiceEntry } from "./playableSequence";

function note(midi: number, options: { rest?: boolean; tiedFrom?: ScoreNote } = {}): ScoreNote {
  const scoreNote: ScoreNote = { halfTone: midi - 12, isRest: () => options.rest ?? false };
  if (options.tiedFrom) scoreNote.NoteTie = { StartNote: options.tiedFrom };
  return scoreNote;
}

const entry = (notes: ScoreNote[], isGrace = false): ScoreVoiceEntry => ({ IsGrace: isGrace, Notes: notes });

/** A fake cursor over a list of steps; each step is the voice entries under the cursor. */
function fakeCursor(steps: ScoreVoiceEntry[][]) {
  let position = 0;
  const cursor = {
    reset() {
      position = 0;
    },
    next() {
      position++;
    },
    Iterator: {
      get EndReached() {
        return position >= steps.length;
      },
      get CurrentVoiceEntries() {
        return steps[position];
      },
    },
    GNotesUnderCursor() {
      return steps[position].flatMap((voiceEntry) => voiceEntry.Notes.map((sourceNote) => ({ sourceNote, step: position })));
    },
    get position() {
      return position;
    },
  };
  return cursor satisfies ScoreCursor<{ sourceNote: ScoreNote; step: number }>;
}

const midis = (cursor: ScoreCursor) => buildPlayableSequence(cursor).map((playable) => playable.writtenMidi);

test("lists single notes in order with their cursor steps", () => {
  const sequence = buildPlayableSequence(fakeCursor([[entry([note(72)])], [entry([note(60)])], [entry([note(76)])]]));
  expect(sequence.map(({ cursorStep, writtenMidi }) => ({ cursorStep, writtenMidi }))).toEqual([
    { cursorStep: 0, writtenMidi: 72 },
    { cursorStep: 1, writtenMidi: 60 },
    { cursorStep: 2, writtenMidi: 76 },
  ]);
});

test("skips rests but keeps counting cursor steps", () => {
  const sequence = buildPlayableSequence(fakeCursor([[entry([note(72)])], [entry([note(0, { rest: true })])], [entry([note(60)])]]));
  expect(sequence.map((playable) => playable.cursorStep)).toEqual([0, 2]);
});

test("skips tied continuation notes", () => {
  const tieStart = note(67);
  tieStart.NoteTie = { StartNote: tieStart };
  expect(midis(fakeCursor([[entry([tieStart])], [entry([note(67, { tiedFrom: tieStart })])], [entry([note(69)])]]))).toEqual([
    67, 69,
  ]);
});

test("skips grace notes", () => {
  expect(midis(fakeCursor([[entry([note(74)], true), entry([note(72)])], [entry([note(71)], true)]]))).toEqual([72]);
});

test("uses the top note of a chord or double-stop", () => {
  expect(midis(fakeCursor([[entry([note(72), note(60)])], [entry([note(55)]), entry([note(64)])]]))).toEqual([72, 64]);
});

test("links each playable note to its rendered note for coloring", () => {
  const [first] = buildPlayableSequence(fakeCursor([[entry([note(60), note(72)])]]));
  expect(first.graphicalNote?.sourceNote.halfTone).toBe(72 - 12);
});

test("leaves the cursor back at the start", () => {
  const cursor = fakeCursor([[entry([note(72)])], [entry([note(60)])]]);
  buildPlayableSequence(cursor);
  expect(cursor.position).toBe(0);
});
