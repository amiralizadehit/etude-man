// Reviewer accounts (SCOPE, Demo setup). All share SEED_PASSWORD.
// The demo account gets sample practice history in Phase 4.
export const SEED_ACCOUNTS = [
  { email: "reviewer1@example.com", name: "Reviewer 1" },
  { email: "reviewer2@example.com", name: "Reviewer 2" },
  { email: "demo@example.com", name: "Demo (sample history)" },
] as const;
