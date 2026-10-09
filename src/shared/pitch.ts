// Pitch math (TECH_SPEC, Frequency → note, Pitch convention, Matching).
// Notes are MIDI numbers. Everything stored is written pitch; guitar sounds an octave lower.

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export const OCTAVE = 12;

/** Written range for validation: E3–B6 (sounding E2–B5 in standard tuning). */
export const WRITTEN_RANGE = { lowest: 52, highest: 95 } as const;

export type DetectedNote = {
  /** Nearest semitone (sounding). */
  midi: number;
  /** Offset from that semitone, −50 to +50. */
  cents: number;
};

export function frequencyToNote(frequencyHz: number): DetectedNote {
  const exactMidi = 69 + 12 * Math.log2(frequencyHz / 440);
  const midi = Math.round(exactMidi);
  return { midi, cents: Math.round(100 * (exactMidi - midi)) };
}

export function midiToName(midi: number): string {
  const octave = Math.floor(midi / OCTAVE) - 1;
  return `${NOTE_NAMES[((midi % OCTAVE) + OCTAVE) % OCTAVE]}${octave}`;
}

export function writtenToSounding(writtenMidi: number): number {
  return writtenMidi - OCTAVE;
}

export function soundingToWritten(soundingMidi: number): number {
  return soundingMidi + OCTAVE;
}

export function isInWrittenRange(writtenMidi: number): boolean {
  return writtenMidi >= WRITTEN_RANGE.lowest && writtenMidi <= WRITTEN_RANGE.highest;
}

/**
 * Correct when the detected nearest semitone is the target, or exactly one octave off
 * (low strings often read as their first overtone).
 */
export function matchesTarget(detectedSoundingMidi: number, targetWrittenMidi: number): boolean {
  const distance = Math.abs(detectedSoundingMidi - writtenToSounding(targetWrittenMidi));
  return distance === 0 || distance === OCTAVE;
}
