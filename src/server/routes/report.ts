import { Router } from "express";
import { analyzeAttempts } from "../../shared/transitions";
import { prisma } from "../db";
import { currentUser } from "../requireUser";

export const REPORT_TRANSITION_LIMIT = 10;

export const reportRouter = Router();

reportRouter.get("/", async (_req, res) => {
  const attempts = await prisma.attempt.findMany({
    // Drills repeat pairs in isolation and add reverse pairs, so they'd drown out the real music.
    where: { userId: currentUser(res).id, exercise: { source: { not: "drill" } } },
    select: {
      sample: true,
      exercise: { select: { id: true, name: true } },
      noteEvents: {
        select: { noteIndex: true, expectedMidi: true, playedMidi: true, correct: true, timestampMs: true },
        orderBy: [{ timestampMs: "asc" }, { id: "asc" }],
      },
    },
  });
  const report = analyzeAttempts(
    attempts.map((attempt) => ({
      exerciseId: attempt.exercise.id,
      exerciseName: attempt.exercise.name,
      sample: attempt.sample,
      noteEvents: attempt.noteEvents,
    })),
  );
  res.json({ report: { ...report, transitions: report.transitions.slice(0, REPORT_TRANSITION_LIMIT) } });
});
