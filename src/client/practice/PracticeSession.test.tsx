import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AudioFrame, NoteEvent } from "../../shared/detector";
import type { NoteResult } from "../../shared/practiceSession";
import { startMicrophone } from "./microphone";
import PracticeSession from "./PracticeSession";

const SEQUENCE = [72, 60]; // written C5, C4

const mic = vi.hoisted(() => ({
  onFrame: null as ((frame: AudioFrame) => void) | null,
  stop: vi.fn(),
}));

vi.mock("./microphone", () => ({
  startMicrophone: vi.fn(async ({ onFrame }: { onFrame: (frame: AudioFrame) => void }) => {
    mic.onFrame = onFrame;
    return { stop: mic.stop };
  }),
  listInputDevices: vi.fn(async () => [
    { deviceId: "usb", label: "USB interface" },
    { deviceId: "headset", label: "Headset" },
  ]),
}));

// The fake detector reports whatever event a test attaches to a frame.
type TestFrame = AudioFrame & { event?: NoteEvent };
vi.mock("../../shared/detector", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createNoteDetector: () => ({ step: (frame: TestFrame) => frame.event ?? null, reset: () => {} }),
}));

vi.mock("./ScoreView", async () => {
  const { useEffect } = await import("react");
  return {
    default: function FakeScoreView(props: {
      currentIndex: number;
      noteResults: ReadonlyMap<number, NoteResult>;
      onSequenceReady(sequence: number[]): void;
    }) {
      // Reports the sequence once, like the real score after rendering.
      useEffect(() => props.onSequenceReady(SEQUENCE), []);
      return (
        <p data-testid="score">
          cursor {props.currentIndex}; {[...props.noteResults].map(([index, result]) => `${index}:${result}`).join(" ")}
        </p>
      );
    },
  };
});

const SILENT_FRAME: AudioFrame = { timeMs: 0, rms: 0, frequencyHz: null, clarity: 0 };

function sendFrame(frame: Partial<TestFrame>) {
  act(() => mic.onFrame!({ ...SILENT_FRAME, ...frame }));
}

function played(correct: boolean, playedWrittenMidi: number): Partial<TestFrame> {
  return { event: { correct, playedSoundingMidi: playedWrittenMidi - 12, timeMs: performance.now() } };
}

function renderSession(saveAttempt = vi.fn(async () => {})) {
  render(<PracticeSession exerciseId="ex-1" musicXml="<score/>" saveAttempt={saveAttempt} />);
  return { saveAttempt, user: userEvent.setup() };
}

async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start" }));
  await screen.findByRole("button", { name: "Stop" });
}

beforeEach(() => {
  mic.onFrame = null;
  mic.stop.mockClear();
  vi.mocked(startMicrophone).mockClear();
});

test("starts listening on the default microphone and then offers the input devices", async () => {
  const { user } = renderSession();
  await start(user);
  expect(startMicrophone).toHaveBeenCalledWith(expect.objectContaining({ deviceId: undefined }));
  expect(screen.getByRole("option", { name: "USB interface" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Headset" })).toBeInTheDocument();
});

test("shows the detected note in written pitch with its cents offset", async () => {
  const { user } = renderSession();
  await start(user);
  sendFrame({ rms: 0.2, frequencyHz: 220, clarity: 0.97 }); // sounding A3 = written A4
  expect(screen.getByText("A4 +0¢")).toBeInTheDocument();
});

test("does not show low-confidence readings", async () => {
  const { user } = renderSession();
  await start(user);
  sendFrame({ rms: 0.2, frequencyHz: 220, clarity: 0.5 });
  expect(screen.getByText("—")).toBeInTheDocument();
});

test("a miss marks the note red and keeps the cursor; a correct note moves it on", async () => {
  const { user } = renderSession();
  await start(user);
  sendFrame(played(false, 74));
  expect(screen.getByTestId("score")).toHaveTextContent("cursor 0; 0:missed");
  sendFrame(played(true, 72));
  expect(screen.getByTestId("score")).toHaveTextContent("cursor 1; 0:missed");
});

test("finishing the exercise stops the microphone and saves a completed attempt", async () => {
  const { user, saveAttempt } = renderSession();
  await start(user);
  sendFrame(played(true, 72));
  sendFrame(played(true, 60));

  expect(await screen.findByRole("status")).toHaveTextContent("Finished! Attempt saved.");
  expect(mic.stop).toHaveBeenCalled();
  expect(saveAttempt).toHaveBeenCalledWith(
    expect.objectContaining({
      exerciseId: "ex-1",
      completed: true,
      noteEvents: [
        expect.objectContaining({ noteIndex: 0, expectedMidi: 72, playedMidi: 72, correct: true }),
        expect.objectContaining({ noteIndex: 1, expectedMidi: 60, playedMidi: 60, correct: true }),
      ],
    }),
  );
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
});

test("stopping early saves an incomplete attempt", async () => {
  const { user, saveAttempt } = renderSession();
  await start(user);
  sendFrame(played(true, 72));
  await user.click(screen.getByRole("button", { name: "Stop" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Stopped. Attempt saved.");
  expect(saveAttempt).toHaveBeenCalledWith(expect.objectContaining({ completed: false, noteEvents: [expect.anything()] }));
});

test("starting again begins a fresh attempt", async () => {
  const { user } = renderSession();
  await start(user);
  sendFrame(played(false, 74));
  await user.click(screen.getByRole("button", { name: "Stop" }));
  await screen.findByRole("status");

  await start(user);
  expect(screen.getByTestId("score")).toHaveTextContent(/^cursor 0;\s*$/);
});

test("says so when the microphone is blocked", async () => {
  vi.mocked(startMicrophone).mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
  const { user } = renderSession();
  await user.click(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Microphone access was blocked. Allow it in your browser to practice.",
  );
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
});

test("says so when the attempt can't be saved", async () => {
  const { user } = renderSession(vi.fn(async () => Promise.reject(new Error("offline"))));
  await start(user);
  await user.click(screen.getByRole("button", { name: "Stop" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Couldn't save this attempt.");
});

test("switching microphones while listening restarts on the chosen device", async () => {
  const { user } = renderSession();
  await start(user);
  await user.selectOptions(screen.getByRole("combobox"), "headset");
  await waitFor(() => expect(startMicrophone).toHaveBeenLastCalledWith(expect.objectContaining({ deviceId: "headset" })));
  expect(mic.stop).toHaveBeenCalled();
});
