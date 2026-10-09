// Request body for saving a practice attempt (TECH_SPEC, Data model). Notes are written-pitch MIDI.
import { z } from "zod";

const midiNote = z.number().int().min(0).max(127);

export const noteEventSchema = z.object({
  noteIndex: z.number().int().min(0),
  expectedMidi: midiNote,
  playedMidi: midiNote,
  correct: z.boolean(),
  timestampMs: z.number().int().min(0),
});

export const saveAttemptSchema = z.object({
  exerciseId: z.string().min(1),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  completed: z.boolean(),
  // Generous upper bound: a long exercise with many misses stays well under it.
  noteEvents: z.array(noteEventSchema).max(5000),
});

export type SaveAttemptRequest = z.infer<typeof saveAttemptSchema>;
export type NoteEventRecord = z.infer<typeof noteEventSchema>;
