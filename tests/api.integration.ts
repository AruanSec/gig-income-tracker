import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import Database from "better-sqlite3";
import pg from "pg";

// TEST_DATABASE_URL must point to a disposable PostgreSQL database when supplied.
test("financial API regressions", { timeout: 180_000 }, async t => {
  const tmp = await mkdtemp(path.join(tmpdir(), "gig-api-"));
  const dbPath = path.join(tmp, "test.sqlite");
  const socket = net.createServer();
  await new Promise<void>(resolve => socket.listen(0, "127.0.0.1", resolve));
  const port = (socket.address() as net.AddressInfo).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const base = `http://127.0.0.1:${port}`;
  const url = process.env.TEST_DATABASE_URL;
  const app = spawn(process.execPath, url ? ["dist/server.cjs"] : ["--import", "tsx", "server.ts"], {
    env: { ...process.env, NODE_ENV: url ? "production" : "development", DISABLE_HMR: "true", PORT: String(port),
      DATABASE_URL: url || "postgresql://test:test@127.0.0.1:1/test", DB_PATH: dbPath, GEMINI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  app.stdout.on("data", data => logs += data); app.stderr.on("data", data => logs += data);
  async function api(method: string, endpoint: string, data?: unknown, token?: string) {
    const response = await fetch(base + endpoint, { method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    let ready = false;
    for (let i = 0; i < 360; i++) {
      if (app.exitCode !== null) throw new Error(logs);
      try { if ((await api("GET", "/api/health")).status === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, logs);
    const suffix = Date.now();
    const email = `api-${suffix}@example.test`;
    const password = "API-test-password-2026";
    const signup = await api("POST", "/api/auth/signup", { email, password });
    assert.equal(signup.status, 201);
    const token = signup.body.token;
    const income = { startDate: "2026-01-01", endDate: "2026-01-01", trips: 1,
      onlineMinutes: 60, activeMinutes: 30, netFare: 100, tips: 2, taxes: 1, notes: "Test" };
    const mileage = { date: "2026-01-01", purpose: "Delivery", startOdometer: 100, endOdometer: 120, tripType: "Delivery" };
    const expense = { date: "2026-01-01", category: "Fuel", amount: 20, description: "Test fuel", gstHstEligible: true, gstHstAmount: 2 };
    const rate = { year: "2026", tier1_threshold: 5000, tier1_rate: 0.8, tier2_rate: 0.7 };
    await t.test("malformed and non-object JSON produce safe JSON errors", async () => {
      for (const body of ["{broken", "[]", "null"]) {
        const response = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        assert.equal(response.status, 400); assert.deepEqual(Object.keys(await response.json()), ["error"]);
      }
    });
    await t.test("real accounts start with empty financial ledgers", async () => {
      for (const resource of ["income", "mileage", "expenses"]) assert.deepEqual((await api("GET", `/api/${resource}`, undefined, token)).body, []);
    });
    await t.test("rate settings start empty and do not regenerate unverified presets", async () => {
      assert.deepEqual((await api("GET", "/api/settings/cra-rates", undefined, token)).body, []);
      assert.deepEqual((await api("GET", "/api/settings/cra-rates", undefined, token)).body, []);
    });
    await t.test("invalid sessions and ordinary admin access are rejected", async () => {
      assert.equal((await api("GET", "/api/income")).status, 401);
      assert.equal((await api("GET", "/api/admin/users", undefined, token)).status, 403);
    });
    await t.test("calendar dates, numeric types, and rate settings are validated", async () => {
      for (const value of [null, "", true, "123", {}, []]) assert.equal((await api("POST", "/api/income", { ...income, netFare: value }, token)).status, 400);
      assert.equal((await api("POST", "/api/income", { ...income, startDate: "2026-02-30", endDate: "2026-03-02" }, token)).status, 400);
      assert.equal((await api("POST", "/api/income", { ...income, startDate: "2024-02-29", endDate: "2024-02-29" }, token)).status, 201);
      for (const bad of [{ ...rate, tier1_rate: -0.1 }, { ...rate, year: "oops" }, { ...rate, tier1_threshold: null }]) assert.equal((await api("POST", "/api/settings/cra-rates", bad, token)).status, 400);
    });
    await t.test("money rejects sub-cent input and round trips decimal earnings", async () => {
      for (const netFare of [1.005, 10_000_000_000]) assert.equal((await api("POST", "/api/income", { ...income, netFare }, token)).status, 400);
      assert.equal((await api("POST", "/api/expenses", { ...expense, gstHstAmount: .005 }, token)).status, 400);
      const created = await api("POST", "/api/income", { ...income, netFare: .1, tips: .2, taxes: .2 }, token);
      assert.equal(created.status, 201); assert.equal(created.body.totalEarnings, .1);
      const saved = (await api("GET", "/api/income", undefined, token)).body.find((entry: any) => entry.id === created.body.id);
      assert.equal(saved.netFare, .1); assert.equal(saved.totalEarnings, .1);
      await api("DELETE", `/api/income/${created.body.id}`, undefined, token);
    });
    await t.test("record writes derive values and reject cross-user writes", async () => {
      const second = await api("POST", "/api/auth/signup", { email: `other-${suffix}@example.test`, password });
      for (const [resource, data, field, expected] of [["income", income, "totalEarnings", 101], ["mileage", mileage, "distance", 20], ["expenses", expense, "amount", 20]] as const) {
        const result = await api("POST", `/api/${resource}`, data, token);
        assert.equal(result.status, 201); assert.equal(result.body[field], expected);
        assert.equal((await api("PUT", `/api/${resource}/${result.body.id}`, data, second.body.token)).status, 404);
        assert.equal((await api("DELETE", `/api/${resource}/${result.body.id}`, undefined, second.body.token)).status, 404);
      }
    });
    await t.test("versioned backups round trip custom rates and records", async () => {
      assert.equal((await api("POST", "/api/settings/cra-rates", rate, token)).status, 200);
      const backup = (await api("GET", "/api/backup", undefined, token)).body;
      assert.equal(backup.schemaVersion, 1); assert.ok(backup.craRates.some((r: any) => r.year === "2026" && r.tier1_rate === 0.8));
      await api("POST", "/api/settings/cra-rates", { ...rate, tier1_rate: 0.9 }, token);
      assert.equal((await api("POST", "/api/restore", backup, token)).status, 200);
      const restored = (await api("GET", "/api/backup", undefined, token)).body;
      const canonical = (data: any) => JSON.stringify(data, (key, value) => ["id", "user_id"].includes(key) ? undefined : value);
      assert.equal(canonical(restored), canonical(backup));
      assert.equal((await api("POST", "/api/restore", { ...backup, schemaVersion: 999 }, token)).status, 400);
      assert.equal((await api("POST", "/api/restore", { ...backup, craRates: [{ ...rate, tier1_rate: -1 }] }, token)).status, 400);
      assert.equal(canonical((await api("GET", "/api/backup", undefined, token)).body), canonical(restored));
    });
    await t.test("legacy backups preserve existing custom rate settings", async () => {
      const before = (await api("GET", "/api/settings/cra-rates", undefined, token)).body;
      assert.equal((await api("POST", "/api/restore", { income: [income], mileage: [mileage], expenses: [expense] }, token)).status, 200);
      assert.deepEqual((await api("GET", "/api/settings/cra-rates", undefined, token)).body, before);
    });
    await t.test("invalid restore is atomic", async () => {
      const before = (await api("GET", "/api/backup", undefined, token)).body;
      assert.equal((await api("POST", "/api/restore", { income: [income, { ...income, netFare: null }], mileage: [], expenses: [] }, token)).status, 400);
      assert.deepEqual((await api("GET", "/api/backup", undefined, token)).body, before);
    });
    await t.test("password validation returns 400 and user change revokes other sessions", async () => {
      const second = await api("POST", "/api/auth/login", { email, password });
      assert.equal((await api("POST", "/api/auth/change-password", { oldPassword: password, newPassword: "short" }, token)).status, 400);
      assert.equal((await api("POST", "/api/auth/change-password", { oldPassword: password, newPassword: "New-test-password-2026" }, token)).status, 200);
      assert.equal((await api("GET", "/api/auth/me", undefined, second.body.token)).status, 401);
    });
    await t.test("database errors are hidden and health checks execute without authentication", async () => {
      const pool = url ? new pg.Pool({ connectionString: url }) : null;
      const sqlite = url ? null : new Database(dbPath);
      const change = async (sql: string) => { if (pool) await pool.query(sql); else sqlite!.exec(sql); };
      try {
        await change("ALTER TABLE income_entries RENAME TO private_failure_detail");
        const failed = await api("GET", "/api/income", undefined, token);
        assert.equal(failed.status, 500);
        assert.deepEqual(failed.body, { error: "An unexpected server error occurred." });
        assert.equal((await api("GET", "/api/health")).status, 200);
        assert.equal((await api("GET", "/api/live")).status, 200);
        assert.equal((await api("GET", "/api/no-such-endpoint")).status, 404);
      } finally {
        await change("ALTER TABLE private_failure_detail RENAME TO income_entries");
        sqlite?.close(); if (pool) await pool.end();
      }
    });
    await t.test("admin password reset invalidates existing sessions", async () => {
      if (url) {
        const pool = new pg.Pool({ connectionString: url });
        try { await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]); } finally { await pool.end(); }
      } else {
        const db = new Database(dbPath); try { db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email); } finally { db.close(); }
      }
      const otherEmail = `reset-${suffix}@example.test`;
      const other = await api("POST", "/api/auth/signup", { email: otherEmail, password });
      for (const data of [{ email: "bad", password, role: "user" }, { email: "valid@example.test", password: "short", role: "user" }, { email: "valid@example.test", password, role: "root" }]) {
        assert.equal((await api("POST", "/api/admin/users", data, token)).status, 400);
      }
      const users = (await api("GET", "/api/admin/users", undefined, token)).body;
      const target = users.find((u: any) => u.email === otherEmail);
      assert.equal((await api("PUT", `/api/admin/users/${target.id}`, { email: otherEmail, role: "user", password: "Reset-test-password-2026" }, token)).status, 200);
      assert.equal((await api("GET", "/api/auth/me", undefined, other.body.token)).status, 401);
      assert.equal((await api("POST", "/api/auth/login", { email: otherEmail, password: "Reset-test-password-2026" })).status, 200);
    });
  } finally {
    const closed = once(app, "exit"); app.kill("SIGTERM"); await closed;
    await rm(tmp, { recursive: true, force: true });
  }
});

test("production exits unsuccessfully when PostgreSQL is unavailable", { timeout: 30_000 }, async () => {
  const app = spawn(process.execPath, ["dist/server.cjs"], { env: { ...process.env,
    NODE_ENV: "production", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }, stdio: "ignore" });
  const [code] = await once(app, "exit");
  assert.notEqual(code, 0);
});
