import { IncomeEntry, MileageEntry, VehicleExpense } from "../types";

export const INITIAL_INCOME_ENTRIES: IncomeEntry[] = [
  {
    id: "mock-1",
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    trips: 14,
    onlineMinutes: 480, // 8 hours
    activeMinutes: 320, // 5.33 hours
    netFare: 185.50,
    tips: 42.00,
    taxes: 12.50,
    totalEarnings: 215.00,
    notes: "Friday shift - high surge pricing near downtown.",
  },
  {
    id: "mock-2",
    startDate: "2026-06-02",
    endDate: "2026-06-02",
    trips: 18,
    onlineMinutes: 540, // 9 hours
    activeMinutes: 390, // 6.5 hours
    netFare: 210.00,
    tips: 58.50,
    taxes: 15.00,
    totalEarnings: 253.50,
    notes: "Saturday dinner rush was active back-to-back.",
  },
  {
    id: "mock-3",
    startDate: "2026-06-03",
    endDate: "2026-06-03",
    trips: 8,
    onlineMinutes: 240, // 4 hours
    activeMinutes: 150, // 2.5 hours
    netFare: 92.00,
    tips: 20.00,
    taxes: 6.00,
    totalEarnings: 106.00,
    notes: "Sunday morning airport runs.",
  },
  {
    id: "mock-4",
    startDate: "2026-06-05",
    endDate: "2026-06-05",
    trips: 11,
    onlineMinutes: 420, // 7 hours
    activeMinutes: 240, // 4 hours
    netFare: 145.00,
    tips: 31.00,
    taxes: 10.00,
    totalEarnings: 166.00,
    notes: "Tuesday rainy shift. Tips were steady.",
  },
  {
    id: "mock-5",
    startDate: "2026-06-06",
    endDate: "2026-06-06",
    trips: 15,
    onlineMinutes: 480, // 8 hours
    activeMinutes: 310, // 5.17 hours
    netFare: 198.00,
    tips: 48.00,
    taxes: 13.50,
    totalEarnings: 232.50,
    notes: "Wednesday afternoon. Steady demand.",
  }
];

export const INITIAL_MILEAGE_ENTRIES: MileageEntry[] = [
  {
    id: "mileage-1",
    date: "2026-06-01",
    purpose: "Regional delivery routes across Greater Toronto Area",
    startOdometer: 124500,
    endOdometer: 126750,
    distance: 2250,
    tripType: "Delivery",
    notes: "Completed 45 parcel drop-offs during peak weekly logistics run.",
  },
  {
    id: "mileage-2",
    date: "2026-06-12",
    purpose: "Rideshare driving during rainy weekend peak periods",
    startOdometer: 126750,
    endOdometer: 129100,
    distance: 2350,
    tripType: "Ride-share",
    notes: "Intense weekend shifts - high demand and steady airport trips.",
  },
  {
    id: "mileage-3",
    date: "2026-06-25",
    purpose: "Inter-city courier runs and client parcel handovers",
    startOdometer: 129100,
    endOdometer: 129700,
    distance: 600,
    tripType: "Delivery",
    notes: "Traveled past the 5,000 km limit into the second-tier tax rate.",
  }
];

export const INITIAL_VEHICLE_EXPENSES: VehicleExpense[] = [
  {
    id: "exp-1",
    date: "2026-06-05",
    category: "Oil Change",
    amount: 89.50,
    description: "Synthetic oil change & filter replacement at certified garage.",
    gstHstEligible: true,
    gstHstAmount: 10.30,
  },
  {
    id: "exp-2",
    date: "2026-06-15",
    category: "Insurance",
    amount: 210.00,
    description: "Monthly commercial auto insurance premium for rideshare endorsement.",
    gstHstEligible: false,
    gstHstAmount: 0,
  },
  {
    id: "exp-3",
    date: "2026-06-20",
    category: "Repairs",
    amount: 345.00,
    description: "Front brake pads and rotor resurfacing.",
    gstHstEligible: true,
    gstHstAmount: 39.69,
  },
  {
    id: "exp-4",
    date: "2026-06-28",
    category: "Fuel",
    amount: 120.00,
    description: "Bulk fuel purchase receipt for delivery shifts.",
    gstHstEligible: true,
    gstHstAmount: 5.71,
  }
];


