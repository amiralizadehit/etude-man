import { render, screen, waitFor } from "@testing-library/react";
import ScoreView, { type NoteResult } from "./ScoreView";

type FakeNote = { halfTone: number; isRest(): boolean };

// A score of four cursor steps: C5, rest, E5, G5 (written MIDI 72, —, 76, 79).
const STEPS: FakeNote[][] = [[72], [], [76], [79]].map((midis) =>
  midis.length === 0
    ? [{ halfTone: 0, isRest: () => true }]
    : midis.map((midi) => ({ halfTone: midi - 12, isRest: () => false })),
);

const fake = vi.hoisted(() => ({
  instances: [] as { cursorCalls: string[]; position: () => number; svgFor: Map<unknown, SVGGElement>; cleared: boolean }[],
  loadError: null as Error | null,
}));

vi.mock("opensheetmusicdisplay", () => ({
  OpenSheetMusicDisplay: class {
    cursorCalls: string[] = [];
    svgFor = new Map<unknown, SVGGElement>();
    cleared = false;
    private step = 0;
    position = () => this.step;
    cursor: unknown;

    constructor() {
      fake.instances.push(this);
      const score = this;
      this.cursor = {
        show: () => score.cursorCalls.push("show"),
        hide: () => score.cursorCalls.push("hide"),
        reset: () => {
          score.step = 0;
          score.cursorCalls.push("reset");
        },
        next: () => {
          score.step++;
          score.cursorCalls.push("next");
        },
        Iterator: {
          get EndReached() {
            return score.step >= STEPS.length;
          },
          get CurrentVoiceEntries() {
            return [{ IsGrace: false, Notes: STEPS[score.step] }];
          },
        },
        GNotesUnderCursor: () =>
          STEPS[score.step].map((sourceNote) => ({ sourceNote, getSVGGElement: () => score.svgOf(sourceNote) })),
      };
    }
    load() {
      return fake.loadError ? Promise.reject(fake.loadError) : Promise.resolve();
    }
    render() {}
    clear() {
      this.cleared = true;
    }
    private svgOf(note: unknown) {
      if (!this.svgFor.has(note)) {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path"));
        this.svgFor.set(note, group);
      }
      return this.svgFor.get(note)!;
    }
  },
}));

function renderScore(props: Partial<{ currentIndex: number; noteResults: Map<number, NoteResult>; onSequenceReady: (m: number[]) => void }> = {}) {
  const onSequenceReady = props.onSequenceReady ?? vi.fn();
  const view = render(
    <ScoreView
      musicXml="<score/>"
      currentIndex={props.currentIndex ?? 0}
      noteResults={props.noteResults ?? new Map()}
      onSequenceReady={onSequenceReady}
    />,
  );
  return { ...view, onSequenceReady };
}

function noteColor(instance: (typeof fake.instances)[number], stepIndex: number) {
  return instance.svgFor.get(STEPS[stepIndex][0])?.querySelector("path")?.getAttribute("fill") ?? null;
}

beforeEach(() => {
  fake.instances.length = 0;
  fake.loadError = null;
});

test("renders the score and reports the playable notes, skipping the rest", async () => {
  const { onSequenceReady } = renderScore();
  expect(screen.getByText("Rendering score…")).toBeInTheDocument();
  await waitFor(() => expect(onSequenceReady).toHaveBeenCalledWith([72, 76, 79]));
  expect(screen.queryByText("Rendering score…")).not.toBeInTheDocument();
});

test("moves the cursor to the current playable note, past the rest", async () => {
  const { rerender, onSequenceReady } = renderScore({ currentIndex: 0 });
  await waitFor(() => expect(onSequenceReady).toHaveBeenCalled());
  const instance = fake.instances[0];
  expect(instance.position()).toBe(0);

  rerender(<ScoreView musicXml="<score/>" currentIndex={1} noteResults={new Map()} onSequenceReady={onSequenceReady} />);
  await waitFor(() => expect(instance.position()).toBe(2));
});

test("hides the cursor once every note is played", async () => {
  const { rerender, onSequenceReady } = renderScore();
  await waitFor(() => expect(onSequenceReady).toHaveBeenCalled());
  rerender(<ScoreView musicXml="<score/>" currentIndex={3} noteResults={new Map()} onSequenceReady={onSequenceReady} />);
  await waitFor(() => expect(fake.instances[0].cursorCalls.at(-1)).toBe("hide"));
});

test("colors correct notes green and missed notes red", async () => {
  const noteResults = new Map<number, NoteResult>([
    [0, "correct"],
    [1, "missed"],
  ]);
  const { onSequenceReady } = renderScore({ noteResults });
  await waitFor(() => expect(onSequenceReady).toHaveBeenCalled());
  const instance = fake.instances[0];
  await waitFor(() => expect(noteColor(instance, 0)).toBe("#16a34a"));
  expect(noteColor(instance, 2)).toBe("#dc2626");
  expect(noteColor(instance, 3)).toBeNull();
});

test("shows an error when the score can't be loaded", async () => {
  fake.loadError = new Error("bad MusicXML");
  renderScore();
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't display this score.");
});

test("clears the score when unmounted", async () => {
  const { unmount, onSequenceReady } = renderScore();
  await waitFor(() => expect(onSequenceReady).toHaveBeenCalled());
  unmount();
  expect(fake.instances[0].cleared).toBe(true);
});
