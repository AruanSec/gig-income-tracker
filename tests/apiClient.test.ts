import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, deleteRecord, fetchJson } from "../src/api";

test("fetchJson returns parsed JSON", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ value: 42 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  assert.deepEqual(await fetchJson<{ value: number }>("/api/example"), { value: 42 });
});

test("fetchJson provides a consistent session-expiry error", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "internal wording" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    fetchJson("/api/example"),
    (error: unknown) => error instanceof ApiError && error.status === 401 && error.message.includes("session has expired"),
  );
});

test("deleteRecord encodes IDs and rejects server errors", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestUrl = "";
  globalThis.fetch = async input => {
    requestUrl = String(input);
    return new Response(JSON.stringify({ error: "Record is locked." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  };

  await assert.rejects(deleteRecord("income", "id/with spaces"), /Record is locked/);
  assert.equal(requestUrl, "/api/income/id%2Fwith%20spaces");
});
