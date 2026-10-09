import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  importMusicXml,
  InsufficientCreditsError,
  InvalidMusicXmlError,
  PhotoRecognitionUnavailableError,
  pollUpload,
  startUpload,
} from "@/lib/api";
import { preparePhoto } from "@/upload/preparePhoto";
import mozartSketch from "../../../assets/mozart.jpg";

/** Pause between polls when Flat answers immediately; each poll otherwise waits on the server. */
export const POLL_INTERVAL_MS = 2000;
/** Give up waiting for Flat after this long. */
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_FAILED_POLLS_IN_A_ROW = 3;

const MESSAGES = {
  insufficientCredits: "Your Flat account doesn't have enough credits to read this photo.",
  recognitionUnavailable:
    "Photo recognition isn't available on the connected Flat account. You can upload a MusicXML file instead, for example one exported from Flat.",
  notMusicXml: "This file isn't a MusicXML score.",
  noNotes: "No notes were found in this file.",
  uploadFailed: "Couldn't upload this file. Please try again.",
  timedOut: "Reading the photo is taking too long. Please try again.",
} as const;

type UploadKind = "photo" | "musicxml";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; kind: UploadKind }
  | { status: "reading"; percent: number | null; stage: string | null }
  | { status: "error"; message: string };

export function uploadKindOf(file: File): UploadKind {
  return /\.(musicxml|xml)$/i.test(file.name) ? "musicxml" : "photo";
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const isMountedRef = useRef(true);
  // Set on every mount: StrictMode unmounts and remounts in development, and a flag left false
  // made the page ignore every response (stuck on "Uploading photo…").
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isBusy = uploadState.status === "uploading" || uploadState.status === "reading";

  async function waitForExercise(uploadId: string): Promise<string | null> {
    const deadline = Date.now() + UPLOAD_TIMEOUT_MS;
    let failedPollsInARow = 0;
    while (isMountedRef.current && Date.now() < deadline) {
      let status;
      try {
        status = await pollUpload(uploadId);
        failedPollsInARow = 0;
      } catch (error) {
        // A blip during a long wait shouldn't lose the upload; give up after a few in a row.
        if (++failedPollsInARow >= MAX_FAILED_POLLS_IN_A_ROW) throw error;
        await delay(POLL_INTERVAL_MS);
        continue;
      }
      if (status.status === "done") return status.exerciseId;
      if (status.status === "error") {
        setUploadState({ status: "error", message: status.message });
        return null;
      }
      setUploadState({ status: "reading", percent: status.percent, stage: status.stage });
      await delay(POLL_INTERVAL_MS);
    }
    if (isMountedRef.current) setUploadState({ status: "error", message: MESSAGES.timedOut });
    return null;
  }

  async function readPhotoWithFlat(photo: File): Promise<string | null> {
    const uploadId = await startUpload({ name: name.trim(), image: await preparePhoto(photo) });
    setUploadState({ status: "reading", percent: null, stage: null });
    return waitForExercise(uploadId);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const kind = uploadKindOf(file);
    setUploadState({ status: "uploading", kind });
    try {
      const exerciseId =
        kind === "musicxml" ? await importMusicXml({ name: name.trim(), musicXml: await file.text() }) : await readPhotoWithFlat(file);
      if (exerciseId && isMountedRef.current) navigate(`/exercises/${exerciseId}`);
    } catch (error) {
      if (!isMountedRef.current) return;
      setUploadState({ status: "error", message: messageFor(error) });
    }
  }

  return (
    <main className="mx-auto grid max-w-4xl items-end gap-x-16 px-4 py-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:py-10">
      <div className="flex flex-col gap-6">
        <Link to="/" className="back-link">
          ← Back to exercises
        </Link>
        <h1 className="text-5xl md:text-6xl">Upload an exercise</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 border-t border-foreground/70 pt-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="exercise-name">Exercise name</Label>
            <Input
              id="exercise-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="exercise-file">Photo or MusicXML file</Label>
            <Input
              id="exercise-file"
              type="file"
              accept="image/jpeg,image/png,.musicxml,.xml"
              aria-describedby="exercise-file-hint"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={isBusy}
              className="h-auto border-dashed px-3 py-3 file:mr-3 file:h-8 file:border file:border-input file:px-3"
            />
            <p id="exercise-file-hint" className="text-sm text-muted-foreground">
              A photo of the page is read by Flat. A MusicXML file is imported as is.
            </p>
          </div>
          <UploadProgress uploadState={uploadState} />
          <Button type="submit" disabled={isBusy || !file} size="lg">
            {uploadState.status === "error" ? "Try again" : "Upload"}
          </Button>
        </form>
      </div>
      <img src={mozartSketch} alt="" className="sketch hidden max-h-[34rem] w-auto justify-self-center md:block" />
    </main>
  );
}

function UploadProgress({ uploadState }: { uploadState: UploadState }) {
  if (uploadState.status === "uploading") {
    return <p role="status">{uploadState.kind === "musicxml" ? "Importing MusicXML…" : "Uploading photo…"}</p>;
  }
  if (uploadState.status === "reading") {
    const stage = uploadState.stage ?? "Reading the sheet music";
    return (
      <p role="status">
        {stage}
        {uploadState.percent !== null && ` — ${uploadState.percent}%`}
      </p>
    );
  }
  if (uploadState.status === "error") {
    return (
      <p role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">
        {uploadState.message}
      </p>
    );
  }
  return null;
}

function messageFor(error: unknown): string {
  if (error instanceof InsufficientCreditsError) return MESSAGES.insufficientCredits;
  if (error instanceof PhotoRecognitionUnavailableError) return MESSAGES.recognitionUnavailable;
  if (error instanceof InvalidMusicXmlError) return error.problem === "no-notes" ? MESSAGES.noNotes : MESSAGES.notMusicXml;
  return MESSAGES.uploadFailed;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
