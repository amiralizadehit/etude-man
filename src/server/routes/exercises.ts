import { Router } from "express";
import { prisma } from "../db";
import { currentUser } from "../requireUser";

export const exercisesRouter = Router();

exercisesRouter.get("/", async (_req, res) => {
  const exercises = await prisma.exercise.findMany({
    where: { userId: currentUser(res).id },
    select: { id: true, name: true, source: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ exercises });
});

exercisesRouter.get("/:id", async (req, res) => {
  const exercise = await prisma.exercise.findFirst({
    where: { id: req.params.id, userId: currentUser(res).id },
    select: { id: true, name: true, source: true, musicXml: true },
  });
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }
  res.json({ exercise });
});
