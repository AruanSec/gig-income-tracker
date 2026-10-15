import { FinancialDecimal, addMoney, sumMoney, roundMoney } from "./money";
import { IncomeEntry, IncomeStats, MileageEntry, MileageStats, CraRate } from "./types";

export function calculateStats(entries: IncomeEntry[]): IncomeStats {
  const stats: IncomeStats = {
    totalEarnings: 0,
    totalNetFare: 0,
    totalTips: 0,
    totalTaxes: 0,
    totalTrips: 0,
    totalOnlineMinutes: 0,
    totalActiveMinutes: 0,
    averageEarningsPerTrip: 0,
    averageEarningsPerHourOnline: 0,
    averageEarningsPerHourActive: 0,
  };

  if (entries.length === 0) {
    return stats;
  }

  entries.forEach((entry) => {
    stats.totalEarnings = addMoney(stats.totalEarnings, entry.totalEarnings);
    stats.totalNetFare = addMoney(stats.totalNetFare, entry.netFare);
    stats.totalTips = addMoney(stats.totalTips, entry.tips);
    stats.totalTaxes = addMoney(stats.totalTaxes, entry.taxes);
    stats.totalTrips += entry.trips;
    stats.totalOnlineMinutes += entry.onlineMinutes;
    stats.totalActiveMinutes += entry.activeMinutes;
  });

  stats.averageEarningsPerTrip = stats.totalTrips > 0 
    ? stats.totalEarnings / stats.totalTrips 
    : 0;

  const totalOnlineHours = stats.totalOnlineMinutes / 60;
  stats.averageEarningsPerHourOnline = totalOnlineHours > 0 
    ? stats.totalEarnings / totalOnlineHours 
    : 0;

  const totalActiveHours = stats.totalActiveMinutes / 60;
  stats.averageEarningsPerHourActive = totalActiveHours > 0 
    ? stats.totalEarnings / totalActiveHours 
    : 0;

  return stats;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "code",
  }).format(value);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/** Calendar dates are local calendar values, not UTC instants. */
export function calendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(12, 0, 0, 0);
  return result;
}

export function localDateString(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = calendarDate(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return formatDate(start);
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Only an explicitly configured matching year may supply a planning rate. */
export function getRatesForYear(year: string, customRates: CraRate[] = []) {
  const rate = customRates.find(rate => rate.year === year);
  return rate ? { threshold: rate.tier1_threshold, tier1: rate.tier1_rate, tier2: rate.tier2_rate, configured: true }
    : { threshold: 0, tier1: 0, tier2: 0, configured: false };
}

export function missingRateYears(entries: MileageEntry[], rates: CraRate[] = []): string[] {
  return [...new Set(entries.map(entry => entry.date.slice(0, 4)))].filter(year => !getRatesForYear(year, rates).configured).sort();
}

export function calculateMileageStats(entries: MileageEntry[], customRates?: CraRate[]): MileageStats {
  const trips = calculateTripDeductions(entries, customRates);
  return {
    totalKm: entries.reduce((sum, entry) => new FinancialDecimal(sum).plus(entry.distance).toNumber(), 0),
    tier1Km: Object.values(trips).reduce((sum, trip) => new FinancialDecimal(sum).plus(trip.tier1Distance).toNumber(), 0),
    tier2Km: Object.values(trips).reduce((sum, trip) => new FinancialDecimal(sum).plus(trip.tier2Distance).toNumber(), 0),
    totalDeduction: sumMoney(Object.values(trips), trip => trip.deduction),
    tripCount: entries.length,
  };
}

/** Allocate annual tiers before period filtering; round each trip half up to cents.
 * Same-day ties use ID order, so filtering and API ordering cannot reallocate tiers.
 * Missing-year estimates are excluded and must be accompanied by a visible warning.
 */
export function calculateTripDeductions(entries: MileageEntry[], customRates?: CraRate[]): Record<string, { tier1Distance: number; tier2Distance: number; deduction: number }> {
  const results: Record<string, { tier1Distance: number; tier2Distance: number; deduction: number }> = {};
  const accumulated: Record<string, InstanceType<typeof FinancialDecimal>> = {};
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const year = entry.date.slice(0, 4);
    const rate = getRatesForYear(year, customRates);
    if (!rate.configured) continue;
    const prior = accumulated[year] || new FinancialDecimal(0);
    const distance = new FinancialDecimal(entry.distance);
    const remaining = FinancialDecimal.max(0, new FinancialDecimal(rate.threshold).minus(prior));
    const tier1 = FinancialDecimal.min(distance, remaining);
    const tier2 = distance.minus(tier1);
    results[entry.id] = { tier1Distance: tier1.toNumber(), tier2Distance: tier2.toNumber(),
      deduction: roundMoney(tier1.times(rate.tier1).plus(tier2.times(rate.tier2))) };
    accumulated[year] = prior.plus(distance);
  }
  return results;
}
