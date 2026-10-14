import React, { useState, useMemo } from "react";
import { TrendingUp, BarChart2, Calendar } from "lucide-react";
import { IncomeEntry } from "../types";
import { formatCurrency, formatDuration, formatDate } from "../utils";

interface IncomeChartProps {
  entries: IncomeEntry[];
}

type ChartMetric = "earnings" | "trips" | "efficiency";
type ChartMode = "trend" | "monthly";

interface MonthlyAggregate {
  monthKey: string;
  monthName: string;
  totalEarnings: number;
  trips: number;
  onlineMinutes: number;
  activeMinutes: number;
  entriesCount: number;
}

export default function IncomeChart({ entries }: IncomeChartProps) {
  const [activeMetric, setActiveMetric] = useState<ChartMetric>("earnings");
  const [chartMode, setChartMode] = useState<ChartMode>("trend");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sort entries chronologically for trends
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [entries]);

  // Compute monthly aggregates
  const monthlyData = useMemo<MonthlyAggregate[]>(() => {
    const monthlyGroups = sortedEntries.reduce<Record<string, MonthlyAggregate>>((acc, entry) => {
      const parts = entry.startDate.split("-");
      if (parts.length < 2) return acc;
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const monthName = `${months[monthIdx] || "Jan"} ${year}`;
      const monthKey = `${year}-${parts[1]}`;

      if (!acc[monthKey]) {
        acc[monthKey] = {
          monthKey,
          monthName,
          totalEarnings: 0,
          trips: 0,
          onlineMinutes: 0,
          activeMinutes: 0,
          entriesCount: 0,
        };
      }

      acc[monthKey].totalEarnings += entry.totalEarnings;
      acc[monthKey].trips += entry.trips;
      acc[monthKey].onlineMinutes += entry.onlineMinutes;
      acc[monthKey].activeMinutes += entry.activeMinutes;
      acc[monthKey].entriesCount += 1;

      return acc;
    }, {});

    return Object.keys(monthlyGroups)
      .map((key) => monthlyGroups[key])
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [sortedEntries]);

  if (sortedEntries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 mb-3">
          <BarChart2 className="w-6 h-6" />
        </div>
        <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-150 dark:text-white">No chart data available</h5>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Log some shifts to see your visual earning trends.</p>
      </div>
    );
  }

  // Get values based on active metric
  const getMetricValue = (entry: IncomeEntry) => {
    switch (activeMetric) {
      case "earnings":
        return entry.totalEarnings;
      case "trips":
        return entry.trips;
      case "efficiency":
        const hours = entry.onlineMinutes / 60;
        return hours > 0 ? parseFloat((entry.totalEarnings / hours).toFixed(2)) : 0;
      default:
        return entry.totalEarnings;
    }
  };

  const getMonthlyMetricValue = (item: typeof monthlyData[0]) => {
    switch (activeMetric) {
      case "earnings":
        return item.totalEarnings;
      case "trips":
        return item.trips;
      case "efficiency":
        const hours = item.onlineMinutes / 60;
        return hours > 0 ? parseFloat((item.totalEarnings / hours).toFixed(2)) : 0;
      default:
        return item.totalEarnings;
    }
  };

  const getMetricLabel = (value: number) => {
    switch (activeMetric) {
      case "earnings":
        return formatCurrency(value);
      case "trips":
        return `${value} trips`;
      case "efficiency":
        return `${formatCurrency(value)}/hr`;
    }
  };

  const maxChartValue = Math.max(
    ...(chartMode === "trend"
      ? sortedEntries.map(getMetricValue)
      : monthlyData.map(getMonthlyMetricValue)),
    10
  );

  const handleModeChange = (mode: ChartMode) => {
    setChartMode(mode);
    setHoveredIndex(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4" id="chart-card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            {chartMode === "trend" ? "Shift Performance Trends" : "Monthly Earnings Patterns"}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {chartMode === "trend"
              ? "Visualize your productivity metrics over chronological entries"
              : "Track seasonal patterns and monthly performance aggregates"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Chart Mode Selector (Trend vs. Monthly) */}
          <div className="flex bg-slate-150 dark:bg-slate-850 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => handleModeChange("trend")}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                chartMode === "trend"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Shifts
            </button>
            <button
              onClick={() => handleModeChange("monthly")}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                chartMode === "monthly"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Metric Selector Buttons */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => { setActiveMetric("earnings"); setHoveredIndex(null); }}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeMetric === "earnings"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Earnings
            </button>
            <button
              onClick={() => { setActiveMetric("trips"); setHoveredIndex(null); }}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeMetric === "trips"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Trips
            </button>
            <button
              onClick={() => { setActiveMetric("efficiency"); setHoveredIndex(null); }}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeMetric === "efficiency"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              Hourly Rate
            </button>
          </div>
        </div>
      </div>

      {/* SVG Responsive Bar Chart */}
      <div className="relative pt-6 h-[200px]" id="svg-chart-container">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400 dark:text-slate-500 font-mono pb-8">
          <div className="border-b border-slate-100 dark:border-slate-800/80 w-full pb-1 flex justify-between">
            <span>{getMetricLabel(maxChartValue)}</span>
          </div>
          <div className="border-b border-slate-100 dark:border-slate-800/80 w-full pb-1 flex justify-between">
            <span>{getMetricLabel(maxChartValue / 2)}</span>
          </div>
          <div className="border-b border-slate-100 dark:border-slate-800/80 w-full pb-1 flex justify-between">
            <span>0</span>
          </div>
        </div>

        {/* Chart Bars */}
        <div className="absolute inset-0 flex items-end justify-between gap-2 sm:gap-3 pb-8 pt-4">
          {chartMode === "trend" ? (
            sortedEntries.map((entry, index) => {
              const val = getMetricValue(entry);
              const heightPercent = maxChartValue > 0 ? (val / maxChartValue) * 100 : 0;

              return (
                <div
                  key={entry.id}
                  className="flex-1 flex flex-col items-center h-full group relative"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-t-lg h-full flex items-end overflow-hidden transition-all">
                    <div
                      style={{ height: `${Math.max(heightPercent, 3)}%` }}
                      className={`w-full transition-all duration-500 rounded-t-md ${
                        activeMetric === "earnings"
                          ? "bg-blue-600 group-hover:bg-blue-500"
                          : activeMetric === "trips"
                          ? "bg-slate-800 dark:bg-slate-600 group-hover:bg-slate-700 dark:group-hover:bg-slate-500"
                          : "bg-emerald-600 group-hover:bg-emerald-500"
                      }`}
                    ></div>
                  </div>

                  {/* Floating Tooltip */}
                  {hoveredIndex === index && (
                    <div className="absolute z-30 bottom-full mb-3 bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl p-2.5 shadow-xl text-[11px] font-sans font-medium min-w-[155px] pointer-events-none flex flex-col gap-1 border border-slate-800 backdrop-blur-xs text-left animate-in fade-in slide-in-from-bottom-1 duration-150">
                      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="font-bold text-slate-100 whitespace-nowrap">
                          {formatDate(entry.startDate)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 text-[10px]">Earnings:</span>
                        <span className="font-extrabold font-mono text-blue-400">{formatCurrency(entry.totalEarnings)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 text-[10px]">Trips:</span>
                        <span className="font-bold font-mono text-slate-200">{entry.trips}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 text-[10px]">Hourly Rate:</span>
                        <span className="font-bold font-mono text-emerald-400">
                          {entry.onlineMinutes > 0 ? `${formatCurrency(entry.totalEarnings / (entry.onlineMinutes / 60))}/hr` : "$0.00/hr"}
                        </span>
                      </div>
                      {/* Triangle Pointer */}
                      <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900/95 dark:bg-slate-950/95 border-r border-b border-slate-800 rotate-45"></div>
                    </div>
                  )}

                  {/* X-Axis Date Indicator */}
                  <span className="absolute bottom-[-24px] text-[10px] text-slate-400 font-mono rotate-12 origin-top-left whitespace-nowrap">
                    {entry.startDate.substring(5)} {/* MM-DD */}
                  </span>
                </div>
              );
            })
          ) : (
            monthlyData.map((item, index) => {
              const val = getMonthlyMetricValue(item);
              const heightPercent = maxChartValue > 0 ? (val / maxChartValue) * 100 : 0;
              const nameParts = item.monthName.split(" ");
              const displayMonth = nameParts[0] ? `${nameParts[0]} '${(nameParts[1] || "").substring(2)}` : item.monthName;

              return (
                <div
                  key={item.monthKey}
                  className="flex-1 flex flex-col items-center h-full group relative"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-t-lg h-full flex items-end overflow-hidden transition-all">
                    <div
                      style={{ height: `${Math.max(heightPercent, 3)}%` }}
                      className={`w-full transition-all duration-500 rounded-t-md ${
                        activeMetric === "earnings"
                          ? "bg-blue-600 group-hover:bg-blue-500"
                          : activeMetric === "trips"
                          ? "bg-slate-800 dark:bg-slate-600 group-hover:bg-slate-700 dark:group-hover:bg-slate-500"
                          : "bg-emerald-600 group-hover:bg-emerald-500"
                      }`}
                    ></div>
                  </div>

                  {/* Floating Tooltip */}
                  {hoveredIndex === index && (
                    <div className="absolute z-30 bottom-full mb-3 bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl p-2.5 shadow-xl text-[11px] font-sans font-medium min-w-[155px] pointer-events-none flex flex-col gap-1 border border-slate-800 backdrop-blur-xs text-left animate-in fade-in slide-in-from-bottom-1 duration-150">
                      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="font-bold text-slate-100 whitespace-nowrap">
                          {item.monthName}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 text-[10px]">Total:</span>
                        <span className="font-extrabold font-mono text-blue-400">{formatCurrency(item.totalEarnings)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 text-[10px]">Trips:</span>
                        <span className="font-bold font-mono text-slate-200">{item.trips}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400 text-[10px]">Avg Hourly:</span>
                        <span className="font-bold font-mono text-emerald-400">
                          {item.onlineMinutes > 0 ? `${formatCurrency(item.totalEarnings / (item.onlineMinutes / 60))}/hr` : "$0.00/hr"}
                        </span>
                      </div>
                      {/* Triangle Pointer */}
                      <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900/95 dark:bg-slate-950/95 border-r border-b border-slate-800 rotate-45"></div>
                    </div>
                  )}

                  {/* X-Axis Month Indicator */}
                  <span className="absolute bottom-[-24px] text-[10px] text-slate-400 font-mono rotate-12 origin-top-left whitespace-nowrap">
                    {displayMonth}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tooltip detail area for hover states */}
      <div className="bg-slate-50/50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between min-h-[50px]">
        {hoveredIndex !== null ? (
          chartMode === "trend" ? (
            sortedEntries[hoveredIndex] ? (
              <>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(sortedEntries[hoveredIndex].startDate)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {sortedEntries[hoveredIndex].notes || "No notes logged for this shift."}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono space-y-0.5 shrink-0">
                  <p className="text-slate-900 dark:text-white font-bold">
                    Earnings: {formatCurrency(sortedEntries[hoveredIndex].totalEarnings)}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {sortedEntries[hoveredIndex].trips} trips • {formatDuration(sortedEntries[hoveredIndex].onlineMinutes)} online
                  </p>
                </div>
              </>
            ) : null
          ) : (
            monthlyData[hoveredIndex] ? (
              <>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {monthlyData[hoveredIndex].monthName} Summary
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Aggregate of {monthlyData[hoveredIndex].entriesCount} shift logs in this month
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono space-y-0.5 shrink-0">
                  <p className="text-slate-900 dark:text-white font-bold">
                    Total: {formatCurrency(monthlyData[hoveredIndex].totalEarnings)}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {monthlyData[hoveredIndex].trips} trips • {formatDuration(monthlyData[hoveredIndex].onlineMinutes)} online • {monthlyData[hoveredIndex].onlineMinutes > 0 ? `${formatCurrency(monthlyData[hoveredIndex].totalEarnings / (monthlyData[hoveredIndex].onlineMinutes / 60))}/hr` : "$0.00/hr"} avg
                  </p>
                </div>
              </>
            ) : null
          )
        ) : (
          <p className="text-slate-450 dark:text-slate-500 text-center w-full italic">
            {chartMode === "trend"
              ? "Hover over any bar in the trend chart to inspect detailed shift metrics."
              : "Hover over any monthly bar to inspect aggregated seasonal earnings and metrics."}
          </p>
        )}
      </div>
    </div>
  );
}

