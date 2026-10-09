import { createNoteDetector, type NoteDetector, type NoteEvent, type NoteTarget } from "./detector";

const FRAME_MS = 16;
const SILENCE = 0.001;
const LOUD = 0.2;
const RINGING = 0.08;

/** Written E4 (sounds E3, MIDI 52): a normal-string target. */
const WRITTEN_E4 = 64;
/** Written G4 (sounds G3, MIDI 55). */
const WRITTEN_G4 = 67;
/** Written E5 (sounds E4, MIDI 64): a high-string target. */
const WRITTEN_E5 = 76;

type Segment = {
  durationMs: number;
  rms: number;
  /** Sounding MIDI note heard during the segment, or null for no pitch. */
  soundingMidi: number | null;
  clarity?: number;
};

function frequencyOf(soundingMidi: number) {
  return 440 * 2 ** ((soundingMidi - 69) / 12);
}

const silence = (durationMs: number): Segment => ({ durationMs, rms: SILENCE, soundingMidi: null });
const note = (soundingMidi: number, durationMs: number, rms = LOUD): Segment => ({ durationMs, rms, soundingMidi });

/** Plays segments into the detector frame by frame; returns the events and the time it ended at. */
function play(detector: NoteDetector, target: NoteTarget, segments: Segment[], startMs = 0) {
  const events: NoteEvent[] = [];
  let timeMs = startMs;
  for (const segment of segments) {
    const segmentEndMs = timeMs + segment.durationMs;
    for (; timeMs < segmentEndMs; timeMs += FRAME_MS) {
      const event = detector.step(
        {
          timeMs,
          rms: segment.rms,
          frequencyHz: segment.soundingMidi === null ? null : frequencyOf(segment.soundingMidi),
          clarity: segment.clarity ?? 0.95,
        },
        target,
      );
      if (event) events.push(event);
    }
  }
  return { events, endMs: timeMs };
}

const firstTarget = (writtenMidi: number): NoteTarget => ({ writtenMidi, previousWrittenMidi: null });

test("silence produces no events", () => {
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(1000)]);
  expect(events).toEqual([]);
});

test("a plucked correct note produces one correct event after the stable window", () => {
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(96), note(52, 400)]);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ correct: true, playedSoundingMidi: 52 });
  expect(events[0].timeMs).toBeGreaterThanOrEqual(96 + 100);
});

test("a note held for a long time produces only one event", () => {
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(96), note(52, 2000)]);
  expect(events).toHaveLength(1);
});

test("a wrong note held for a long time counts as one miss", () => {
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(96), note(53, 2000)]);
  expect(events).toEqual([expect.objectContaining({ correct: false, playedSoundingMidi: 53 })]);
});

test("a detection exactly one octave off the target counts as correct", () => {
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(96), note(64, 400)]);
  expect(events).toEqual([expect.objectContaining({ correct: true, playedSoundingMidi: 64 })]);
});

test("low-clarity readings are ignored", () => {
  const unclear: Segment = { durationMs: 400, rms: LOUD, soundingMidi: 52, clarity: 0.5 };
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(96), unclear]);
  expect(events).toEqual([]);
});

test("a single glitchy reading does not turn a correct note into a miss", () => {
  const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [
    silence(96),
    note(52, 48),
    note(59, FRAME_MS),
    note(52, 400),
  ]);
  expect(events).toEqual([expect.objectContaining({ correct: true, playedSoundingMidi: 52 })]);
});

describe("high-string targets", () => {
  const quietRms = 0.006; // between the high-string and normal volume thresholds

  test("a quiet pluck is ignored for a normal-string target", () => {
    const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E4), [silence(96), note(52, 400, quietRms)]);
    expect(events).toEqual([]);
  });

  test("the same quiet pluck is detected for a high-string target, with a shorter stable window", () => {
    const { events } = play(createNoteDetector(), firstTarget(WRITTEN_E5), [silence(96), note(64, 400, quietRms)]);
    expect(events).toEqual([expect.objectContaining({ correct: true, playedSoundingMidi: 64 })]);
    expect(events[0].timeMs).toBeLessThan(96 + 100);
  });
});

describe("the previous note ringing after the cursor advances", () => {
  function playFirstNoteCorrectly(detector: NoteDetector) {
    const first = play(detector, firstTarget(WRITTEN_E4), [silence(96), note(52, 300)]);
    expect(first.events).toEqual([expect.objectContaining({ correct: true })]);
    return first.endMs;
  }

  const nextTarget: NoteTarget = { writtenMidi: WRITTEN_G4, previousWrittenMidi: WRITTEN_E4 };

  test("never counts as a miss on the next note", () => {
    const detector = createNoteDetector();
    const startMs = playFirstNoteCorrectly(detector);
    const { events } = play(detector, nextTarget, [note(52, 1000, RINGING)], startMs);
    expect(events).toEqual([]);
  });

  test("is ignored right after a soft pluck of the next note", () => {
    const detector = createNoteDetector();
    const startMs = playFirstNoteCorrectly(detector);
    // The new pluck is louder, but for its first ~130 ms the old note still dominates the pitch.
    const { events } = play(detector, nextTarget, [note(52, 200, RINGING), note(52, 128, LOUD), note(55, 300, LOUD)], startMs);
    expect(events).toEqual([expect.objectContaining({ correct: true, playedSoundingMidi: 55 })]);
  });
});

test("repeated identical notes each need their own pluck", () => {
  const detector = createNoteDetector();
  const first = play(detector, firstTarget(WRITTEN_E4), [silence(96), note(52, 300)]);
  expect(first.events).toHaveLength(1);

  const sameNoteAgain: NoteTarget = { writtenMidi: WRITTEN_E4, previousWrittenMidi: WRITTEN_E4 };
  const ringing = play(detector, sameNoteAgain, [note(52, 500, RINGING)], first.endMs);
  expect(ringing.events).toEqual([]);

  const replucked = play(detector, sameNoteAgain, [note(52, 300, LOUD)], ringing.endMs);
  expect(replucked.events).toEqual([expect.objectContaining({ correct: true, playedSoundingMidi: 52 })]);
});

test("a miss and then a correct pluck produce two events in order", () => {
  const detector = createNoteDetector();
  const target = firstTarget(WRITTEN_E4);
  const { events } = play(detector, target, [silence(96), note(53, 300), silence(200), note(52, 300)]);
  expect(events.map((event) => event.correct)).toEqual([false, true]);
});

test("reset forgets an unfinished pluck", () => {
  const detector = createNoteDetector();
  const target = firstTarget(WRITTEN_E4);
  const plucked = play(detector, target, [silence(96), note(52, 48)]);
  detector.reset();
  const { events } = play(detector, target, [note(52, 400, RINGING)], plucked.endMs);
  expect(events).toEqual([]);
});
