import React from "react";
import { Car, Coins, Layers, HelpCircle, Wrench, Scale } from "lucide-react";
import { MileageStats, MileageEntry, VehicleExpense } from "../types";
import { formatCurrency, CRA_TIER1_THRESHOLD, CRA_TIER1_RATE, CRA_TIER2_RATE } from "../utils";

interface MileageStatsGridProps {
  stats: MileageStats;
  entries: MileageEntry[];
  expenses: VehicleExpense[];
}

export default function MileageStatsGrid({ stats, entries, expenses }: MileageStatsGridProps) {
  // Calculate percentage of threshold reached
  const thresholdProgress = Math.min((stats.totalKm / CRA_TIER1_THRESHOLD) * 100, 100);
  const isOverThreshold = stats.totalKm > CRA_TIER1_THRESHOLD;

  // Calculate actual expenses total
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  // Combined deduction total
  const combinedDeduction = stats.totalDeduction + totalExpenses;

  return (
    <div className="space-y-6" id="mileage-stats-container">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Kilometres Driven */}
        <div 
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-850 transition-all duration-300"
          id="stat-card-total-km"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Business Mileage
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight animate-fade-in" id="total-km-value">
                {stats.totalKm.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">km</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-normal">
              Total cumulative business travel logged.
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Car className="w-4 h-4" />
          </div>
        </div>

        {/* Total CRA Mileage Deduction Value */}
        <div 
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-850 transition-all duration-300"
          id="stat-card-total-deduction"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mileage Deduction
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight" id="total-deduction-value">
                {formatCurrency(stats.totalDeduction)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              Tax write-off based on tiered rates.
            </p>
          </div>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        {/* Total Maintenance Expenses Card */}
        <div 
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-850 transition-all duration-300"
          id="stat-card-total-expenses"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Operating Expenses
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono tracking-tight" id="total-expenses-value">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              Car maintenance, fuel & insurance logs.
            </p>
          </div>
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
            <Wrench className="w-4 h-4" />
          </div>
        </div>

        {/* Combined Deductions Card */}
        <div 
          className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md flex items-start justify-between relative overflow-hidden group hover:border-emerald-500 transition-all duration-300"
          id="stat-card-combined-deduction"
        >
          <div className="space-y-2 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Combined Deductions
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight" id="combined-deduction-value">
                {formatCurrency(combinedDeduction)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Total write-offs (Mileage + Expenses)
            </p>
          </div>
          <div className="p-2.5 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/50 relative z-10">
            <Scale className="w-4 h-4" />
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/10 rounded-full blur-2xl"></div>
        </div>

      </div>

      {/* Cumulative Kilometer Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm" id="threshold-progress-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              CRA Two-Tier Mileage Limit Progress
              <span className="inline-flex items-center text-slate-400 dark:text-slate-550 cursor-help" title="CRA allows 72¢/km for the first 5,000 business km, and drops to 66¢/km thereafter.">
                <HelpCircle className="w-4 h-4" />
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">
              Currently driving in <span className="font-semibold text-slate-700 dark:text-slate-300">{isOverThreshold ? "Tier 2 (66¢/km rate)" : "Tier 1 (72¢/km rate)"}</span>
            </p>
          </div>
          <div className="text-right sm:text-right shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
              Threshold: {CRA_TIER1_THRESHOLD.toLocaleString()} km
            </span>
          </div>
        </div>

        {/* Custom Range Indicator Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex" id="threshold-progress-bar-bg">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${thresholdProgress}%` }}
              id="threshold-progress-bar-fill"
            />
            {isOverThreshold && (
              <div 
                className="bg-emerald-500 dark:bg-emerald-600 h-full flex-1 transition-all duration-500 animate-pulse"
                id="threshold-progress-bar-fill-overflow"
              />
            )}
          </div>
          
          <div className="flex justify-between items-center text-[11px] text-slate-400 dark:text-slate-500">
            <span className="font-medium">0 km (Start)</span>
            {isOverThreshold ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +{ (stats.totalKm - CRA_TIER1_THRESHOLD).toLocaleString() } km beyond threshold
              </span>
            ) : (
              <span className="font-medium">
                { (CRA_TIER1_THRESHOLD - stats.totalKm).toLocaleString() } km remaining in Tier 1
              </span>
            )}
            <span className="font-medium">{CRA_TIER1_THRESHOLD.toLocaleString()} km (Limit)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
