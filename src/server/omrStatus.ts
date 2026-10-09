import type { UploadStatus } from "../shared/omr";
import type { FlatJob } from "./flat";

export const COULD_NOT_READ_PHOTO = "Flat couldn't read this photo. Try a clear, well-lit photo of a single page.";
export const NO_NOTES_FOUND = "No notes were found in this photo. Try a clearer photo of the exercise.";

/** What the browser sees for a job that is still running. */
export function processingStatus(job: FlatJob): UploadStatus {
  const percent = job.progress?.percent;
  return {
    status: "processing",
    percent: typeof percent === "number" ? Math.max(0, Math.min(100, Math.round(percent))) : null,
    stage: job.progress?.text?.trim() || null,
  };
}

/** What the browser sees for a job that failed or was canceled. */
export function failedStatus(job: FlatJob): UploadStatus {
  return { status: "error", message: job.status === "error" && job.errorMessage ? `${COULD_NOT_READ_PHOTO} (${job.errorMessage})` : COULD_NOT_READ_PHOTO };
}
