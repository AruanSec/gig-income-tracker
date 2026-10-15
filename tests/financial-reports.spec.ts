import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const timezoneId of ["UTC", "America/Toronto", "America/Vancouver"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });
    test("reports retain dates, cents, losses, CAD, and the selected planning method", async ({ page, request }) => {
      const signup = await request.post("/api/auth/signup", { data: {
        email: `report-${Date.now()}@example.test`, password: "Report-test-password-2026",
      } });
      expect(signup.status()).toBe(201);
      const token = (await signup.json()).token;
      const restore = await request.post("/api/restore", { headers: { Authorization: `Bearer ${token}` }, data: {
        schemaVersion: 1,
        income: [{ startDate: "2026-01-01", endDate: "2026-01-01", trips: 1, onlineMinutes: 60, activeMinutes: 30, netFare: 10.25, tips: .5, taxes: 0 }],
        mileage: [{ date: "2026-01-01", purpose: "Delivery", startOdometer: 0, endOdometer: 10000, tripType: "Delivery" }],
        expenses: [{ date: "2026-01-01", category: 'Fuel "special" #1', amount: 20, description: "Fuel", gstHstEligible: false }],
        craRates: [{ year: "2026", tier1_threshold: 5000, tier1_rate: .8, tier2_rate: .7 }],
      } });
      expect(restore.status()).toBe(200);
      await page.addInitScript(value => localStorage.setItem("gig_auth_token", value), token);
      await page.goto("/");
      await page.locator("#tab-tax-trigger").click();
      await expect(page.locator("#planning-method")).toHaveValue("actual");
      await page.locator("#tax-tab-view select").first().selectOption("2026");
      async function exportCsv() {
        const pending = page.waitForEvent("download");
        await page.locator("#export-csv-btn").click();
        const download = await pending;
        return readFile((await download.path())!, "utf8");
      }
      await expect(page.locator("#tax-tab-view")).toContainText(/CAD\s+10\.75/);
      const actual = await exportCsv();
      expect(actual).toContain('"Amount (CAD)"');
      expect(actual).toContain('"Gross Income (Net Fare + Tips)","10.75"');
      expect(actual).toContain('"Estimated Profit / Loss","-6.25"');
      expect(actual).toContain('"January","10.75","20.00","17.00","-6.25"');
      expect(actual).toContain('Fuel ""special"" #1');
      expect(actual).not.toContain("RECOMMENDED METHOD");
      await expect(page.locator("#tax-tab-view")).toContainText("CAD");
      await page.locator("#planning-method").selectOption("standard");
      const comparison = await exportCsv();
      expect(comparison).toContain('"Planning Expense Estimate","7500.00"');
      expect(comparison).toContain('"Estimated Profit / Loss","-7489.25"');
      expect(comparison).toContain('"January","10.75","20.00","7500.00","-7489.25"');
    });
  });
}

for (const timezoneId of ["UTC", "America/Toronto", "America/Vancouver"]) {
  test.describe(`period boundaries in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("quarter/month retain annual tiers, spanning income uses start date, and missing rates are explicit", async ({ page, request }) => {
      const signup = await request.post("/api/auth/signup", { data: { email: `boundaries-${Date.now()}@example.test`, password: "Boundary-password-2026" } });
      const token = (await signup.json()).token;
      const baseIncome = { trips: 1, onlineMinutes: 60, activeMinutes: 30, tips: 0, taxes: 0 };
      const trip = (date: string, distance: number) => ({ date, startOdometer: 0, endOdometer: distance, purpose: "Delivery", tripType: "Delivery" });
      const restore = await request.post("/api/restore", { headers: { Authorization: `Bearer ${token}` }, data: {
        schemaVersion: 1,
        income: [{ ...baseIncome, startDate: "2025-12-31", endDate: "2026-01-02", netFare: 100.03 },
          { ...baseIncome, startDate: "2026-04-01", endDate: "2026-04-01", netFare: .1, tips: .2 }],
        mileage: [trip("2026-03-31", 4999.99), trip("2026-04-01", .02), trip("2026-04-02", .01), trip("2027-01-01", 100)],
        expenses: [1, 2].map(i => ({ date: `2026-04-0${i}`, category: "Fuel", amount: .1, description: "Receipt", gstHstEligible: true, gstHstAmount: .01 })),
        craRates: [{ year: "2026", tier1_threshold: 5000, tier1_rate: .8, tier2_rate: .7 }],
      } });
      expect(restore.status()).toBe(200);
      await page.addInitScript(value => localStorage.setItem("gig_auth_token", value), token);
      await page.goto("/");
      await page.locator("#tab-tax-trigger").click();
      const report = page.locator("#tax-profit-summary-view");
      await expect(report).toContainText("Excluded rate years: 2027");
      const year = report.locator("select").first();
      await year.selectOption("2026");
      async function csv() {
        const pending = page.waitForEvent("download");
        await page.locator("#export-csv-btn").click();
        return readFile((await (await pending).path())!, "utf8");
      }
      await report.getByRole("button", { name: "Quarter", exact: true }).click();
      await report.getByRole("button", { name: "Q2", exact: true }).click();
      let content = await csv();
      expect(content).toContain('"Gross Income (Net Fare + Tips)","0.30"');
      expect(content).toContain('"Planning Expense Estimate","0.18"');
      expect(content).toContain('"Tracked GST/HST","0.02"');
      expect(content).toContain('"Estimated Profit / Loss","0.12"');
      await page.locator("#planning-method").selectOption("standard");
      content = await csv();
      expect(content).toContain('"Planning Expense Estimate","0.03"');
      expect(content).toContain('"Rate coverage","INCOMPLETE"');
      await report.getByRole("button", { name: "Month", exact: true }).click();
      await report.locator("select").nth(1).selectOption("4");
      expect(await csv()).toContain('"Planning Expense Estimate","0.03"');
      await report.getByRole("button", { name: "Annual", exact: true }).click();
      await year.selectOption("2025");
      expect(await csv()).toContain('"Gross Income (Net Fare + Tips)","100.03"');
    });
  });
}
