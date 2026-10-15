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

import { addMoney, sumMoney, percentMoney, subtractMoney, roundMoney } from "../src/money";
import { parseIncome, parseExpense } from "../src/validation";
import { getRatesForYear, missingRateYears, calculateStats } from "../src/utils";

test("money rounds decimal ties symmetrically and sums without binary drift", () => {
  assert.equal(addMoney(.1, .2), .3);
  assert.equal(subtractMoney(.3, .2), .1);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(percentMoney(.1, 85), .09);
  assert.equal(sumMoney(Array(1000).fill(.01), value => value), 10);
  const base = { startDate: "2026-01-01", endDate: "2026-01-01", trips: 1, onlineMinutes: 60, activeMinutes: 30, netFare: .1, tips: .2, taxes: .2 };
  assert.equal(parseIncome(base).totalEarnings, .1);
  assert.equal(calculateStats(["a", "b", "c"].map(id => ({ id, ...parseIncome(base) }))).totalEarnings, .3);
  for (const bad of [1.005, 10_000_000_000]) {
    assert.throws(() => parseIncome({ ...base, netFare: bad }));
    assert.throws(() => parseExpense({ date: base.startDate, category: "Fuel", description: "Fuel", amount: bad }));
  }
});

test("missing-year rates never borrow another year's values or generate estimates", () => {
  const rates = [{ year: "2026", tier1_threshold: 5000, tier1_rate: .8, tier2_rate: .7 }];
  for (const year of ["2024", "2025", "2027"]) assert.equal(getRatesForYear(year, rates).configured, false);
  assert.equal(getRatesForYear("2026").configured, false);
  const trip: MileageEntry = { id: "unknown", date: "2027-01-01", distance: 100, startOdometer: 0, endOdometer: 100, purpose: "Test", tripType: "Delivery" };
  assert.deepEqual(missingRateYears([trip], rates), ["2027"]);
  assert.deepEqual(calculateTripDeductions([trip], rates), {});
  assert.equal(calculateMileageStats([trip], rates).totalKm, 100);
  assert.equal(calculateMileageStats([trip], rates).totalDeduction, 0);
});

test("filtered mileage retains earlier annual usage and trip rounding reconciles", () => {
  const trip = (id: string, date: string, distance: number): MileageEntry => ({ id, date, distance, startOdometer: 0, endOdometer: distance, purpose: "Test", tripType: "Delivery" });
  const rates = [{ year: "2026", tier1_threshold: 5000, tier1_rate: .8, tier2_rate: .7 }];
  const entries = [trip("a", "2026-03-31", 4999.99), trip("b", "2026-04-01", .02), trip("c", "2026-04-02", .01)];
  const calculated = calculateTripDeductions(entries, rates);
  assert.deepEqual(calculated.b, { tier1Distance: .01, tier2Distance: .01, deduction: .02 });
  assert.equal(sumMoney(entries.filter(e => e.date.startsWith("2026-04")), e => calculated[e.id].deduction), .03);
  assert.equal(calculateMileageStats(entries, rates).totalDeduction, sumMoney(Object.values(calculated), e => e.deduction));
  assert.deepEqual(calculateTripDeductions([...entries].reverse(), rates), calculated);
});

import { dateRangeForPreset } from "../src/utils";
for (const zone of ["UTC", "America/Toronto", "America/Vancouver"]) {
  test(`date presets retain local calendar boundaries late at night in ${zone}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      const now = new Date(2026, 0, 1, 23, 30);
      assert.deepEqual(dateRangeForPreset("this-week", now), ["2025-12-29", "2026-01-01"]);
      assert.deepEqual(dateRangeForPreset("last-week", now), ["2025-12-22", "2025-12-28"]);
      assert.deepEqual(dateRangeForPreset("this-month", now), ["2026-01-01", "2026-01-01"]);
      assert.deepEqual(dateRangeForPreset("last-month", now), ["2025-12-01", "2025-12-31"]);
      assert.deepEqual(dateRangeForPreset("this-year", now), ["2026-01-01", "2026-01-01"]);
      assert.deepEqual(dateRangeForPreset("last-month", new Date(2024, 2, 31, 23, 30)), ["2024-02-01", "2024-02-29"]);
      assert.deepEqual(dateRangeForPreset("all", now), ["", ""]);
    } finally {
      if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    }
  });
}

test("same-day mileage allocation is stable when API ordering changes", () => {
  const entries: MileageEntry[] = ["b", "a"].map(id => ({ id, date: "2026-01-01", distance: .75, startOdometer: 0, endOdometer: .75, purpose: "Test", tripType: "Delivery" }));
  const rates = [{ year: "2026", tier1_threshold: 1, tier1_rate: .8, tier2_rate: .7 }];
  const result = calculateTripDeductions(entries, rates);
  assert.equal(result.a.deduction, .6);
  assert.equal(result.b.deduction, .55);
  assert.deepEqual(result, calculateTripDeductions([...entries].reverse(), rates));
});
