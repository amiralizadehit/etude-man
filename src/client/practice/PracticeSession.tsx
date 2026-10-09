import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SaveAttemptRequest } from "../../shared/attempt";
import {
  createNoteDetector,
  DEFAULT_DETECTOR_SETTINGS,
  type AudioFrame,
  type NoteDetector,
} from "../../shared/detector";
import { createLowNoteStabilityMonitor } from "../../shared/lowNoteStability";
import { frequencyToNote, midiToName, soundingToWritten } from "../../shared/pitch";
import {
  applyNoteEvent,
  createPracticeState,
  currentTarget,
  isFinished,
  type PracticeState,
} from "../../shared/practiceSession";
import { listInputDevices, startMicrophone, type InputDevice, type MicrophoneSession } from "./microphone";
import { createReadoutSmoother, type Readout } from "./readout";
import ScoreView from "./ScoreView";

type ListeningState = "idle" | "starting" | "listening";

type PracticeSessionProps = {
  exerciseId: string;
  musicXml: string;
  saveAttempt(attempt: SaveAttemptRequest): Promise<void>;
};

const EMPTY_SEQUENCE: readonly number[] = [];

export default function PracticeSession({ exerciseId, musicXml, saveAttempt }: PracticeSessionProps) {
  const [practice, setPractice] = useState<PracticeState>(() => createPracticeState(EMPTY_SEQUENCE));
  const [listening, setListening] = useState<ListeningState>("idle");
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showMicrophoneHint, setShowMicrophoneHint] = useState(false);

  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  const microphoneRef = useRef<MicrophoneSession | null>(null);
  const detectorRef = useRef<NoteDetector>(createNoteDetector());
  const stabilityRef = useRef(createLowNoteStabilityMonitor());
  const readoutSmootherRef = useRef(createReadoutSmoother());
  const attemptRef = useRef<{ startedAt: Date; startMs: number } | null>(null);

  const isReady = practice.sequence.length > 0;

  function handleFrame(frame: AudioFrame) {
    const nextReadout = readoutSmootherRef.current.next(readoutFor(frame), frame.timeMs);
    setReadout((shown) => (isSameReadout(shown, nextReadout) ? shown : nextReadout));
    const target = currentTarget(practiceRef.current);
    const attempt = attemptRef.current;
    if (!target || !attempt) return;
    if (stabilityRef.current.step(frame, target.writtenMidi)) setShowMicrophoneHint(true);
    const event = detectorRef.current.step(frame, target);
    if (event) {
      const next = applyNoteEvent(practiceRef.current, event, attempt.startMs);
      practiceRef.current = next;
      setPractice(next);
    }
  }

  async function listen(selectedDeviceId: string | undefined) {
    microphoneRef.current?.stop();
    microphoneRef.current = await startMicrophone({ deviceId: selectedDeviceId, onFrame: handleFrame });
    setDevices(await listInputDevices());
  }

  async function handleStart() {
    const fresh = createPracticeState(practice.sequence);
    practiceRef.current = fresh;
    setPractice(fresh);
    setMessage(null);
    detectorRef.current.reset();
    stabilityRef.current.reset();
    readoutSmootherRef.current.reset();
    setShowMicrophoneHint(false);
    attemptRef.current = { startedAt: new Date(), startMs: performance.now() };
    setListening("starting");
    try {
      await listen(deviceId);
      setListening("listening");
    } catch {
      attemptRef.current = null;
      setListening("idle");
      setMessage("Microphone access was blocked. Allow it in your browser to practice.");
    }
  }

  function attemptRequest(attempt: { startedAt: Date }, completed: boolean): SaveAttemptRequest {
    return {
      exerciseId,
      startedAt: attempt.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      completed,
      noteEvents: [...practiceRef.current.noteEvents],
    };
  }

  async function finishAttempt(completed: boolean) {
    microphoneRef.current?.stop();
    microphoneRef.current = null;
    setListening("idle");
    setReadout(null);
    const attempt = attemptRef.current;
    attemptRef.current = null;
    if (!attempt) return;
    try {
      await saveAttempt(attemptRequest(attempt, completed));
      setMessage(completed ? "Finished! Attempt saved." : "Stopped. Attempt saved.");
    } catch {
      setMessage("Couldn't save this attempt.");
    }
  }

  async function handleDeviceChange(selectedDeviceId: string) {
    setDeviceId(selectedDeviceId);
    if (listening === "listening") await listen(selectedDeviceId);
  }

  useEffect(() => {
    // finishAttempt only reads refs and state setters, so it is safe to leave out of the deps.
    if (listening === "listening" && isFinished(practice)) void finishAttempt(true);
  }, [listening, practice]);

  useEffect(() => () => microphoneRef.current?.stop(), []);

  // Leaving or closing the page mid-attempt: best-effort save, since a normal request may be cancelled.
  useEffect(() => {
    function saveOnPageHide() {
      const attempt = attemptRef.current;
      if (!attempt) return;
      attemptRef.current = null;
      const body = JSON.stringify(attemptRequest(attempt, false));
      navigator.sendBeacon("/api/attempts", new Blob([body], { type: "application/json" }));
    }
    window.addEventListener("pagehide", saveOnPageHide);
    return () => window.removeEventListener("pagehide", saveOnPageHide);
    // attemptRequest only reads props that don't change for a mounted session, and refs.
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {listening === "listening" ? (
          <Button variant="outline" onClick={() => void finishAttempt(false)}>
            Stop
          </Button>
        ) : (
          <Button onClick={() => void handleStart()} disabled={!isReady || listening === "starting"}>
            Start
          </Button>
        )}
        {devices.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            Microphone
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={deviceId ?? ""}
              onChange={(event) => void handleDeviceChange(event.target.value)}
            >
              <option value="">Default</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {listening === "listening" && (
          <p aria-live="polite" className="w-24 font-mono text-sm tabular-nums">
            {readout ? `${readout.noteName} ${formatCents(readout.cents)}` : "—"}
          </p>
        )}
      </div>
      {listening === "listening" && showMicrophoneHint && <p className="text-sm text-amber-700">Try a different microphone.</p>}
      {message && <p role="status">{message}</p>}
      <ScoreView
        musicXml={musicXml}
        currentIndex={practice.currentIndex}
        noteResults={practice.results}
        onSequenceReady={(sequence) => setPractice(createPracticeState(sequence))}
      />
    </div>
  );
}

/** Detected note shown in written pitch, as printed in the book. */
function readoutFor(frame: AudioFrame): Readout | null {
  if (frame.frequencyHz === null || frame.clarity < DEFAULT_DETECTOR_SETTINGS.clarityThreshold) return null;
  const note = frequencyToNote(frame.frequencyHz);
  return { noteName: midiToName(soundingToWritten(note.midi)), cents: note.cents };
}

function isSameReadout(a: Readout | null, b: Readout | null): boolean {
  return a?.noteName === b?.noteName && a?.cents === b?.cents;
}

function formatCents(cents: number): string {
  return `${cents >= 0 ? "+" : ""}${cents}¢`;
}
