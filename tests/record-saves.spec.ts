import { expect, test, type Page } from "@playwright/test";

let token: string;
test.beforeAll(async ({ request }) => {
  const result = await request.post("/api/auth/signup", { data: {
    email: `forms-${Date.now()}@example.test`, password: "Forms-test-password-2026",
  } });
  expect(result.status()).toBe(201);
  token = (await result.json()).token;
});

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/restore", { headers: { Authorization: `Bearer ${token}` },
    data: { income: [], mileage: [], expenses: [] } });
  expect(response.status()).toBe(200);
});

const forms = [
  { resource: "income", container: "#income-form-container", submit: "#submit-form-btn",
    fields: { startDate: "2026-06-15", endDate: "2026-06-15", trips: "1", onlineMinutes: "60", activeMinutes: "40", netFare: "100", tips: "2", taxes: "1", notes: "Draft income" } },
  { resource: "mileage", container: "#mileage-form-container", submit: "#submit-form-btn",
    fields: { "trip-date": "2026-06-15", "trip-purpose": "Draft delivery", "start-odometer": "100", "end-odometer": "120", "trip-notes": "Draft mileage" } },
  { resource: "expenses", container: "#vehicle-expense-form", submit: "#submit-expense-btn",
    fields: { "expense-date": "2026-06-15", "expense-amount": "20", "expense-gst": "2", "expense-description": "Draft expense" } },
];

async function openForm(page: Page, form: typeof forms[number]) {
  await page.addInitScript(value => localStorage.setItem("gig_auth_token", value), token);
  await page.goto("/");
  await expect(page.locator("#main-log-btn")).toBeVisible();
  if (form.resource !== "income") {
    await page.locator("#tab-mileage-trigger").click();
    if (form.resource === "expenses") await page.locator("#sub-tab-expenses").click();
  }
  await page.locator("#main-log-btn").click();
  for (const [id, value] of Object.entries(form.fields)) await page.locator(`#${id}`).fill(value);
}

for (const form of forms) {
  for (const failure of ["server", "network", "session"] as const) {
    test(`${form.resource}: ${failure} failure preserves draft and permits retry`, async ({ page }) => {
      await openForm(page, form);
      let requests = 0;
      await page.route(`**/api/${form.resource}`, async route => {
        if (route.request().method() !== "POST") return route.continue();
        requests++;
        if (requests > 1) return route.continue();
        if (failure === "network") return route.abort("failed");
        await route.fulfill({ status: failure === "session" ? 401 : 500,
          contentType: "application/json", body: JSON.stringify({ error: "Test save failed" }) });
      });
      await page.locator(form.submit).click();
      const alert = page.locator(form.container).getByRole("alert");
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(failure === "session" ? "session has expired" : failure === "network" ? "Unable to reach" : "Test save failed");
      for (const [id, value] of Object.entries(form.fields)) await expect(page.locator(`#${id}`)).toHaveValue(value);
      await expect(page.locator(form.submit)).toBeEnabled();
      await page.locator(form.submit).click();
      await expect(page.locator(form.container)).toHaveCount(0);
      expect(requests).toBe(2);
    });
  }

  test(`${form.resource}: pending save blocks repeat clicks and keyboard shortcuts`, async ({ page }) => {
    await openForm(page, form);
    let requests = 0;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/${form.resource}`, async route => {
      if (route.request().method() !== "POST") return route.continue();
      requests++;
      await pending;
      await route.continue();
    });
    await page.locator(form.submit).click();
    await expect(page.locator(form.submit)).toBeDisabled();
    await expect(page.locator(form.submit)).toHaveText("Saving…");
    for (let i = 0; i < 3; i++) await page.keyboard.press("Control+s");
    expect(requests).toBe(1);
    release();
    await expect(page.locator(form.container)).toHaveCount(0);
    expect(requests).toBe(1);
  });
}

for (const form of forms) {
  test(`${form.resource}: failed edit preserves changes until a successful retry`, async ({ page }) => {
    await openForm(page, form);
    await page.locator(form.submit).click();
    await expect(page.locator(form.container)).toHaveCount(0);
    const title = form.resource === "income" ? "Edit shift entry" : form.resource === "mileage" ? "Edit trip log" : "Edit expense";
    await page.getByTitle(title, { exact: true }).first().click();
    const field = form.resource === "income" ? "notes" : form.resource === "mileage" ? "trip-purpose" : "expense-description";
    await page.locator(`#${field}`).fill("Edited draft to retain");
    let attempts = 0;
    await page.route(`**/api/${form.resource}/*`, async route => {
      if (route.request().method() !== "PUT") return route.continue();
      if (++attempts > 1) return route.continue();
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Please check this record" }) });
    });
    await page.locator(form.submit).click();
    await expect(page.locator(form.container).getByRole("alert")).toContainText("Please check this record");
    await expect(page.locator(`#${field}`)).toHaveValue("Edited draft to retain");
    await page.locator(form.submit).click();
    await expect(page.locator(form.container)).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}
