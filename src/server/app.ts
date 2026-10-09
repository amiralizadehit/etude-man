import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { flatClientFromEnv } from "./flat";
import { requireUser } from "./requireUser";
import { attemptsRouter } from "./routes/attempts";
import { exercisesRouter } from "./routes/exercises";
import { createOmrRouter } from "./routes/omr";
import { reportRouter } from "./routes/report";

const app = express();

// Better Auth reads the raw request body, so it must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));
// Uploads carry a downscaled photo as base64; parsed here, so the 1 MB parser below skips them.
app.use("/api/omr", express.json({ limit: "8mb" }));
// Imported MusicXML files can exceed the default limit below.
app.use("/api/exercises/import", express.json({ limit: "4mb" }));
// Attempts carry every note event; 1 MB covers the 5000-event cap with room to spare.
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/exercises", requireUser, exercisesRouter);
app.use("/api/attempts", requireUser, attemptsRouter);
app.use("/api/report", requireUser, reportRouter);
app.use("/api/omr", requireUser, createOmrRouter(flatClientFromEnv));

export default app;
