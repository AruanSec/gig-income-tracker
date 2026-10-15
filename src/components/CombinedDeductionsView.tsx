import { addMoney, sumMoney } from "../money";
import React, { useMemo } from "react";
import { Coins, FileSpreadsheet, Percent, Landmark, HelpCircle, ArrowUpRight, Scale } from "lucide-react";
import { MileageEntry, VehicleExpense, CraRate } from "../types";
import { formatCurrency, calculateTripDeductions } from "../utils";

interface CombinedDeductionsViewProps {
  mileageEntries: MileageEntry[];
  expenses: VehicleExpense[];
  craRates?: CraRate[];
}

export default function CombinedDeductionsView({ mileageEntries, expenses, craRates }: CombinedDeductionsViewProps) {
  
  // Chronological mileage deductions mapping
  const mileageDeductionsMap = useMemo(() => {
    return calculateTripDeductions(mileageEntries, craRates);
  }, [mileageEntries, craRates]);

  // Aggregate stats per month
  const monthlyData = useMemo(() => {
    const data: Record<string, {
      monthKey: string;
      monthName: string;
      distance: number;
      mileageDeduction: number;
      expenseTotal: number;
    }> = {};

    // Group Mileage
    mileageEntries.forEach((trip) => {
      if (!trip.date) return;
      const [year, month] = trip.date.split("-");
      const periodKey = `${year}-${month}`;
      const dateObj = new Date(Number(year), Number(month) - 1, 15);
      const monthName = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const tripCalc = mileageDeductionsMap[trip.id] || { deduction: 0 };

      if (!data[periodKey]) {
        data[periodKey] = {
          monthKey: periodKey,
          monthName,
          distance: 0,
          mileageDeduction: 0,
          expenseTotal: 0,
        };
      }
      data[periodKey].distance += trip.distance;
      data[periodKey].mileageDeduction = addMoney(data[periodKey].mileageDeduction, tripCalc.deduction);
    });

    // Group Expenses
    expenses.forEach((exp) => {
      if (!exp.date) return;
      const [year, month] = exp.date.split("-");
      const periodKey = `${year}-${month}`;
      const dateObj = new Date(Number(year), Number(month) - 1, 15);
      const monthName = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      if (!data[periodKey]) {
        data[periodKey] = {
          monthKey: periodKey,
          monthName,
          distance: 0,
          mileageDeduction: 0,
          expenseTotal: 0,
        };
      }
      data[periodKey].expenseTotal = addMoney(data[periodKey].expenseTotal, exp.amount);
    });

    // Sort periods descending (newest first)
    return Object.keys(data)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => data[key]);
  }, [mileageEntries, expenses, mileageDeductionsMap]);

  // Aggregate Grand Totals
  const totals = useMemo(() => {
    let mileageDeduction = 0;
    let distance = 0;
    mileageEntries.forEach((trip) => {
      distance += trip.distance;
      const tripCalc = mileageDeductionsMap[trip.id] || { deduction: 0 };
      mileageDeduction = addMoney(mileageDeduction, tripCalc.deduction);
    });

    const expenseTotal = sumMoney(expenses, item => item.amount);

    return {
      distance,
      mileageDeduction,
      expenseTotal,
    };
  }, [mileageEntries, expenses, mileageDeductionsMap]);

  // Percentage shares
  const mileagePercent = (totals.mileageDeduction + totals.expenseTotal) > 0 ? (totals.mileageDeduction / (totals.mileageDeduction + totals.expenseTotal)) * 100 : 0;
  const expensePercent = (totals.mileageDeduction + totals.expenseTotal) > 0 ? (totals.expenseTotal / (totals.mileageDeduction + totals.expenseTotal)) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in" id="combined-deductions-container">
      
      {/* 1. Combined Totals Summary Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden" id="combined-totals-banner">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-950 px-2.5 py-1 rounded-full border border-blue-900/50">
              Vehicle Planning Comparison
            </span>
            <h3 className="text-xl font-bold tracking-tight">Kilometre Planning Estimate</h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Compare kilometre estimates with recorded operating costs. These are alternatives; do not add them as a filing deduction. Actual costs require business-use and GST/HST review.
            </p>
          </div>
          <div className="text-left md:text-right shrink-0">
            <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight block">
              {formatCurrency(totals.mileageDeduction)}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-1">
              Before eligibility review
            </span>
          </div>
        </div>

        {/* Breakdown bar graph */}
        {totals.mileageDeduction > 0 && (
          <div className="relative mt-6 pt-5 border-t border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold flex items-center gap-1.5 text-blue-300">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                Mileage Comparison: {formatCurrency(totals.mileageDeduction)} ({mileagePercent.toFixed(0)}%)
              </span>
              <span className="font-bold flex items-center gap-1.5 text-purple-300">
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
                Expense Comparison: {formatCurrency(totals.expenseTotal)} ({expensePercent.toFixed(0)}%)
              </span>
            </div>
            
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
              <div 
                className="bg-blue-500 h-full transition-all duration-500" 
                style={{ width: `${mileagePercent}%` }} 
                title={`Mileage Estimate: ${mileagePercent.toFixed(1)}%`}
              />
              <div 
                className="bg-purple-500 h-full transition-all duration-500" 
                style={{ width: `${expensePercent}%` }} 
                title={`Vehicle Operating Expenses: ${expensePercent.toFixed(1)}%`}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Visual Comparison Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Mileage Method Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Method A</span>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                Per-Kilometre Planning Estimate
              </h4>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Total Distance</span>
              <span className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-mono block mt-0.5">
                {totals.distance.toLocaleString()} km
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Planning Estimate</span>
              <span className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono block mt-0.5">
                {formatCurrency(totals.mileageDeduction)}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
            Calculated from your configured year-specific rates. CRA employee allowance rates do not automatically establish an eligible deduction for self-employed vehicle expenses.
          </p>
        </div>

        {/* Maintenance Method Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Method B</span>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                Actual Operating Expenses
              </h4>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Coins className="w-4 h-4" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Expense Items</span>
              <span className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-mono block mt-0.5">
                {expenses.length} logs
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Direct Out-of-Pocket</span>
              <span className="text-base font-extrabold text-purple-600 dark:text-purple-400 font-mono block mt-0.5">
                {formatCurrency(totals.expenseTotal)}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
            Sum of all direct operational costs (repairs, fuel, insurance, tires). Under actual expenses method, you write off a percentage of these equal to your business km ratio.
          </p>
        </div>

      </div>

      {/* 3. Combined Monthly Period Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm" id="combined-periods-table-card">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/50">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Vehicle Planning Per Month</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Periodical comparison of mileage deductions vs operating costs</p>
        </div>

        {monthlyData.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-550 rounded-full">
              <Scale className="w-6 h-6" />
            </div>
            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">No periodical logs recorded</h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-normal">
              Log your business trips or car maintenance expenses to view month-by-month vehicle planning comparisons.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/10 dark:bg-slate-900/20">
                  <th className="px-6 py-3">Month</th>
                  <th className="px-6 py-3 text-right">Business distance</th>
                  <th className="px-6 py-3 text-right">Kilometre Estimate</th>
                  <th className="px-6 py-3 text-right">Recorded Costs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {monthlyData.map((data) => (
                  <tr key={data.monthKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{data.monthName}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{data.distance.toLocaleString()} km</td>
                    <td className="px-6 py-4 text-right font-mono text-blue-600 dark:text-blue-400 font-semibold">{formatCurrency(data.mileageDeduction)}</td>
                    <td className="px-6 py-4 text-right font-mono text-purple-600 dark:text-purple-400 font-semibold">{formatCurrency(data.expenseTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. CRA Education Section */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4" id="cra-education-panel">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" /> 
          CRA Filing Guide & Educational Insights
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Kilometre Planning Comparison
            </h5>
            <p>
              Keep a mileage log and receipts to support business use. This comparison applies configured annual rates for planning; it does not determine an allowable self-employed deduction under Form T2125.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              The Actual Expenses Method
            </h5>
            <p>
              Actual costs require business-use allocation and review of eligible categories, limits and recoverable GST/HST. Some costs have separate rules; the tracker does not calculate capital cost allowance or certify filing amounts.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
