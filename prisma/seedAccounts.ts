// Reviewer accounts (SCOPE, Demo setup). All share SEED_PASSWORD.
// The demo account gets sample practice history in Phase 4.
export const SEED_ACCOUNTS = [
  { email: "reviewer1@example.com", name: "Reviewer 1" },
  { email: "reviewer2@example.com", name: "Reviewer 2" },
  { email: "demo@example.com", name: "Demo (sample history)" },
] as const;

/** The only account with sample practice history; the others start clean. */
export const DEMO_EMAIL = "demo@example.com";

/** Transitions the sample player struggles with (written MIDI): big jumps in the book exercise. */
export const SAMPLE_WEAK_PAIRS = [
  [72, 60], // C5 → C4, octave drop
  [60, 52], // C4 → E3, down to the low E string
  [71, 77], // B4 → F5, wide jump up
] as const;

// The verified book exercise every account starts with (SCOPE, P0). Already plain written pitch.
export const BOOK_EXERCISE = {
  name: "Sample Music Sheet",
  path: new URL("../assets/Sample Music Sheet.musicxml", import.meta.url),
} as const;
