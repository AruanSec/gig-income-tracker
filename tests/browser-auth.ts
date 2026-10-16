import { expect, type APIRequestContext, type Page } from "@playwright/test";

let adminToken: string;
export async function createAccount(request: APIRequestContext, email: string, password: string) {
  if (!adminToken) {
    const r = await request.post("/api/auth/login", { headers: { "X-Auth-Mode": "bearer" },
      data: { email: "test-admin@example.test", password: "Disposable-admin-password-2026" } });
    expect(r.status()).toBe(200); adminToken = (await r.json()).token;
  }
  const created = await request.post("/api/admin/users", { headers: { Authorization: `Bearer ${adminToken}` }, data: { email, password } });
  expect(created.status()).toBe(201);
  const result = await request.post("/api/auth/login", { headers: { "X-Auth-Mode": "bearer" }, data: { email, password } });
  expect(result.status()).toBe(200);
  return (await result.json()).token as string;
}
export async function authenticatePage(page: Page, token: string) {
  await page.context().addCookies([{ name: "gig_session", value: token, url: "http://127.0.0.1:4173", httpOnly: true, sameSite: "Strict" }]);
}
