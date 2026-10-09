import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { requireUser } from "./requireUser";
import { attemptsRouter } from "./routes/attempts";
import { exercisesRouter } from "./routes/exercises";

const app = express();

// Better Auth reads the raw request body, so it must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));
// Attempts carry every note event; 1 MB covers the 5000-event cap with room to spare.
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/exercises", requireUser, exercisesRouter);
app.use("/api/attempts", requireUser, attemptsRouter);

export default app;
