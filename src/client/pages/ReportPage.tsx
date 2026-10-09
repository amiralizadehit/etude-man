import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchReport } from "@/lib/api";
import chopinSketch from "../../../assets/chopin.jpg";
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
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="flex items-end justify-between gap-6 border-b border-foreground/70">
        <div className="flex flex-col gap-6 pb-6">
          <Link to="/" className="back-link">
            ← Back to exercises
          </Link>
          <h1 className="text-5xl md:text-6xl">Weak transitions</h1>
        </div>
        <img src={chopinSketch} alt="" className="sketch hidden h-56 w-auto sm:block" />
      </header>
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
        <p className="w-fit border border-dashed border-foreground/50 px-2 py-0.5 text-sm text-muted-foreground">
          Includes sample practice history
        </p>
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
    <p className="max-w-prose text-lg">
      Overall accuracy: <strong className="font-heading text-4xl font-semibold">{formatPercent(report.firstTryAccuracy)}</strong> of
      notes right on the first try (
      {report.notesPlayed} notes, {report.attemptCount} {report.attemptCount === 1 ? "attempt" : "attempts"}).
    </p>
  );
}

function TransitionTable({ transitions }: { transitions: TransitionStats[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-6 font-normal">Transition</th>
            <th className="py-2 pr-6 font-normal">Missed</th>
            <th className="py-2 pr-6 font-normal">Median hesitation</th>
            <th className="py-2 font-normal">Where</th>
          </tr>
        </thead>
        <tbody className="divide-y border-y border-foreground/70">
          {transitions.map((transition) => (
            <tr key={`${transition.fromMidi}-${transition.toMidi}`}>
              <td className="py-4 pr-6 font-heading text-xl font-semibold whitespace-nowrap">
                {midiToName(transition.fromMidi)} → {midiToName(transition.toMidi)}
              </td>
              <td className="py-4 pr-6 tabular-nums whitespace-nowrap">
                {formatPercent(transition.missRate)} ({transition.missedOccurrences} of {transition.occurrences})
                <MissRateBar missRate={transition.missRate} />
              </td>
              <td className="py-4 pr-6 tabular-nums">{formatSeconds(transition.medianHesitationMs)}</td>
              <td className="py-4 text-muted-foreground">{formatSources(transition.sources)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissRateBar({ missRate }: { missRate: number }) {
  return (
    <span aria-hidden="true" className="mt-1.5 block h-1 w-28 bg-muted">
      <span className="block h-full bg-miss/70" style={{ width: formatPercent(missRate) }} />
    </span>
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
