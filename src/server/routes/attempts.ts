import { Router } from "express";
import { saveAttemptSchema } from "../../shared/attempt";
import { prisma } from "../db";
import { currentUser } from "../requireUser";

export const attemptsRouter = Router();

attemptsRouter.post("/", async (req, res) => {
  const parsed = saveAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid attempt", issues: parsed.error.issues });
    return;
  }
  const { exerciseId, startedAt, finishedAt, completed, noteEvents } = parsed.data;
  const userId = currentUser(res).id;

  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, userId }, select: { id: true } });
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const attempt = await prisma.attempt.create({
    data: {
      userId,
      exerciseId,
      startedAt: new Date(startedAt),
      finishedAt: new Date(finishedAt),
      completed,
      noteEvents: { createMany: { data: noteEvents } },
    },
    select: { id: true },
  });
  res.status(201).json({ attempt });
});
