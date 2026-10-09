// Calms the live readout (detected note + cents). Raw readings change every audio frame
// (~60/s), which made the text flicker; this shows at most a few updates per second and keeps
// the last clear reading through brief gaps (between notes, pluck attacks).

export type Readout = { noteName: string; cents: number };

export const READOUT_UPDATE_MS = 150;
export const READOUT_HOLD_MS = 500;

export type ReadoutSmoother = {
  /** Feed every frame's reading (null = no clear pitch); returns what to display. */
  next(reading: Readout | null, timeMs: number): Readout | null;
  reset(): void;
};

export function createReadoutSmoother(): ReadoutSmoother {
  let shown: Readout | null = null;
  let shownAtMs = Number.NEGATIVE_INFINITY;
  let lastClearAtMs = Number.NEGATIVE_INFINITY;

  return {
    next(reading, timeMs) {
      if (reading) {
        lastClearAtMs = timeMs;
        if (timeMs - shownAtMs >= READOUT_UPDATE_MS) {
          shown = reading;
          shownAtMs = timeMs;
        }
      } else if (timeMs - lastClearAtMs > READOUT_HOLD_MS) {
        shown = null;
      }
      return shown;
    },
    reset() {
      shown = null;
      shownAtMs = Number.NEGATIVE_INFINITY;
      lastClearAtMs = Number.NEGATIVE_INFINITY;
    },
  };
}
