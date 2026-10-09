import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchReport } from "@/lib/api";
import { midiToName } from "../../shared/pitch";
import { MIN_OCCURRENCES, type TransitionReport, type TransitionSource, type TransitionStats } from "../../shared/transitions";

type LoadState = { status: "loading" } | { status: "error" } | { status: "loaded"; report: TransitionReport };

export default function ReportPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;
    fetchReport()
      .then((report) => isCurrent && setLoadState({ status: "loaded", report }))
      .catch(() => isCurrent && setLoadState({ status: "error" }));
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to exercises
      </Link>
      <h1 className="text-2xl font-semibold">Weak transitions</h1>
      <ReportContent loadState={loadState} />
    </main>
  );
}

function ReportContent({ loadState }: { loadState: LoadState }) {
  if (loadState.status === "loading") return <p>Loading report…</p>;
  if (loadState.status === "error") return <p role="alert">Couldn't load your report.</p>;
  const { report } = loadState;
  return (
    <>
      {report.includesSample && (
        <p className="w-fit rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-900">Includes sample practice history</p>
      )}
      <OverallAccuracy report={report} />
      {report.transitions.length === 0 ? (
        <p>Not enough practice yet. A transition shows up here once you've played it at least {MIN_OCCURRENCES} times.</p>
      ) : (
        <TransitionTable transitions={report.transitions} />
      )}
    </>
  );
}

function OverallAccuracy({ report }: { report: TransitionReport }) {
  if (report.firstTryAccuracy === null) return null;
  return (
    <p>
      Overall accuracy: <strong>{formatPercent(report.firstTryAccuracy)}</strong> of notes right on the first try (
      {report.notesPlayed} notes, {report.attemptCount} {report.attemptCount === 1 ? "attempt" : "attempts"}).
    </p>
  );
}

function TransitionTable({ transitions }: { transitions: TransitionStats[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b text-muted-foreground">
        <tr>
          <th className="py-2 pr-4 font-medium">Transition</th>
          <th className="py-2 pr-4 font-medium">Missed</th>
          <th className="py-2 pr-4 font-medium">Median hesitation</th>
          <th className="py-2 font-medium">Where</th>
        </tr>
      </thead>
      <tbody>
        {transitions.map((transition) => (
          <tr key={`${transition.fromMidi}-${transition.toMidi}`} className="border-b">
            <td className="py-2 pr-4 font-medium">
              {midiToName(transition.fromMidi)} → {midiToName(transition.toMidi)}
            </td>
            <td className="py-2 pr-4">
              {formatPercent(transition.missRate)} ({transition.missedOccurrences} of {transition.occurrences})
            </td>
            <td className="py-2 pr-4">{formatSeconds(transition.medianHesitationMs)}</td>
            <td className="py-2">{formatSources(transition.sources)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function formatSeconds(milliseconds: number | null): string {
  return milliseconds === null ? "—" : `${(milliseconds / 1000).toFixed(1)} s`;
}

/** "Sample Music Sheet: notes 2, 18" — note numbers count from 1 for people. */
function formatSources(sources: TransitionSource[]): string {
  const notesByExercise = new Map<string, number[]>();
  for (const source of sources) {
    notesByExercise.set(source.exerciseName, [...(notesByExercise.get(source.exerciseName) ?? []), source.noteIndex + 1]);
  }
  return [...notesByExercise]
    .map(([name, notes]) => `${name}: ${notes.length === 1 ? "note" : "notes"} ${notes.join(", ")}`)
    .join("; ");
}
