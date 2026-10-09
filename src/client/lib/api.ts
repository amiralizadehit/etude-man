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
