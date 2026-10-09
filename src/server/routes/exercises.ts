import { Router } from "express";
import { importMusicXmlSchema } from "../../shared/exerciseImport";
import { findMusicXmlProblem, normalizeMusicXml } from "../../shared/musicxml";
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

exercisesRouter.post("/import", async (req, res) => {
  const parsed = importMusicXmlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid import", issues: parsed.error.issues });
    return;
  }
  const problem = findMusicXmlProblem(parsed.data.musicXml);
  if (problem) {
    res.status(422).json({ error: problem });
    return;
  }
  const exercise = await prisma.exercise.create({
    data: {
      userId: currentUser(res).id,
      name: parsed.data.name,
      source: "upload",
      musicXml: normalizeMusicXml(parsed.data.musicXml),
    },
    select: { id: true },
  });
  res.status(201).json({ exerciseId: exercise.id });
});
