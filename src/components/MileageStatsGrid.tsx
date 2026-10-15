import { sumMoney } from "../money";
import React from "react";
import { Car, Coins, Layers, HelpCircle, Wrench, Scale } from "lucide-react";
import { MileageStats, MileageEntry, VehicleExpense } from "../types";
import { formatCurrency } from "../utils";

interface MileageStatsGridProps {
  stats: MileageStats;
  entries: MileageEntry[];
  expenses: VehicleExpense[];
}

export default function MileageStatsGrid({ stats, entries, expenses }: MileageStatsGridProps) {
  const totalExpenses = sumMoney(expenses, item => item.amount);

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

        {/* Total Kilometre Estimate Value */}
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
              Planning estimate using configured annual rates.
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

        {/* Mileage Comparison Card */}
        <div 
          className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md flex items-start justify-between relative overflow-hidden group hover:border-emerald-500 transition-all duration-300"
          id="stat-card-combined-deduction"
        >
          <div className="space-y-2 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Expense Records
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight" id="combined-deduction-value">
                {expenses.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Receipts recorded for expense review
            </p>
          </div>
          <div className="p-2.5 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/50 relative z-10">
            <Scale className="w-4 h-4" />
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/10 rounded-full blur-2xl"></div>
        </div>

      </div>

      <p className="text-sm text-slate-500">Mileage tiers reset each calendar year using that year's configured rates. Vehicle receipts and kilometre estimates are alternative planning comparisons; adding them does not establish a deduction.</p>
    </div>
  );
}
