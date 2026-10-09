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
