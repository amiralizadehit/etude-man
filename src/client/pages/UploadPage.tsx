import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsufficientCreditsError, pollUpload, startUpload } from "@/lib/api";
import { preparePhoto } from "@/upload/preparePhoto";

/** Pause between polls when Flat answers immediately; each poll otherwise waits on the server. */
export const POLL_INTERVAL_MS = 2000;
/** Give up waiting for Flat after this long. */
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_FAILED_POLLS_IN_A_ROW = 3;

const MESSAGES = {
  insufficientCredits: "Your Flat account doesn't have enough credits to read this photo.",
  uploadFailed: "Couldn't upload the photo. Please try again.",
  timedOut: "Reading the photo is taking too long. Please try again.",
} as const;

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "reading"; percent: number | null; stage: string | null }
  | { status: "error"; message: string };

export default function UploadPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const isMountedRef = useRef(true);
  useEffect(() => () => void (isMountedRef.current = false), []);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!photo) return;
    setUploadState({ status: "uploading" });
    try {
      const uploadId = await startUpload({ name: name.trim(), image: await preparePhoto(photo) });
      setUploadState({ status: "reading", percent: null, stage: null });
      const exerciseId = await waitForExercise(uploadId);
      if (exerciseId && isMountedRef.current) navigate(`/exercises/${exerciseId}`);
    } catch (error) {
      if (!isMountedRef.current) return;
      const message = error instanceof InsufficientCreditsError ? MESSAGES.insufficientCredits : MESSAGES.uploadFailed;
      setUploadState({ status: "error", message });
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to exercises
      </Link>
      <h1 className="text-2xl font-semibold">Upload a photo</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <Label htmlFor="photo">Photo of the exercise page</Label>
          <Input
            id="photo"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            disabled={isBusy}
          />
        </div>
        <UploadProgress uploadState={uploadState} />
        <Button type="submit" disabled={isBusy || !photo}>
          {uploadState.status === "error" ? "Try again" : "Upload"}
        </Button>
      </form>
    </main>
  );
}

function UploadProgress({ uploadState }: { uploadState: UploadState }) {
  if (uploadState.status === "uploading") return <p role="status">Uploading photo…</p>;
  if (uploadState.status === "reading") {
    const stage = uploadState.stage ?? "Reading the sheet music";
    return (
      <p role="status">
        {stage}
        {uploadState.percent !== null && ` — ${uploadState.percent}%`}
      </p>
    );
  }
  if (uploadState.status === "error") return <p role="alert">{uploadState.message}</p>;
  return null;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
