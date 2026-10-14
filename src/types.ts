export interface IncomeEntry {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  trips: number;
  onlineMinutes: number;
  activeMinutes: number;
  netFare: number;
  tips: number;
  taxes: number;
  totalEarnings: number; // Auto-calculated: netFare + tips - taxes
  notes?: string;
}

export interface IncomeStats {
  totalEarnings: number;
  totalNetFare: number;
  totalTips: number;
  totalTaxes: number;
  totalTrips: number;
  totalOnlineMinutes: number;
  totalActiveMinutes: number;
  averageEarningsPerTrip: number;
  averageEarningsPerHourOnline: number;
  averageEarningsPerHourActive: number;
}

export interface MileageEntry {
  id: string;
  date: string; // YYYY-MM-DD
  purpose: string;
  startOdometer: number;
  endOdometer: number;
  distance: number; // endOdometer - startOdometer
  tripType: string; // e.g., "Ride-share", "Delivery", "Business Meeting", "Other"
  notes?: string;
}

export interface MileageStats {
  totalKm: number;
  tier1Km: number;
  tier2Km: number;
  totalDeduction: number;
  tripCount: number;
}

export type VehicleExpenseCategory =
  | "Fuel"
  | "Insurance"
  | "Maintenance"
  | "Repairs"
  | "Oil Change"
  | "Tires"
  | "Cleaning/Detailing"
  | "Parking/Tolls"
  | "License/Registration"
  | "Other"
  | string;

export interface VehicleExpense {
  id: string;
  date: string; // YYYY-MM-DD
  category: VehicleExpenseCategory;
  amount: number;
  description: string;
  gstHstEligible?: boolean;
  gstHstAmount?: number;
}

export interface CraRate {
  year: string;
  tier1_threshold: number;
  tier1_rate: number;
  tier2_rate: number;
}
