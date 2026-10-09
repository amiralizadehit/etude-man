import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { fetchExercises, type ExerciseSummary } from "@/lib/api";
import { authClient } from "@/lib/authClient";
import guitarSketch from "../../../assets/guitar.jpg";

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
    <main className="mx-auto grid max-w-5xl gap-x-16 px-4 py-6 md:grid-cols-[minmax(0,1fr)_14rem] md:py-10">
      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <h1 className="text-5xl md:text-6xl">Exercises</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/report" className="font-medium underline-offset-4 hover:underline">
              Report
            </Link>
            <span className="min-w-0 truncate text-muted-foreground">{userEmail}</span>
            <Button variant="outline" size="sm" onClick={() => authClient.signOut()}>
              Sign out
            </Button>
          </div>
        </header>
        <Link to="/upload" className={buttonVariants({ className: "h-10 w-fit px-4" })}>
          + Upload an exercise
        </Link>
        <ExerciseListContent loadState={loadState} />
      </div>
      <img src={guitarSketch} alt="" className="sketch hidden w-full self-start md:block" />
    </main>
  );
}

function ExerciseListContent({ loadState }: { loadState: LoadState }) {
  if (loadState.status === "loading") return <p>Loading exercises…</p>;
  if (loadState.status === "error") return <p role="alert">Couldn't load your exercises.</p>;
  if (loadState.exercises.length === 0) return <p>No exercises yet.</p>;
  return (
    <ul className="flex flex-col divide-y border-y border-foreground/70">
      {loadState.exercises.map((exercise) => (
        <li key={exercise.id}>
          <Link
            to={`/exercises/${exercise.id}`}
            className="block px-1 py-4 font-heading text-2xl font-medium transition-colors hover:bg-sheet focus-visible:bg-sheet focus-visible:outline-2 focus-visible:outline-ring"
          >
            {exercise.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
