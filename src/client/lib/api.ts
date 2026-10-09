import type { SaveAttemptRequest } from "../../shared/attempt";
import type { StartUploadRequest, UploadStatus } from "../../shared/omr";
import type { TransitionReport } from "../../shared/transitions";

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

export async function fetchReport(): Promise<TransitionReport> {
  const response = await fetch("/api/report");
  if (!response.ok) {
    throw new Error(`GET /api/report failed with ${response.status}`);
  }
  const body: { report: TransitionReport } = await response.json();
  return body.report;
}

export class InsufficientCreditsError extends Error {}

/** Starts reading a photo with Flat; returns the upload to poll. */
export async function startUpload(upload: StartUploadRequest): Promise<string> {
  const response = await fetch("/api/omr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(upload),
  });
  if (response.status === 402) {
    throw new InsufficientCreditsError("Not enough Flat credits");
  }
  if (!response.ok) {
    throw new Error(`POST /api/omr failed with ${response.status}`);
  }
  const body: { uploadId: string } = await response.json();
  return body.uploadId;
}

/** One poll; the server waits up to ~20 s for Flat before answering. */
export async function pollUpload(uploadId: string): Promise<UploadStatus> {
  const response = await fetch(`/api/omr/${encodeURIComponent(uploadId)}`);
  if (!response.ok) {
    throw new Error(`GET /api/omr/${uploadId} failed with ${response.status}`);
  }
  return response.json();
}
