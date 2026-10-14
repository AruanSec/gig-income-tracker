import test from "node:test";
import assert from "node:assert/strict";
import { calendarDate, localDateString, formatCurrency, calculateMileageStats, calculateTripDeductions } from "../src/utils";
import type { MileageEntry } from "../src/types";

for (const zone of ["UTC", "America/Toronto", "America/Vancouver"]) {
  test(`calendar boundaries remain stable in ${zone}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      for (const value of ["2026-01-01", "2026-03-01", "2024-02-29", "2026-12-31"]) {
        const date = calendarDate(value);
        assert.equal(localDateString(date), value);
        assert.equal(date.getFullYear(), Number(value.slice(0, 4)));
        assert.equal(date.getMonth(), Number(value.slice(5, 7)) - 1);
      }
      const instant = new Date("2026-01-01T02:00:00Z");
      assert.equal(localDateString(instant), zone === "UTC" ? "2026-01-01" : "2025-12-31");
    } finally {
      if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    }
  });
}

test("currency explicitly identifies Canadian dollars", () => {
  assert.match(formatCurrency(12.34), /CAD/);
  assert.match(formatCurrency(12.34), /12\.34/);
});

test("mileage thresholds split crossing trips and reset each year", () => {
  const trip = (id: string, date: string, distance: number): MileageEntry => ({ id, date, distance,
    purpose: "Test", tripType: "Delivery", startOdometer: 0, endOdometer: distance });
  const entries = [trip("a", "2025-12-30", 4900), trip("b", "2025-12-31", 200), trip("c", "2026-01-01", 200)];
  const rates = ["2025", "2026"].map(year => ({ year, tier1_threshold: 5000, tier1_rate: .8, tier2_rate: .7 }));
  const breakdown = calculateTripDeductions(entries, rates);
  assert.deepEqual(breakdown.b, { tier1Distance: 100, tier2Distance: 100, deduction: 150 });
  assert.equal(breakdown.c.deduction, 160);
  assert.equal(calculateMileageStats(entries, rates).totalDeduction, 4230);
});
