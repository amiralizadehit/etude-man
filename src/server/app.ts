import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

const app = express();

// Better Auth reads the raw request body, so it must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

export default app;
