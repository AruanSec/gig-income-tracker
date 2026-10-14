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
    stats.totalEarnings += entry.totalEarnings;
    stats.totalNetFare += entry.netFare;
    stats.totalTips += entry.tips;
    stats.totalTaxes += entry.taxes;
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
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

export const CRA_TIER1_THRESHOLD = 5000;
export const CRA_TIER1_RATE = 0.72;
export const CRA_TIER2_RATE = 0.66;

export function getRatesForYear(year: string, customRates?: CraRate[]): { threshold: number; tier1: number; tier2: number } {
  if (customRates && customRates.length > 0) {
    const rate = customRates.find(r => r.year === year);
    if (rate) {
      return {
        threshold: rate.tier1_threshold,
        tier1: rate.tier1_rate,
        tier2: rate.tier2_rate
      };
    }
    // Fallback to closest year
    const sorted = [...customRates].sort((a, b) => b.year.localeCompare(a.year));
    const closest = sorted.find(r => r.year <= year) || sorted[sorted.length - 1];
    if (closest) {
      return {
        threshold: closest.tier1_threshold,
        tier1: closest.tier1_rate,
        tier2: closest.tier2_rate
      };
    }
  }
  // Standard CRA rates
  return {
    threshold: CRA_TIER1_THRESHOLD,
    tier1: CRA_TIER1_RATE,
    tier2: CRA_TIER2_RATE
  };
}

export function calculateMileageStats(entries: MileageEntry[], customRates?: CraRate[]): MileageStats {
  const stats: MileageStats = {
    totalKm: 0,
    tier1Km: 0,
    tier2Km: 0,
    totalDeduction: 0,
    tripCount: entries.length,
  };

  if (entries.length === 0) {
    return stats;
  }

  // Group entries by calendar year (CRA threshold resets each calendar year!)
  const entriesByYear: Record<string, MileageEntry[]> = {};
  entries.forEach((entry) => {
    const year = entry.date ? entry.date.substring(0, 4) : "2026";
    if (!entriesByYear[year]) {
      entriesByYear[year] = [];
    }
    entriesByYear[year].push(entry);
  });

  // Calculate per year
  Object.keys(entriesByYear).forEach((year) => {
    const yearEntries = entriesByYear[year];
    const { threshold, tier1, tier2 } = getRatesForYear(year, customRates);
    
    let yearTotalKm = 0;
    yearEntries.forEach((entry) => {
      yearTotalKm += entry.distance;
    });

    stats.totalKm += yearTotalKm;

    if (yearTotalKm <= threshold) {
      stats.tier1Km += yearTotalKm;
      stats.totalDeduction += yearTotalKm * tier1;
    } else {
      stats.tier1Km += threshold;
      const t2Km = yearTotalKm - threshold;
      stats.tier2Km += t2Km;
      stats.totalDeduction += (threshold * tier1) + (t2Km * tier2);
    }
  });

  return stats;
}

/**
 * Calculates individual trip deductions chronologically, resetting thresholds per calendar year.
 * Returns a map of entry ID to its detailed split and deduction value.
 */
export function calculateTripDeductions(
  entries: MileageEntry[],
  customRates?: CraRate[]
): Record<string, { tier1Distance: number; tier2Distance: number; deduction: number }> {
  // Sort entries by date (ascending) for chronological accumulation
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  
  const results: Record<string, { tier1Distance: number; tier2Distance: number; deduction: number }> = {};
  
  // Group sorted entries by year to track accumulated km per year separately
  const sortedByYear: Record<string, MileageEntry[]> = {};
  sortedEntries.forEach((entry) => {
    const year = entry.date ? entry.date.substring(0, 4) : "2026";
    if (!sortedByYear[year]) {
      sortedByYear[year] = [];
    }
    sortedByYear[year].push(entry);
  });

  // Calculate per year chronologically
  Object.keys(sortedByYear).forEach((year) => {
    const yearEntries = sortedByYear[year];
    const { threshold, tier1, tier2 } = getRatesForYear(year, customRates);
    
    let accumulatedKm = 0;
    yearEntries.forEach((entry) => {
      const d = entry.distance;
      let t1 = 0;
      let t2 = 0;

      if (accumulatedKm >= threshold) {
        t2 = d;
      } else if (accumulatedKm + d <= threshold) {
        t1 = d;
      } else {
        t1 = threshold - accumulatedKm;
        t2 = d - t1;
      }

      const deduction = (t1 * tier1) + (t2 * tier2);
      results[entry.id] = {
        tier1Distance: t1,
        tier2Distance: t2,
        deduction,
      };

      accumulatedKm += d;
    });
  });

  return results;
}

