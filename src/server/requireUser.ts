import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";

export type AuthUser = typeof auth.$Infer.Session.user;

/** Rejects requests without a valid session; otherwise exposes the user via currentUser(). */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.locals.user = session.user;
  next();
}

/** The signed-in user; only valid in handlers mounted behind requireUser. */
export function currentUser(res: Response): AuthUser {
  return res.locals.user as AuthUser;
}
