import crypto from "node:crypto";
import type { Request, Response } from "express";

export const SESSION_COOKIE = "gig_session";
export const SESSION_AGE = 8 * 60 * 60 * 1000;
export const tokenDigest = (token: string) => `sha256$${crypto.createHash("sha256").update(token).digest("hex")}`;

export function sessionToken(req: Request): string | undefined {
  if (req.headers.authorization) {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization);
    return match?.[1];
  }
  const cookies = (req.headers.cookie || "").split(";").map(value => value.trim());
  const value = cookies.find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function setSessionCookie(req: Request, res: Response, token: string | null) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production" || req.secure,
    sameSite: "strict" as const, path: "/" };
  if (token) res.cookie(SESSION_COOKIE, token, { ...options, maxAge: SESSION_AGE });
  else res.clearCookie(SESSION_COOKIE, options);
}

/** Fixed fields only: never serialize request bodies, credentials or financial notes. */
export function securityEvent(req: Request, event: string, outcome: string, target?: string) {
  console.info(JSON.stringify({ type: "security", at: new Date().toISOString(), event, outcome,
    actor: (req as Request & { userId?: string }).userId || null, target: target || null, client: req.ip }));
}
