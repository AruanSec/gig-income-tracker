import assert from "node:assert";
import { calculateStats } from "./src/utils";
import { IncomeEntry } from "./src/types";
import { parseExpense, parseIncome, parseMileage, ValidationError } from "./src/validation";

console.log("=========================================");
console.log("🧪 RUNNING UNIT TESTS FOR WEEKLY INCOME LOG");
console.log("=========================================\n");

try {
  // Test case 1: Empty list of entries
  console.log("▶ Test 1: Empty list of weekly income entries");
  const emptyStats = calculateStats([]);
  assert.strictEqual(emptyStats.totalEarnings, 0);
  assert.strictEqual(emptyStats.totalNetFare, 0);
  assert.strictEqual(emptyStats.totalTips, 0);
  assert.strictEqual(emptyStats.totalTaxes, 0);
  assert.strictEqual(emptyStats.totalTrips, 0);
  assert.strictEqual(emptyStats.totalOnlineMinutes, 0);
  assert.strictEqual(emptyStats.totalActiveMinutes, 0);
  assert.strictEqual(emptyStats.averageEarningsPerTrip, 0);
  assert.strictEqual(emptyStats.averageEarningsPerHourOnline, 0);
  assert.strictEqual(emptyStats.averageEarningsPerHourActive, 0);
  console.log("✅ Test 1 Passed!\n");

  // Test case 2: Single weekly income entry
  console.log("▶ Test 2: Single weekly income entry calculations");
  const entries: IncomeEntry[] = [
    {
      id: "entry-1",
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      trips: 20,
      onlineMinutes: 1200, // 20 hours
      activeMinutes: 600, // 10 hours
      netFare: 400,
      tips: 100,
      taxes: 20,
      totalEarnings: 480, // netFare + tips - taxes
    }
  ];

  const singleStats = calculateStats(entries);
  assert.strictEqual(singleStats.totalEarnings, 480);
  assert.strictEqual(singleStats.totalNetFare, 400);
  assert.strictEqual(singleStats.totalTips, 100);
  assert.strictEqual(singleStats.totalTaxes, 20);
  assert.strictEqual(singleStats.totalTrips, 20);
  assert.strictEqual(singleStats.totalOnlineMinutes, 1200);
  assert.strictEqual(singleStats.totalActiveMinutes, 600);
  
  // Averages calculations:
  // averageEarningsPerTrip = 480 / 20 = 24
  assert.strictEqual(singleStats.averageEarningsPerTrip, 24);
  // averageEarningsPerHourOnline = 480 / 20 hours = 24
  assert.strictEqual(singleStats.averageEarningsPerHourOnline, 24);
  // averageEarningsPerHourActive = 480 / 10 hours = 48
  assert.strictEqual(singleStats.averageEarningsPerHourActive, 48);
  console.log("✅ Test 2 Passed!\n");

  // Test case 3: Multiple weekly income entries with varying data
  console.log("▶ Test 3: Multiple weekly income entries calculations");
  const multipleEntries: IncomeEntry[] = [
    {
      id: "entry-1",
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      trips: 10,
      onlineMinutes: 600, // 10 hours
      activeMinutes: 300, // 5 hours
      netFare: 200,
      tips: 50,
      taxes: 10,
      totalEarnings: 240,
    },
    {
      id: "entry-2",
      startDate: "2026-06-08",
      endDate: "2026-06-14",
      trips: 15,
      onlineMinutes: 900, // 15 hours
      activeMinutes: 600, // 10 hours
      netFare: 300,
      tips: 70,
      taxes: 15,
      totalEarnings: 355,
    }
  ];

  const multiStats = calculateStats(multipleEntries);
  // totalEarnings = 240 + 355 = 595
  assert.strictEqual(multiStats.totalEarnings, 595);
  // totalNetFare = 200 + 300 = 500
  assert.strictEqual(multiStats.totalNetFare, 500);
  // totalTips = 50 + 70 = 120
  assert.strictEqual(multiStats.totalTips, 120);
  // totalTaxes = 10 + 15 = 25
  assert.strictEqual(multiStats.totalTaxes, 25);
  // totalTrips = 10 + 15 = 25
  assert.strictEqual(multiStats.totalTrips, 25);
  // totalOnlineMinutes = 600 + 900 = 1500 (25 hours)
  assert.strictEqual(multiStats.totalOnlineMinutes, 1500);
  // totalActiveMinutes = 300 + 600 = 900 (15 hours)
  assert.strictEqual(multiStats.totalActiveMinutes, 900);

  // Averages calculations:
  // averageEarningsPerTrip = 595 / 25 = 23.8
  assert.strictEqual(multiStats.averageEarningsPerTrip, 23.8);
  // averageEarningsPerHourOnline = 595 / 25 hours = 23.8
  assert.strictEqual(multiStats.averageEarningsPerHourOnline, 23.8);
  // averageEarningsPerHourActive = 595 / 15 hours = 39.666666...
  assert.ok(Math.abs(multiStats.averageEarningsPerHourActive - (595 / 15)) < 1e-9);
  console.log("✅ Test 3 Passed!\n");

  console.log("▶ Test 4: Server validation recalculates derived values");
  const validatedIncome = parseIncome({ startDate: "2026-01-01", endDate: "2026-01-01", trips: 1, onlineMinutes: 60, activeMinutes: 45, netFare: 10, tips: 2, taxes: 1, totalEarnings: 999 });
  assert.strictEqual(validatedIncome.totalEarnings, 11);
  const validatedMileage = parseMileage({ date: "2026-01-01", purpose: "Delivery", startOdometer: 100, endOdometer: 112.5, distance: 999, tripType: "Delivery" });
  assert.strictEqual(validatedMileage.distance, 12.5);
  assert.throws(() => parseExpense({ date: "2026-01-01", category: "Fuel", amount: 10, description: "Fuel", gstHstEligible: true, gstHstAmount: 11 }), ValidationError);
  assert.throws(() => parseIncome({ startDate: "2026-01-02", endDate: "2026-01-01", trips: 1, onlineMinutes: 60, activeMinutes: 30, netFare: 1, tips: 0, taxes: 0 }), ValidationError);
  console.log("✅ Test 4 Passed!\n");

  console.log("=========================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("=========================================");
  process.exit(0);
} catch (error) {
  console.error("\n❌ TEST FAILED!");
  console.error(error);
  process.exit(1);
}
