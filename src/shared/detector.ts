// Note detection (TECH_SPEC, Pitch detection parameters; Note events and onsets).
// A pure state machine: feed it one audio frame at a time with the current target, and it
// returns a note event (correct or miss) when the player plucks and holds a stable pitch.
import { frequencyToNote, matchesTarget } from "./pitch";

export type AudioFrame = {
  timeMs: number;
  /** Root-mean-square volume of the frame, 0–1. */
  rms: number;
  /** Pitch estimate, or null when the detector found none. */
  frequencyHz: number | null;
  /** Pitch confidence from the detector (pitchy clarity), 0–1. */
  clarity: number;
};

export type NoteTarget = {
  writtenMidi: number;
  /** The previous target, which may still be ringing; null at the start. */
  previousWrittenMidi: number | null;
};

export type NoteEvent = {
  correct: boolean;
  playedSoundingMidi: number;
  timeMs: number;
};

export type DetectorSettings = {
  clarityThreshold: number;
  /** Number of readings in the median filter. */
  smoothingReadings: number;
  stableMs: number;
  highStringStableMs: number;
  /** Minimum RMS for a pluck or a pitch reading to count. */
  volumeThreshold: number;
  highStringVolumeThreshold: number;
  /** A pluck is a frame at least this many times louder than the quietest recent frame. */
  onsetRatio: number;
  highStringOnsetRatio: number;
  onsetLookbackMs: number;
  /** Minimum gap between two plucks, so one attack isn't counted twice. */
  onsetRefractoryMs: number;
  /** After a pluck, the previous target's pitch is ignored for this long. */
  previousNoteIgnoreMs: number;
  /** Targets at or above this written pitch are treated as high-string (B and high E) notes. */
  highStringFromWrittenMidi: number;
};

// Clarity, smoothing, stable windows and the ignore window come from the pre-build mic tests.
// Volume and onset values are starting points to tune against real microphones.
export const DEFAULT_DETECTOR_SETTINGS: DetectorSettings = {
  clarityThreshold: 0.9,
  smoothingReadings: 5,
  stableMs: 100,
  highStringStableMs: 50,
  volumeThreshold: 0.01,
  highStringVolumeThreshold: 0.004,
  onsetRatio: 1.8,
  highStringOnsetRatio: 1.4,
  onsetLookbackMs: 100,
  onsetRefractoryMs: 80,
  previousNoteIgnoreMs: 150,
  highStringFromWrittenMidi: 71, // B4 written = open B string
};

export type NoteDetector = {
  step(frame: AudioFrame, target: NoteTarget): NoteEvent | null;
  reset(): void;
};

export function createNoteDetector(settings: DetectorSettings = DEFAULT_DETECTOR_SETTINGS): NoteDetector {
  let volumeHistory: { timeMs: number; rms: number }[] = [];
  let lastOnsetMs = Number.NEGATIVE_INFINITY;
  // True from a pluck until that pluck has produced its one event.
  let isAwaitingEvent = false;
  let readings: number[] = [];
  let stableMidi: number | null = null;
  let stableSinceMs = 0;

  function reset() {
    volumeHistory = [];
    lastOnsetMs = Number.NEGATIVE_INFINITY;
    isAwaitingEvent = false;
    clearReadings();
  }

  function clearReadings() {
    readings = [];
    stableMidi = null;
  }

  function isOnset(frame: AudioFrame, isHighString: boolean): boolean {
    const volumeThreshold = isHighString ? settings.highStringVolumeThreshold : settings.volumeThreshold;
    const onsetRatio = isHighString ? settings.highStringOnsetRatio : settings.onsetRatio;
    if (frame.rms < volumeThreshold || frame.timeMs - lastOnsetMs < settings.onsetRefractoryMs) {
      return false;
    }
    // With no recent history (start or right after reset) there is nothing to rise above.
    if (volumeHistory.length === 0) return false;
    const quietestRecentRms = Math.min(...volumeHistory.map((entry) => entry.rms));
    return frame.rms >= quietestRecentRms * onsetRatio;
  }

  function rememberVolume(frame: AudioFrame) {
    volumeHistory.push({ timeMs: frame.timeMs, rms: frame.rms });
    volumeHistory = volumeHistory.filter((entry) => frame.timeMs - entry.timeMs <= settings.onsetLookbackMs);
  }

  /** The smoothed sounding MIDI note for this frame, or null if the frame has no usable pitch. */
  function smoothedMidi(frame: AudioFrame, isHighString: boolean): number | null {
    const volumeThreshold = isHighString ? settings.highStringVolumeThreshold : settings.volumeThreshold;
    if (frame.frequencyHz === null || frame.clarity < settings.clarityThreshold || frame.rms < volumeThreshold) {
      return null;
    }
    readings = [...readings, frequencyToNote(frame.frequencyHz).midi].slice(-settings.smoothingReadings);
    return median(readings);
  }

  function isPreviousNoteEcho(midi: number, target: NoteTarget, timeMs: number): boolean {
    const previous = target.previousWrittenMidi;
    return (
      previous !== null &&
      previous !== target.writtenMidi &&
      timeMs - lastOnsetMs < settings.previousNoteIgnoreMs &&
      matchesTarget(midi, previous)
    );
  }

  function step(frame: AudioFrame, target: NoteTarget): NoteEvent | null {
    const isHighString = target.writtenMidi >= settings.highStringFromWrittenMidi;
    if (isOnset(frame, isHighString)) {
      lastOnsetMs = frame.timeMs;
      isAwaitingEvent = true;
      clearReadings();
      // The next pluck must rise above what follows this one, not the silence before it.
      volumeHistory = [];
    }
    rememberVolume(frame);
    if (!isAwaitingEvent) return null;

    const midi = smoothedMidi(frame, isHighString);
    if (midi === null) {
      stableMidi = null;
      return null;
    }
    if (midi !== stableMidi) {
      stableMidi = midi;
      stableSinceMs = frame.timeMs;
      return null;
    }
    const stableWindowMs = isHighString ? settings.highStringStableMs : settings.stableMs;
    if (frame.timeMs - stableSinceMs < stableWindowMs || isPreviousNoteEcho(midi, target, frame.timeMs)) {
      return null;
    }

    isAwaitingEvent = false;
    return { correct: matchesTarget(midi, target.writtenMidi), playedSoundingMidi: midi, timeMs: frame.timeMs };
  }

  return { step, reset };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
