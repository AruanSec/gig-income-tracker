import { addMoney } from "../money";
import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend
} from "recharts";
import { Calendar, TrendingUp, Award, DollarSign, BarChart3, Layers } from "lucide-react";
import { IncomeEntry } from "../types";
import { formatCurrency } from "../utils";

interface MonthlyIncomeBarChartProps {
  entries: IncomeEntry[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function MonthlyIncomeBarChart({ entries }: MonthlyIncomeBarChartProps) {
  // Extract all available years from entries, fallback to current calendar year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    entries.forEach((e) => {
      const year = parseInt(e.startDate.split("-")[0], 10);
      if (!isNaN(year)) {
        yearsSet.add(year);
      }
    });
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [entries]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears[0] || new Date().getFullYear();
  });

  const [viewMode, setViewMode] = useState<"total" | "breakdown">("total");
  const [activeMonthIndex, setActiveMonthIndex] = useState<number | null>(null);

  // Compute 12-month aggregated dataset for selected year
  const monthlyData = useMemo(() => {
    const months = MONTH_NAMES.map((monthName, index) => ({
      monthIndex: index,
      month: monthName,
      fullMonth: FULL_MONTH_NAMES[index],
      totalEarnings: 0,
      netFare: 0,
      tips: 0,
      taxes: 0,
      trips: 0,
      onlineMinutes: 0,
      shiftsCount: 0,
      avgHourly: 0,
    }));

    entries.forEach((entry) => {
      const parts = entry.startDate.split("-");
      if (parts.length < 2) return;
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;

      if (yr === selectedYear && mo >= 0 && mo < 12) {
        months[mo].totalEarnings = addMoney(months[mo].totalEarnings, entry.totalEarnings);
        months[mo].netFare = addMoney(months[mo].netFare, entry.netFare);
        months[mo].tips = addMoney(months[mo].tips, entry.tips);
        months[mo].taxes = addMoney(months[mo].taxes, entry.taxes);
        months[mo].trips += entry.trips;
        months[mo].onlineMinutes += entry.onlineMinutes;
        months[mo].shiftsCount += 1;
      }
    });

    // Compute hourly rates
    return months.map((m) => {
      const hours = m.onlineMinutes / 60;
      return {
        ...m,
        avgHourly: hours > 0 ? parseFloat((m.totalEarnings / hours).toFixed(2)) : 0,
      };
    });
  }, [entries, selectedYear]);

  // Annual Summary Metrics
  const yearSummary = useMemo(() => {
    const totalYearEarnings = monthlyData.reduce((acc, m) => addMoney(acc, m.totalEarnings), 0);
    const totalNetFare = monthlyData.reduce((acc, m) => addMoney(acc, m.netFare), 0);
    const totalTips = monthlyData.reduce((acc, m) => addMoney(acc, m.tips), 0);
    const totalTrips = monthlyData.reduce((acc, m) => acc + m.trips, 0);
    const totalShifts = monthlyData.reduce((acc, m) => acc + m.shiftsCount, 0);
    
    const activeMonths = monthlyData.filter((m) => m.totalEarnings > 0);
    const activeMonthsCount = activeMonths.length || 1;
    const monthlyAverage = totalYearEarnings / 12;
    const activeMonthlyAverage = totalYearEarnings / activeMonthsCount;

    let peakMonth = monthlyData[0];
    monthlyData.forEach((m) => {
      if (m.totalEarnings > peakMonth.totalEarnings) {
        peakMonth = m;
      }
    });

    return {
      totalYearEarnings,
      totalNetFare,
      totalTips,
      totalTrips,
      totalShifts,
      activeMonthsCount,
      monthlyAverage,
      activeMonthlyAverage,
      peakMonth: peakMonth.totalEarnings > 0 ? peakMonth : null,
    };
  }, [monthlyData]);

  // Custom Recharts Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl p-3 shadow-2xl text-xs font-sans border border-slate-800 backdrop-blur-xs min-w-[190px] space-y-2 text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-extrabold text-slate-100 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {data.fullMonth} {selectedYear}
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              {data.shiftsCount} shift{data.shiftsCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Income:</span>
              <span className="font-black text-blue-400 text-xs">{formatCurrency(data.totalEarnings)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Net Fares:</span>
              <span>{formatCurrency(data.netFare)}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-400">
              <span className="text-slate-400">Client Tips:</span>
              <span>{formatCurrency(data.tips)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-slate-300">
              <span className="text-slate-400">Trips Completed:</span>
              <span className="font-bold">{data.trips}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Avg Hourly:</span>
              <span className="font-bold text-amber-400">{formatCurrency(data.avgHourly)}/hr</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6" id="monthly-income-bar-chart-card">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Monthly Income Bar Chart
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 font-mono">
                  {selectedYear}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aggregated monthly earnings breakdown & seasonal income trends
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 pl-2">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              id="monthly-chart-year-select"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="dark:bg-slate-900 dark:text-white">
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("total")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                viewMode === "total"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              id="view-mode-total-btn"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Total Bar</span>
            </button>
            <button
              onClick={() => setViewMode("breakdown")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                viewMode === "breakdown"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              id="view-mode-breakdown-btn"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fares vs Tips</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 text-left">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            Total {selectedYear} Income
          </p>
          <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
            {formatCurrency(yearSummary.totalYearEarnings)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Across {yearSummary.totalShifts} logged shifts
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 text-left">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            Monthly Average
          </p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
            {formatCurrency(yearSummary.monthlyAverage)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Active mo avg: {formatCurrency(yearSummary.activeMonthlyAverage)}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 text-left">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3 text-amber-500" /> Peak Month
          </p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
            {yearSummary.peakMonth ? formatCurrency(yearSummary.peakMonth.totalEarnings) : "$0.00"}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {yearSummary.peakMonth ? `${yearSummary.peakMonth.fullMonth} (${yearSummary.peakMonth.trips} trips)` : "No data logged"}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 text-left">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            Tips & Fares Mix
          </p>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-450 font-mono mt-0.5">
            {formatCurrency(yearSummary.totalTips)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Tips represent {yearSummary.totalYearEarnings > 0 ? Math.round((yearSummary.totalTips / yearSummary.totalYearEarnings) * 100) : 0}% of revenue
          </p>
        </div>
      </div>

      {/* Main Recharts Bar Chart Container */}
      <div className="pt-2">
        <div className="h-72 w-full" id="monthly-recharts-bar-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyData}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              onMouseMove={(state: any) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setActiveMonthIndex(state.activeTooltipIndex);
                }
              }}
              onMouseLeave={() => setActiveMonthIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }}
              />
              
              {/* Average reference line */}
              {yearSummary.monthlyAverage > 0 && (
                <ReferenceLine
                  y={yearSummary.monthlyAverage}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Monthly Avg (${formatCurrency(yearSummary.monthlyAverage)})`,
                    fill: "#d97706",
                    fontSize: 10,
                    fontWeight: "bold",
                    position: "insideTopRight",
                  }}
                />
              )}

              {viewMode === "total" ? (
                <Bar dataKey="totalEarnings" name="Total Earnings" radius={[6, 6, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        yearSummary.peakMonth && yearSummary.peakMonth.monthIndex === index
                          ? "#d97706" // Amber for peak month
                          : activeMonthIndex === index
                          ? "#2563eb" // Bright blue when hovered
                          : entry.totalEarnings > 0
                          ? "#3b82f6" // Standard blue
                          : "transparent"
                      }
                      className="transition-colors duration-200 cursor-pointer"
                    />
                  ))}
                </Bar>
              ) : (
                <>
                  <Bar dataKey="netFare" name="Net Fare" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="tips" name="Tips" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Breakdown Grid Details */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            Monthly Performance Table ({selectedYear})
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            {yearSummary.activeMonthsCount} active months
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2.5">Month</th>
                <th className="px-3 py-2.5 text-right">Total Income</th>
                <th className="px-3 py-2.5 text-right">Fares</th>
                <th className="px-3 py-2.5 text-right">Tips</th>
                <th className="px-3 py-2.5 text-center">Shifts</th>
                <th className="px-3 py-2.5 text-right">Avg Hourly</th>
                <th className="px-3 py-2.5 text-right">% of Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {monthlyData.map((m) => {
                const pct = yearSummary.totalYearEarnings > 0
                  ? Math.round((m.totalEarnings / yearSummary.totalYearEarnings) * 100)
                  : 0;
                const isPeak = yearSummary.peakMonth?.monthIndex === m.monthIndex;

                return (
                  <tr
                    key={m.month}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                      isPeak ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-sans font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>{m.fullMonth}</span>
                      {isPeak && (
                        <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.2 rounded">
                          Peak
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(m.totalEarnings)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(m.netFare)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCurrency(m.tips)}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">
                      {m.shiftsCount}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                      {m.avgHourly > 0 ? `${formatCurrency(m.avgHourly)}/hr` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-500 dark:text-slate-400">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
