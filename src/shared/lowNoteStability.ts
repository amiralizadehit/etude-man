// Detects when low notes read unstably (TECH_SPEC: show "Try a different microphone."). Some
// microphones, especially voice headsets, pick up the low strings poorly: while the player is
// clearly playing, readings are unclear or jump between notes. A steady wrong note is a playing
// mistake, not a microphone problem, so it does not count.
import { DEFAULT_DETECTOR_SETTINGS, type AudioFrame } from "./detector";
import { frequencyToNote } from "./pitch";

export type StabilitySettings = {
  /** Targets below this written pitch count as low notes (low E and A strings). */
  lowNoteBelowWrittenMidi: number;
  windowMs: number;
  /** Loud frames needed in the window before judging (~0.3 s at 60 frames/s). */
  minLoudFrames: number;
  /** Share of loud frames that must be unstable. */
  unstableShare: number;
  volumeThreshold: number;
  clarityThreshold: number;
};

export const DEFAULT_STABILITY_SETTINGS: StabilitySettings = {
  lowNoteBelowWrittenMidi: 60, // C4 written
  windowMs: 1500,
  minLoudFrames: 18,
  unstableShare: 0.5,
  volumeThreshold: DEFAULT_DETECTOR_SETTINGS.volumeThreshold,
  clarityThreshold: DEFAULT_DETECTOR_SETTINGS.clarityThreshold,
};

type LoudFrame = { timeMs: number; isUnstable: boolean };

export type LowNoteStabilityMonitor = {
  /** Returns true when low notes are currently reading unstably. */
  step(frame: AudioFrame, targetWrittenMidi: number): boolean;
  reset(): void;
};

export function createLowNoteStabilityMonitor(
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): LowNoteStabilityMonitor {
  let loudFrames: LoudFrame[] = [];
  let previousReading: number | null = null;

  function reset() {
    loudFrames = [];
    previousReading = null;
  }

  function step(frame: AudioFrame, targetWrittenMidi: number): boolean {
    if (targetWrittenMidi >= settings.lowNoteBelowWrittenMidi) {
      reset();
      return false;
    }
    if (frame.rms < settings.volumeThreshold) return false;

    const reading = readingOf(frame);
    const isUnstable = reading === null || (previousReading !== null && reading !== previousReading);
    previousReading = reading;
    loudFrames = [...loudFrames, { timeMs: frame.timeMs, isUnstable }].filter(
      (loud) => frame.timeMs - loud.timeMs <= settings.windowMs,
    );

    if (loudFrames.length < settings.minLoudFrames) return false;
    const unstableCount = loudFrames.filter((loud) => loud.isUnstable).length;
    return unstableCount / loudFrames.length >= settings.unstableShare;
  }

  function readingOf(frame: AudioFrame): number | null {
    if (frame.frequencyHz === null || frame.clarity < settings.clarityThreshold) return null;
    return frequencyToNote(frame.frequencyHz).midi;
  }

  return { step, reset };
}
