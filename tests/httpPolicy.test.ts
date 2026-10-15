import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { authenticationRateLimit, configureProxy, requestErrorHandler, apiError } from "../src/httpPolicy";
import { ValidationError } from "../src/validation";

async function serve(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

for (const trusted of [false, true]) {
  test(`forwarded clients ${trusted ? "have separate limits behind an explicitly trusted proxy" : "cannot bypass limits through untrusted forwarding headers"}`, async () => {
    const app = express(); configureProxy(app, trusted ? "127.0.0.1/32" : "");
    app.post("/login", authenticationRateLimit(), (_req, res) => { res.status(400).json({ error: "Invalid credentials" }); });
    await serve(app, async base => {
      const attempt = (forwarded: string) => fetch(base + "/login", { method: "POST", headers: { "X-Forwarded-For": forwarded } });
      for (let i = 0; i < 20; i++) assert.equal((await attempt("198.51.100.1")).status, 400);
      const blocked = await attempt("198.51.100.1");
      assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
      assert.equal((await attempt("198.51.100.2")).status, trusted ? 400 : 429);
      assert.equal((await attempt("203.0.113.99, 198.51.100.1")).status, 429);
    });
  });
}

test("proxy configuration fails closed for blanket trust, hop counts and invalid CIDRs", () => {
  for (const setting of ["true", "1", "0.0.0.0/0", "::/0", "127.0.0.1/33", "127.0.0.1/8/9", "unknown"]) {
    assert.throws(() => configureProxy(express(), setting), /TRUST_PROXY/);
  }
  configureProxy(express(), "127.0.0.1/32,::1/128");
});

test("bounded rate-limit state expires and does not evict an active blocked client", t => {
  let now = 1000; t.mock.method(Date, "now", () => now);
  const limiter = authenticationRateLimit(1000, 1, 1);
  function attempt(ip: string) {
    let status = 200;
    const res = { setHeader() {}, status(value: number) { status = value; return this; }, json() {} };
    limiter({ ip } as any, res as any, () => {}); return status;
  }
  assert.equal(attempt("a"), 200); assert.equal(attempt("a"), 429); assert.equal(attempt("b"), 429);
  now = 2001;
  assert.equal(attempt("b"), 200); assert.equal(attempt("b"), 429);
});

test("JSON/parser, validation and database conflicts have safe client responses", async () => {
  const app = express(); app.use(express.json({ limit: "2mb" }));
  app.post("/body", (_req, res) => { res.json({ ok: true }); });
  app.get("/validation", (_req, res) => { apiError(res, new ValidationError("Invalid year.")); });
  app.get("/conflict", (_req, res) => { apiError(res, { code: "23505", message: "private index detail" }); });
  app.use(requestErrorHandler);
  await serve(app, async base => {
    for (const [body, status] of [["{invalid", 400], [JSON.stringify({ value: "x".repeat(2 * 1024 * 1024) }), 413]] as const) {
      const response = await fetch(base + "/body", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      assert.equal(response.status, status); assert.deepEqual(Object.keys(await response.json()), ["error"]);
    }
    assert.equal((await fetch(base + "/validation")).status, 400);
    const conflict = await fetch(base + "/conflict"); assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { error: "A record with these details already exists." });
  });
});
