import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { fetchExercise, NotFoundError, type Exercise } from "@/lib/api";
import ScoreView, { type NoteResult } from "@/practice/ScoreView";

const NO_RESULTS: ReadonlyMap<number, NoteResult> = new Map();

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "loaded"; exercise: Exercise };

export default function PracticePage() {
  const { exerciseId = "" } = useParams();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;
    setLoadState({ status: "loading" });
    fetchExercise(exerciseId)
      .then((exercise) => isCurrent && setLoadState({ status: "loaded", exercise }))
      .catch((error) => isCurrent && setLoadState({ status: error instanceof NotFoundError ? "not-found" : "error" }));
    return () => {
      isCurrent = false;
    };
  }, [exerciseId]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to exercises
      </Link>
      <PracticeContent loadState={loadState} />
    </main>
  );
}

function PracticeContent({ loadState }: { loadState: LoadState }) {
  if (loadState.status === "loading") return <p>Loading exercise…</p>;
  if (loadState.status === "not-found") return <p role="alert">This exercise doesn't exist.</p>;
  if (loadState.status === "error") return <p role="alert">Couldn't load this exercise.</p>;
  return (
    <>
      <h1 className="text-2xl font-semibold">{loadState.exercise.name}</h1>
      <ScoreView musicXml={loadState.exercise.musicXml} currentIndex={0} noteResults={NO_RESULTS} onSequenceReady={() => {}} />
    </>
  );
}
