import express from "express";
import net from "node:net";
import { ValidationError } from "./validation";

export function configureProxy(app: express.Express, setting = process.env.TRUST_PROXY || ""): void {
  const proxies = setting.split(",").map(value => value.trim()).filter(Boolean);
  for (const proxy of proxies) {
    const [address, prefix, extra] = proxy.split("/");
    const family = net.isIP(address);
    if (!family || extra !== undefined || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (family === 4 ? 32 : 128)))) {
      throw new Error("TRUST_PROXY must contain explicit IP addresses or nonzero CIDR ranges, separated by commas.");
    }
  }
  app.set("trust proxy", proxies.length ? proxies : false);
}

export function apiError(res: express.Response, error: unknown) {
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  const code = (error as { code?: string })?.code;
  if (code === "23505" || code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
    return res.status(409).json({ error: "A record with these details already exists." });
  }
  console.error("API request failed:", error);
  return res.status(500).json({ error: "An unexpected server error occurred." });
}

export const requestErrorHandler: express.ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === "entity.parse.failed") { res.status(400).json({ error: "Request body must contain valid JSON." }); return; }
  if (error?.type === "entity.too.large") { res.status(413).json({ error: "Request body exceeds the 2 MB limit." }); return; }
  if (error?.type === "encoding.unsupported" || error?.type === "charset.unsupported") {
    res.status(415).json({ error: "Unsupported request encoding or character set." }); return;
  }
  if (error?.type === "request.aborted" || error?.type === "request.size.invalid") {
    res.status(400).json({ error: "Request body was incomplete." }); return;
  }
  apiError(res, error);
};

/** Per-process fixed windows; bound memory and expire idle clients. */
export function authenticationRateLimit(windowMs = 15 * 60_000, maxAttempts = 20, maxClients = 10_000): express.RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let current = attempts.get(key);
    if (current && current.resetAt <= now) { attempts.delete(key); current = undefined; }
    if (!current) {
      if (attempts.size >= maxClients) {
        for (const [client, state] of attempts) if (state.resetAt <= now) attempts.delete(client);
        if (attempts.size >= maxClients) {
          res.setHeader("Retry-After", "60");
          res.status(429).json({ error: "Authentication is busy. Try again later." }); return;
        }
      }
      attempts.set(key, { count: 1, resetAt: now + windowMs }); next(); return;
    }
    if (current.count >= maxAttempts) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
      res.status(429).json({ error: "Too many authentication attempts. Try again later." }); return;
    }
    current.count += 1;
    next();
  };
}
