import {
  frequencyToNote,
  isInWrittenRange,
  matchesTarget,
  midiToName,
  soundingToWritten,
  writtenToSounding,
} from "./pitch";

describe("frequencyToNote", () => {
  test.each([
    [440, 69],
    [82.41, 40], // low E string (E2)
    [329.63, 64], // high E string (E4)
    [261.63, 60], // middle C
  ])("%f Hz is MIDI %i with ~0 cents", (frequencyHz, midi) => {
    const note = frequencyToNote(frequencyHz);
    expect(note.midi).toBe(midi);
    expect(Math.abs(note.cents)).toBeLessThanOrEqual(1);
  });

  test("reports cents offset from the nearest semitone", () => {
    expect(frequencyToNote(440 * 2 ** (20 / 1200)).cents).toBe(20);
    expect(frequencyToNote(440 * 2 ** (-30 / 1200)).cents).toBe(-30);
  });

  test("rounds to the nearest semitone past 50 cents", () => {
    const note = frequencyToNote(440 * 2 ** (60 / 1200));
    expect(note.midi).toBe(70);
    expect(note.cents).toBe(-40);
  });
});

describe("midiToName", () => {
  test.each([
    [69, "A4"],
    [60, "C4"],
    [40, "E2"],
    [61, "C#4"],
    [95, "B6"],
  ])("MIDI %i is %s", (midi, name) => {
    expect(midiToName(midi)).toBe(name);
  });
});

describe("written and sounding pitch", () => {
  test("guitar sounds an octave below written", () => {
    expect(writtenToSounding(64)).toBe(52);
    expect(soundingToWritten(52)).toBe(64);
  });

  test("written range is E3 to B6", () => {
    expect(isInWrittenRange(52)).toBe(true);
    expect(isInWrittenRange(95)).toBe(true);
    expect(isInWrittenRange(51)).toBe(false);
    expect(isInWrittenRange(96)).toBe(false);
  });
});

describe("matchesTarget", () => {
  const writtenE4 = 64; // sounds E3 (52)

  test("matches the sounding target exactly", () => {
    expect(matchesTarget(52, writtenE4)).toBe(true);
  });

  test("forgives exactly one octave off in either direction", () => {
    expect(matchesTarget(64, writtenE4)).toBe(true);
    expect(matchesTarget(40, writtenE4)).toBe(true);
  });

  test("rejects other notes, including two octaves off", () => {
    expect(matchesTarget(53, writtenE4)).toBe(false);
    expect(matchesTarget(51, writtenE4)).toBe(false);
    expect(matchesTarget(76, writtenE4)).toBe(false);
    expect(matchesTarget(64 - 1, writtenE4)).toBe(false);
  });
});
