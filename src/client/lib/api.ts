import type { SaveAttemptRequest } from "../../shared/attempt";

export type ExerciseSummary = {
  id: string;
  name: string;
  source: "upload" | "seed" | "drill";
  createdAt: string;
};

export async function fetchExercises(): Promise<ExerciseSummary[]> {
  const response = await fetch("/api/exercises");
  if (!response.ok) {
    throw new Error(`GET /api/exercises failed with ${response.status}`);
  }
  const body: { exercises: ExerciseSummary[] } = await response.json();
  return body.exercises;
}

export type Exercise = Omit<ExerciseSummary, "createdAt"> & { musicXml: string };

export class NotFoundError extends Error {}

export async function fetchExercise(exerciseId: string): Promise<Exercise> {
  const response = await fetch(`/api/exercises/${encodeURIComponent(exerciseId)}`);
  if (response.status === 404) {
    throw new NotFoundError(`Exercise ${exerciseId} not found`);
  }
  if (!response.ok) {
    throw new Error(`GET /api/exercises/${exerciseId} failed with ${response.status}`);
  }
  const body: { exercise: Exercise } = await response.json();
  return body.exercise;
}

export async function saveAttempt(attempt: SaveAttemptRequest): Promise<void> {
  const response = await fetch("/api/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attempt),
  });
  if (!response.ok) {
    throw new Error(`POST /api/attempts failed with ${response.status}`);
  }
}
