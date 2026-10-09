import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchExercises, type ExerciseSummary } from "@/lib/api";
import { authClient } from "@/lib/authClient";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; exercises: ExerciseSummary[] };

export default function ExerciseListPage({ userEmail }: { userEmail: string }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;
    fetchExercises()
      .then((exercises) => isCurrent && setLoadState({ status: "loaded", exercises }))
      .catch(() => isCurrent && setLoadState({ status: "error" }));
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Exercises</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{userEmail}</span>
          <Button variant="outline" size="sm" onClick={() => authClient.signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <ExerciseListContent loadState={loadState} />
    </main>
  );
}

function ExerciseListContent({ loadState }: { loadState: LoadState }) {
  if (loadState.status === "loading") return <p>Loading exercises…</p>;
  if (loadState.status === "error") return <p role="alert">Couldn't load your exercises.</p>;
  if (loadState.exercises.length === 0) return <p>No exercises yet.</p>;
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {loadState.exercises.map((exercise) => (
        <li key={exercise.id} className="p-3">
          {exercise.name}
        </li>
      ))}
    </ul>
  );
}
