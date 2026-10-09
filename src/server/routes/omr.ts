import { Router } from "express";
import { listPlayableWrittenMidis, normalizeMusicXml } from "../../shared/musicxml";
import { startUploadSchema, type UploadStatus } from "../../shared/omr";
import { prisma } from "../db";
import { FlatApiError, OMR_NOT_SUPPORTED_CODE, type FlatClient, type FlatJob } from "../flat";
import { failedStatus, NO_NOTES_FOUND, processingStatus } from "../omrStatus";
import { currentUser } from "../requireUser";

/** Each poll waits for Flat at most this long, so requests stay well within host time limits. */
const POLL_WAIT_SECONDS = 20;

type OmrUploadRow = { id: string; userId: string; flatJobId: string; name: string };

export function createOmrRouter(getFlat: () => FlatClient) {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = startUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid upload", issues: parsed.error.issues });
      return;
    }
    let job: FlatJob;
    try {
      job = await getFlat().createJob(parsed.data.image);
    } catch (error) {
      console.error(error);
      if (error instanceof FlatApiError && error.status === 402) {
        res.status(402).json({ error: "insufficient_credits" });
        return;
      }
      if (error instanceof FlatApiError && error.code === OMR_NOT_SUPPORTED_CODE) {
        res.status(503).json({ error: "omr_not_available" });
        return;
      }
      res.status(502).json({ error: "flat_unavailable" });
      return;
    }
    const upload = await prisma.omrUpload.create({
      data: { userId: currentUser(res).id, flatJobId: job.id, name: parsed.data.name },
      select: { id: true },
    });
    res.status(201).json({ uploadId: upload.id });
  });

  router.get("/:uploadId", async (req, res) => {
    const upload = await prisma.omrUpload.findFirst({ where: { id: req.params.uploadId, userId: currentUser(res).id } });
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    if (upload.exerciseId) {
      res.json({ status: "done", exerciseId: upload.exerciseId } satisfies UploadStatus);
      return;
    }
    try {
      const flat = getFlat();
      const job = await flat.getJob(upload.flatJobId, POLL_WAIT_SECONDS);
      res.json(await statusFor(upload, job, flat));
    } catch (error) {
      console.error(error);
      res.status(502).json({ error: "flat_unavailable" });
    }
  });

  return router;
}

async function statusFor(upload: OmrUploadRow, job: FlatJob, flat: FlatClient): Promise<UploadStatus> {
  switch (job.status) {
    case "draft":
    case "processing":
      return processingStatus(job);
    case "awaitingInput":
      // No interactive steps were requested; if Flat pauses anyway, accept what it detected.
      return processingStatus(await flat.submitStepUnchanged(job.id, job.currentStep ?? "details"));
    case "done":
      return saveExercise(upload, await flat.exportMusicXml(job.id));
    default:
      return failedStatus(job);
  }
}

async function saveExercise(upload: OmrUploadRow, exportedMusicXml: string): Promise<UploadStatus> {
  let musicXml: string;
  try {
    musicXml = normalizeMusicXml(exportedMusicXml);
  } catch {
    return { status: "error", message: NO_NOTES_FOUND };
  }
  if (listPlayableWrittenMidis(musicXml).length === 0) {
    return { status: "error", message: NO_NOTES_FOUND };
  }
  // Two polls can both see "done"; the transaction makes sure only one exercise is created.
  const exerciseId = await prisma.$transaction(async (tx) => {
    const current = await tx.omrUpload.findUniqueOrThrow({ where: { id: upload.id }, select: { exerciseId: true } });
    if (current.exerciseId) return current.exerciseId;
    const exercise = await tx.exercise.create({
      data: { userId: upload.userId, name: upload.name, source: "upload", musicXml },
      select: { id: true },
    });
    await tx.omrUpload.update({ where: { id: upload.id }, data: { exerciseId: exercise.id } });
    return exercise.id;
  });
  return { status: "done", exerciseId };
}
