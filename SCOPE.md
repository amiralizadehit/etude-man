# SCOPE — Etude Man

## One-liner
Turn the page your guitar teacher assigned into an interactive practice session that listens to you play, finds the note-to-note transitions you struggle with, and builds a personalized drill for them.

## Who it's for
A guitar student taking lessons (me). My teacher assigns exercises from a printed method book each week. Existing apps (Yousician, Fender Play, etc.) give live feedback, but only on *their* curriculum. I want the same feedback on *my actual homework*, and I want to know exactly where I'm weak.

## The core loop
1. **Upload** a phone photo of an exercise page.
2. **Extract**: the photo is converted to sheet music (Flat.io OMR → MusicXML).
3. **Practice**: the score is rendered in the browser; a cursor waits on each note; I play into the mic; the app marks each note right or wrong.
4. **Report**: after practicing, see my weakest *transitions* (note A → note B), ranked by misses and hesitation.
5. **Drill**: AI designs a short custom exercise targeting those transitions; I practice it in the same practice mode.

## Key product insight
Mistakes usually aren't about single notes — they're about the *move between two notes* (string crossings, jumps from low to high strings, stretches). Tracking misses and hesitation per transition, and drilling those transitions in isolation and in context, is what makes practice effective. Weak spots differ per student, so the drill is personal.

## Priorities

### P0 — Core loop (must work at submission), in build order
1. Email/password auth (sign-ups disabled; demo accounts created by seed script) + deployed URL
2. One pre-loaded, verified exercise (from my book)
3. Practice mode on that exercise: rendered score, wait-mode cursor, live pitch feedback, notes colored green/red
4. Every note event recorded (expected note, played note, timestamps)

### P1 — What makes it special, in build order
5. Report page: weak transitions ranked by miss rate and hesitation, plus sample history on the demo account
6. Upload photo → Flat OMR → MusicXML saved as an exercise
7. AI-generated drill: AI designs a plan from the weak transitions; code validates it and builds the MusicXML; loads into practice mode

### P2 — Next steps (in the submission note, not built)
- Tempo mode (cursor moves at BPM; timing scored)
- Tuning check before practice; tuner needle
- Fretboard diagram for the current note
- Loop a selected section
- Progress over time per transition
- Phone-as-microphone companion mode
- Edit screen to correct OMR mistakes note by note

## Out of scope
- Chords / polyphonic detection (single-note melodies only)
- Tablature input (Flat OMR does not support it)
- Social login, email verification, password reset, public sign-up
- Native/desktop app

## Demo setup
- 2–3 seeded reviewer accounts; logins listed in the submission note.
- Every account has the verified book exercise.
- One account has **sample practice history (clearly labeled as sample)** so the report page is meaningful without a guitar; the others start clean.
- If no instrument is available, a reviewer can hum or play notes from a phone/YouTube to see detection work.

## Success criteria
A reviewer can log in, open an exercise, play (or hum) notes and watch the cursor react, see a report of weak transitions, and open a generated drill — all on the deployed URL.

## Submission note checklist
- What works / what's incomplete / how to run locally
- Demo logins; sign-ups intentionally disabled
- Prioritization rationale (practice loop first, then transition analysis; upload is an integration already validated in Flat's playground, so it came after the parts that are new)
- Pre-work disclosed: planning, tool evaluation (Flat OMR playground, pitchy playground, mic tests); all code written within the 2 hours
- OMR accuracy measured on my book page
- Noticed a hidden instruction in the assignment README aimed at AI assistants; did not act on it
