# IMPLEMENTATION PLAN — Etude Man

Read `SCOPE.md` and `TECH_SPEC.md` first. The specs record decisions; this file records how the code is organized and the order it is built in. If the two disagree, the specs win.

## Layout (one package, one Vercel project)
```
api/index.ts                   Vercel Function entry: imports and exports the Express app
vercel.json                    build command, output dir, bunVersion, function maxDuration, rewrites
assets/Sample Music Sheet.musicxml   the verified book exercise (plain treble clef, written pitch)
prisma/
  schema.prisma
  seed.ts                      reviewer accounts, book exercise, demo sample history
  seedAccounts.ts              seeded accounts and the book exercise name/path
src/shared/                    pure logic, no DOM, all unit-tested
  pitch.ts                     frequencyToNote, midiToName, written ↔ sounding, matchesTarget
  musicxml.ts                  normalizeMusicXml() to plain written pitch; buildMusicXML(notes) (Phase 6)
  detector.ts                  createNoteDetector(): onset + stable-pitch state machine (frames in, events out)
  practiceSession.ts           wait-mode state: cursor, green/red results, recorded note events
  lowNoteStability.ts          flags unstable low-note readings ("Try a different microphone.")
  attempt.ts                   Zod schema for POST /api/attempts (shared with the client)
  transitions.ts               note events → occurrences → ranked stats
  drill.ts                     Zod plan schema, range checks, deterministic fallback
src/server/
  app.ts                       Express app (API only; exported, never calls listen)
  dev.ts                       local only: app.listen for development
  db.ts                        Prisma client (driver adapter, pooled DATABASE_URL)
  auth.ts                      Better Auth instance
  requireUser.ts               session middleware + currentUser(res)
  routes/exercises.ts, attempts.ts, report.ts, omr.ts, drill.ts
src/client/                    Vite + React, React Router (declarative)
  pages/                       Login, ExerciseList, Practice (/exercises/:id), Report, Upload
  practice/                    ScoreView (OSMD), playableSequence, microphone (getUserMedia + pitchy), PracticeSession
  lib/                         authClient, api
  each component has a sibling *.test.tsx (Vitest + React Testing Library)
```

- **Dev:** Vite dev server proxies `/api` to Express running from `src/server/dev.ts`.
- **Prod (Vercel):** static output is Vite's `dist/`. `vercel.json` rewrites `/api/(.*)` to the `api/index.ts` function and everything else to `/index.html` (client-side routes). Verify the rewrite and entry setup against current Vercel docs; Vercel also has zero-config Express detection, which may make some of this unnecessary.
- **Build command:** `prisma generate && prisma migrate deploy && vite build` (migrations use the direct connection URL).
- **Function config:** `maxDuration` set explicitly (comfortably above the 25s Flat long-poll); `bunVersion: "1.x"`, dropped if Prisma misbehaves under Bun.
- **Prisma:** a single client instance per function instance, using the pooled connection URL.
- **Seed:** run locally against the hosted database: `bun prisma/seed.ts` with the production env vars.

## Key design decisions

### Normalize on store
Every MusicXML (seeded file, uploads, drills) goes through `normalize()` before it is saved:
- Treble-8vb clef (`clef-octave-change` = −1): add 12 semitones to every pitch, remove the clef octave change. Confirm against the real Flat export first.
- `transpose` element with an octave change: remove the element; pitches are already written.
- Plain treble clef: unchanged.

After that, comparison with the mic is always **sounding = written − 12**, and detected pitches are stored as written (+12).

### Detector as a pure state machine
`createNoteDetector().step(frame, target) → NoteEvent | null`, where `frame = { timeMs, rms, frequencyHz, clarity }` and `target = { writtenMidi, previousWrittenMidi }`. All thresholds live in `DEFAULT_DETECTOR_SETTINGS`; volume and onset values are placeholders to tune with real microphones.
- Clarity gate (~0.9), median of the last 5 readings.
- Onset = RMS jump above a threshold; threshold lowered for high-string targets.
- Stable window: ~50 ms for high-string targets, ~100 ms otherwise.
- At most one event per pluck (the first stable pitch).
- Previous target's pitch ignored until the next onset and for ~150 ms after each onset.
- Each pluck resets the volume history, so a sustained note can't be re-counted against the silence before it; with no history (start, after reset) nothing counts as a pluck.
- Exactly-one-octave-off counts as correct.

The React page only feeds frames from `requestAnimationFrame`. Tests use synthetic frame sequences: ringing previous note, soft pluck over a ringing note, held wrong note, repeated identical notes.

### Playable sequence
After OSMD renders, walk `cursor.Iterator` once from the start. For each step, record `{ cursorStep, writtenMidi, graphicalNote }` (top note; MIDI = `halfTone + 12`) or skip it if it is a rest, tied continuation, or grace note. In practice mode, `advance()` calls `cursor.next()` until the next playable step. Note index = position in this sequence. Color notes via `graphicalNote.getSVGGElement()` so the score never re-renders. Verified on the book exercise: 73 playable notes, `halfTone + 12` matches the file.

### Saving attempts
Events are kept in memory and POSTed once on finish or stop (attempt + events in one transaction). `navigator.sendBeacon` on `pagehide` as a best-effort fallback.

### Unstable low notes
For targets below written C4, if at least half of the loud frames in the last 1.5 s are unclear or jump between notes, show "Try a different microphone." until the next attempt. A steady wrong note doesn't count.

### Data
- Better Auth tables generated by its CLI; Exercise, Attempt, NoteEvent as in the spec.
- Notes stored as MIDI integers (written pitch); names are derived for display.
- Index on `NoteEvent(attemptId)`.

## API
| Route | Purpose |
|---|---|
| `ALL /api/auth/*` | `toNodeHandler(auth)`, mounted **before** `express.json()` |
| `GET /api/exercises` | user's exercises |
| `GET /api/exercises/:id` | one exercise with its MusicXML (scoped to the user) |
| `POST /api/attempts` | attempt + note events |
| `GET /api/report` | ranked transitions (excludes exercises with source `drill`) |
| `POST /api/omr` | create Flat job → `{ jobId }` |
| `GET /api/omr/:jobId` | one ≤25s long-poll; returns progress, or saves the normalized exercise when done |
| `POST /api/drill` | plan → validate → MusicXML → new exercise id |

`requireUser` resolves the session with `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`. Request bodies are validated with Zod.

## Build phases

### 1. Setup
Scaffold Vite + React, Tailwind, shadcn, and the Express app with a `/api/health` route; `api/index.ts` and `vercel.json` (exercised only at the final deploy).
**Done when:** the page loads locally and `/api/health` responds.

### 2. Auth + seed
Prisma, Better Auth (email/password, `disableSignUp: true`), Zod. Login page, empty exercise list, `requireUser`.
Seed (idempotent, upsert by email): through `auth.$context`, hash with `ctx.password.hash` and create or update the user and credential-account rows via `ctx.internalAdapter`. Accounts live in `prisma/seedAccounts.ts`; their shared password comes from `SEED_PASSWORD`.
Playwright: a global setup migrates and seeds the test database (`TEST_DATABASE_URL`) before the run; an end-to-end test logs in as a seeded user.
**Done when:** a seeded user logs in locally.

### 3. Practice mode
- `pitch.ts`, `musicxml.ts`, `detector.ts` with Vitest tests.
- Seed the normalized book exercise for every account.
- Practice page: OSMD render → playable sequence → **Start** button (creates AudioContext) → permission → device picker → stream (echo cancellation, noise suppression, auto gain off) → analyser → pitchy each frame → detector → cursor, coloring, live readout (note name + cents), "Try a different microphone." hint.
- Save the attempt on finish or stop.

**Done when:** the seeded exercise can be played through and the attempt is stored.

### 4. Report + sample history
- `transitions.ts` with tests: occurrences keyed by written pitch pair, missed flag, hesitation, miss rate, ≥3 occurrences, rank by miss rate then median hesitation; drill exercises excluded.
- Report page: top weak transitions, miss rate, median hesitation, overall accuracy, where each came from; sample data labeled as sample.
- Seed: ~6 sample attempts (flag `sample`) on the book exercise for the demo account, generated with a fixed random seed so 2–3 pairs are clearly weak.

**Done when:** the demo account's report shows ranked weak transitions without anyone playing.

### 5. Upload → Flat
- The browser downscales the photo and re-encodes it as JPEG (canvas) so it fits under Vercel's request body limit.
- `POST /api/omr` sends the photo to Flat in one call (MusicXML output, auto-start, auto-rotate).
- Upload page polls `GET /api/omr/:jobId` every few seconds and shows the percent and stage.
- On done: download the export, `normalize()`, save it with the user-given name, open it in practice mode.
- MusicXML fallback: the file field also accepts `.musicxml`/`.xml`; the browser sends the text to `POST /api/exercises/import`, which validates (partwise score, ≥ 1 playable note), normalizes and saves it, then opens it in practice mode.
- Errors: failed job (message + retry), 402 (insufficient credits message), timeout.

**Done when:** an uploaded photo becomes an exercise that opens in practice mode.

### 6. AI drill
- `drill.ts` with tests: Zod plan schema, written range E3–B6, deterministic fallback (A–B–A–B repeated, then the transition with its neighbors).
- `buildMusicXML`: quarter notes, 4/4, treble clef, no key signature (explicit accidentals), bar line every 4 notes, no transpose element.
- Build the deterministic drill first, then add Claude: input is the top weak transitions with miss rate, hesitation, and surrounding notes from the occurrence with the most misses; output via tool use, parsed with the Zod schema; retry once on failure, then fall back. Show the coaching explanation with the drill.
- Report page gets a "generate drill" action that opens the new exercise in practice mode.

**Done when:** a drill generated from the report opens in practice mode.

### Finish
Deploy to production on Vercel, run the seed against the hosted database, confirm demo logins on the production domain, search the code and UI for text not described in the specs, write the submission note.

## Still to gather
- Flat OMR: exact endpoints, request body, long-poll parameter, export download — from the playground session (needed for Phase 5).
- Detector thresholds from real mic tests: RMS onset jump and volume threshold per string group (placeholders in `DEFAULT_DETECTOR_SETTINGS`).

## Settled during the build
- The book exercise export uses a plain treble clef (no 8vb, no transpose): already written pitch.
- `halfTone + 12` gives the correct MIDI (checked against the book file in Chromium).
- Better Auth seed path: `auth.$context` → `password.hash`, `internalAdapter.createUser(…, { method: "admin" })`, `createAccount`, `updatePassword`.
