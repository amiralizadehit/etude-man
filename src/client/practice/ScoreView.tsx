import { useEffect, useRef, useState } from "react";
import { OpenSheetMusicDisplay, type GraphicalNote } from "opensheetmusicdisplay";
import { buildPlayableSequence, type PlayableNote, type ScoreCursor } from "./playableSequence";

export type NoteResult = "correct" | "missed";

const RESULT_COLORS: Record<NoteResult, string> = {
  correct: "#16a34a",
  missed: "#dc2626",
};

type RenderedNote = GraphicalNote & { getSVGGElement?(): SVGGElement | undefined };

type RenderedScore = {
  cursor: ScoreCursor<RenderedNote> & { show(): void; hide(): void };
  sequence: PlayableNote<RenderedNote>[];
  cursorStep: number;
};

type ScoreViewProps = {
  musicXml: string;
  /** Playable-note index the cursor waits on; past the end hides the cursor. */
  currentIndex: number;
  /** Results so far, by playable-note index. */
  noteResults: ReadonlyMap<number, NoteResult>;
  /** Called once the score is rendered, with the written MIDI note of each playable note. */
  onSequenceReady(writtenMidis: number[]): void;
};

export default function ScoreView({ musicXml, currentIndex, noteResults, onSequenceReady }: ScoreViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<RenderedScore | null>(null);
  const onSequenceReadyRef = useRef(onSequenceReady);
  onSequenceReadyRef.current = onSequenceReady;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let isCurrent = true;
    const osmd = new OpenSheetMusicDisplay(containerRef.current!, {
      autoResize: true,
      drawTitle: false,
      drawPartNames: false,
      followCursor: true,
    });
    setStatus("loading");
    osmd
      .load(musicXml)
      .then(() => {
        if (!isCurrent) return;
        osmd.render();
        const cursor = osmd.cursor as unknown as RenderedScore["cursor"];
        cursor.show();
        const sequence = buildPlayableSequence(cursor);
        scoreRef.current = { cursor, sequence, cursorStep: 0 };
        setStatus("ready");
        onSequenceReadyRef.current(sequence.map((playable) => playable.writtenMidi));
      })
      .catch(() => isCurrent && setStatus("error"));
    return () => {
      isCurrent = false;
      scoreRef.current = null;
      osmd.clear();
    };
  }, [musicXml]);

  useEffect(() => {
    if (status === "ready" && scoreRef.current) moveCursor(scoreRef.current, currentIndex);
  }, [status, currentIndex]);

  useEffect(() => {
    if (status !== "ready" || !scoreRef.current) return;
    const { sequence } = scoreRef.current;
    noteResults.forEach((result, index) => colorNote(sequence[index]?.graphicalNote, RESULT_COLORS[result]));
  }, [status, noteResults]);

  return (
    <div>
      {status === "loading" && <p>Rendering score…</p>}
      {status === "error" && <p role="alert">Couldn't display this score.</p>}
      <div ref={containerRef} data-testid="score" />
    </div>
  );
}

function moveCursor(score: RenderedScore, playableIndex: number) {
  const target = score.sequence[playableIndex];
  if (!target) {
    score.cursor.hide();
    return;
  }
  // The cursor only moves forward, so going back means starting over.
  if (target.cursorStep < score.cursorStep) {
    score.cursor.reset();
    score.cursorStep = 0;
  }
  for (; score.cursorStep < target.cursorStep; score.cursorStep++) {
    score.cursor.next();
  }
  score.cursor.show();
}

function colorNote(note: RenderedNote | undefined, color: string) {
  note
    ?.getSVGGElement?.()
    ?.querySelectorAll("path")
    .forEach((path) => {
      path.setAttribute("fill", color);
      path.setAttribute("stroke", color);
    });
}
