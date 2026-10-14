import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Briefcase,
  Sparkles,
  Minus,
  BarChart2
} from "lucide-react";
import { IncomeEntry } from "../types";
import { formatCurrency, formatDuration } from "../utils";

interface WeeklyComparisonChartProps {
  entries: IncomeEntry[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Parse "YYYY-MM-DD" safely as local date
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map((s) => parseInt(s, 10));
  if (parts.length < 3 || isNaN(parts[0])) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// Format Date as "YYYY-MM-DD"
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Format Date as short "MMM d" (e.g. "Jul 27")
function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Get start of week (Monday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export default function WeeklyComparisonChart({ entries }: WeeklyComparisonChartProps) {
  // Find the anchor date (latest entry date or today)
  const defaultAnchorDate = useMemo(() => {
    if (!entries || entries.length === 0) return new Date();
    let maxDate = parseLocalDate(entries[0].startDate);
    entries.forEach((e) => {
      const d = parseLocalDate(e.startDate);
      if (d > maxDate) maxDate = d;
    });
    return maxDate;
  }, [entries]);

  // weekOffset: 0 means selected anchor week, -1 means 1 week earlier, etc.
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [metricMode, setMetricMode] = useState<"earnings" | "hours" | "trips" | "tips">("earnings");

  // Calculate Start of Current Selected Week (Monday)
  const currentWeekStart = useMemo(() => {
    const baseStart = getStartOfWeek(defaultAnchorDate);
    baseStart.setDate(baseStart.getDate() + weekOffset * 7);
    return baseStart;
  }, [defaultAnchorDate, weekOffset]);

  // Calculate Start of Previous Week (Monday - 7 days)
  const previousWeekStart = useMemo(() => {
    const prevStart = new Date(currentWeekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    return prevStart;
  }, [currentWeekStart]);

  // Build Day-by-Day comparison dataset for Mon-Sun
  const comparisonData = useMemo(() => {
    return DAY_NAMES.map((dayName, dayIndex) => {
      // Date object for Current Week day
      const curDayDate = new Date(currentWeekStart);
      curDayDate.setDate(curDayDate.getDate() + dayIndex);
      const curDateStr = formatLocalDate(curDayDate);

      // Date object for Previous Week day
      const prevDayDate = new Date(previousWeekStart);
      prevDayDate.setDate(prevDayDate.getDate() + dayIndex);
      const prevDateStr = formatLocalDate(prevDayDate);

      // Aggregates for Current Week day
      let curEarnings = 0;
      let curFare = 0;
      let curTips = 0;
      let curTrips = 0;
      let curOnlineMin = 0;

      // Aggregates for Previous Week day
      let prevEarnings = 0;
      let prevFare = 0;
      let prevTips = 0;
      let prevTrips = 0;
      let prevOnlineMin = 0;

      entries.forEach((e) => {
        // Current week match
        if (e.startDate === curDateStr || (e.startDate <= curDateStr && e.endDate >= curDateStr)) {
          curEarnings += e.totalEarnings;
          curFare += e.netFare;
          curTips += e.tips;
          curTrips += e.trips;
          curOnlineMin += e.onlineMinutes;
        }
        // Previous week match
        if (e.startDate === prevDateStr || (e.startDate <= prevDateStr && e.endDate >= prevDateStr)) {
          prevEarnings += e.totalEarnings;
          prevFare += e.netFare;
          prevTips += e.tips;
          prevTrips += e.trips;
          prevOnlineMin += e.onlineMinutes;
        }
      });

      const curHours = curOnlineMin / 60;
      const prevHours = prevOnlineMin / 60;

      return {
        dayIndex,
        dayName,
        fullDayName: FULL_DAY_NAMES[dayIndex],
        curDateStr,
        prevDateStr,
        curDateLabel: formatShortDate(curDayDate),
        prevDateLabel: formatShortDate(prevDayDate),
        // Metrics for Chart
        currentWeek: Math.round(curEarnings * 100) / 100,
        previousWeek: Math.round(prevEarnings * 100) / 100,
        currentHours: Math.round(curHours * 10) / 10,
        previousHours: Math.round(prevHours * 10) / 10,
        currentTrips: curTrips,
        previousTrips: prevTrips,
        currentTips: Math.round(curTips * 100) / 100,
        previousTips: Math.round(prevTips * 100) / 100,
        // Raw details
        curFare,
        prevFare,
        curTips,
        prevTips,
      };
    });
  }, [entries, currentWeekStart, previousWeekStart]);

  // Overall Weekly Metrics & Growth Calculations
  const weeklyTotals = useMemo(() => {
    const curTotalEarnings = comparisonData.reduce((acc, d) => acc + d.currentWeek, 0);
    const prevTotalEarnings = comparisonData.reduce((acc, d) => acc + d.previousWeek, 0);

    const curTotalHours = comparisonData.reduce((acc, d) => acc + d.currentHours, 0);
    const prevTotalHours = comparisonData.reduce((acc, d) => acc + d.previousHours, 0);

    const curTotalTrips = comparisonData.reduce((acc, d) => acc + d.currentTrips, 0);
    const prevTotalTrips = comparisonData.reduce((acc, d) => acc + d.previousTrips, 0);

    const curTotalTips = comparisonData.reduce((acc, d) => acc + d.currentTips, 0);
    const prevTotalTips = comparisonData.reduce((acc, d) => acc + d.previousTips, 0);

    // Earnings Growth Percentage
    const earningsDiff = curTotalEarnings - prevTotalEarnings;
    const earningsGrowthPct = prevTotalEarnings > 0
      ? (earningsDiff / prevTotalEarnings) * 100
      : (curTotalEarnings > 0 ? 100 : 0);

    // Hourly Rate Comparison
    const curHourlyRate = curTotalHours > 0 ? curTotalEarnings / curTotalHours : 0;
    const prevHourlyRate = prevTotalHours > 0 ? prevTotalEarnings / prevTotalHours : 0;
    const hourlyDiff = curHourlyRate - prevHourlyRate;
    const hourlyGrowthPct = prevHourlyRate > 0
      ? (hourlyDiff / prevHourlyRate) * 100
      : (curHourlyRate > 0 ? 100 : 0);

    // Trips Growth
    const tripsDiff = curTotalTrips - prevTotalTrips;
    const tripsGrowthPct = prevTotalTrips > 0
      ? (tripsDiff / prevTotalTrips) * 100
      : (curTotalTrips > 0 ? 100 : 0);

    return {
      curTotalEarnings,
      prevTotalEarnings,
      earningsDiff,
      earningsGrowthPct,
      curTotalHours,
      prevTotalHours,
      curTotalTrips,
      prevTotalTrips,
      curTotalTips,
      prevTotalTips,
      curHourlyRate,
      prevHourlyRate,
      hourlyDiff,
      hourlyGrowthPct,
      tripsDiff,
      tripsGrowthPct,
    };
  }, [comparisonData]);

  // Format date ranges for display
  const curWeekEnd = new Date(currentWeekStart);
  curWeekEnd.setDate(curWeekEnd.getDate() + 6);

  const prevWeekEnd = new Date(previousWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);

  const curWeekLabel = `${formatShortDate(currentWeekStart)} - ${formatShortDate(curWeekEnd)}`;
  const prevWeekLabel = `${formatShortDate(previousWeekStart)} - ${formatShortDate(prevWeekEnd)}`;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const curVal = metricMode === "earnings" ? data.currentWeek : metricMode === "hours" ? data.currentHours : metricMode === "trips" ? data.currentTrips : data.currentTips;
      const prevVal = metricMode === "earnings" ? data.previousWeek : metricMode === "hours" ? data.previousHours : metricMode === "trips" ? data.previousTrips : data.previousTips;
      const diff = curVal - prevVal;
      const pct = prevVal > 0 ? (diff / prevVal) * 100 : (curVal > 0 ? 100 : 0);

      const unit = metricMode === "earnings" || metricMode === "tips" ? "$" : metricMode === "hours" ? " hrs" : " trips";

      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl p-3 shadow-2xl text-xs font-sans border border-slate-800 backdrop-blur-xs min-w-[210px] space-y-2 text-left">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="font-extrabold text-slate-100 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {data.fullDayName}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {data.curDateLabel} vs {data.prevDateLabel}
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-blue-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                This Week:
              </span>
              <span className="font-extrabold text-white">
                {metricMode === "earnings" || metricMode === "tips" ? formatCurrency(curVal) : `${curVal}${unit}`}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                Previous Week:
              </span>
              <span className="font-semibold text-slate-300">
                {metricMode === "earnings" || metricMode === "tips" ? formatCurrency(prevVal) : `${prevVal}${unit}`}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1.5 border-t border-slate-800">
              <span className="text-slate-400">Day Difference:</span>
              <span
                className={`font-black ${
                  diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-slate-400"
                }`}
              >
                {diff > 0 ? "+" : ""}
                {metricMode === "earnings" || metricMode === "tips" ? formatCurrency(diff) : `${diff}${unit}`} (
                {pct > 0 ? "+" : ""}
                {pct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6 text-left"
      id="weekly-comparison-card"
    >
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Weekly Income Comparison
              <span className="text-[10px] font-extrabold uppercase font-mono bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-full">
                Side-By-Side
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comparing current week <span className="font-semibold text-slate-800 dark:text-slate-200">({curWeekLabel})</span> vs previous week <span className="font-semibold text-slate-800 dark:text-slate-200">({prevWeekLabel})</span>
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Stepper */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Earlier Week"
              id="weekly-comp-prev-week-btn"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 font-mono">
              {weekOffset === 0 ? "Current Week" : `${Math.abs(weekOffset)} Wk${Math.abs(weekOffset) > 1 ? "s" : ""} Ago`}
            </span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Later Week"
              id="weekly-comp-next-week-btn"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition cursor-pointer border border-purple-200 dark:border-purple-900/50"
            >
              Reset to Current
            </button>
          )}

          {/* Metric Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setMetricMode("earnings")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                metricMode === "earnings"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              id="metric-mode-earnings-btn"
            >
              Earnings ($)
            </button>
            <button
              onClick={() => setMetricMode("hours")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                metricMode === "hours"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              id="metric-mode-hours-btn"
            >
              Hours
            </button>
            <button
              onClick={() => setMetricMode("trips")}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                metricMode === "trips"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              id="metric-mode-trips-btn"
            >
              Trips
            </button>
          </div>
        </div>
      </div>

      {/* Hero Growth Indicator Card Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Main Growth Percentage Card */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-2xl p-4 border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Weekly Revenue Growth
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {curWeekLabel}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white block">
                {formatCurrency(weeklyTotals.curTotalEarnings)}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5 font-mono">
                vs {formatCurrency(weeklyTotals.prevTotalEarnings)} previous week
              </span>
            </div>

            {/* Prominent Growth Percentage Badge */}
            <div
              className={`px-3.5 py-2 rounded-2xl border flex items-center gap-2 font-mono font-black text-sm sm:text-base shadow-lg ${
                weeklyTotals.earningsGrowthPct > 0
                  ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-emerald-950/50"
                  : weeklyTotals.earningsGrowthPct < 0
                  ? "bg-rose-950/80 border-rose-500/50 text-rose-400 shadow-rose-950/50"
                  : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
              id="weekly-growth-percentage-badge"
            >
              {weeklyTotals.earningsGrowthPct > 0 ? (
                <TrendingUp className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : weeklyTotals.earningsGrowthPct < 0 ? (
                <TrendingDown className="w-5 h-5 shrink-0 text-rose-400" />
              ) : (
                <Minus className="w-5 h-5 shrink-0 text-slate-400" />
              )}
              <span>
                {weeklyTotals.earningsGrowthPct > 0 ? "+" : ""}
                {weeklyTotals.earningsGrowthPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Net Difference:{" "}
              <strong
                className={
                  weeklyTotals.earningsDiff >= 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {weeklyTotals.earningsDiff >= 0 ? "+" : ""}
                {formatCurrency(weeklyTotals.earningsDiff)}
              </strong>
            </span>
            <span className="text-[10px] text-slate-500">
              {weeklyTotals.earningsDiff >= 0 ? "Revenue Increased" : "Revenue Decreased"}
            </span>
          </div>
        </div>

        {/* Hourly Rate Comparison Card */}
        <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Hourly Efficiency
            </span>
            <span
              className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                weeklyTotals.hourlyGrowthPct >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
              }`}
            >
              {weeklyTotals.hourlyGrowthPct >= 0 ? "+" : ""}
              {weeklyTotals.hourlyGrowthPct.toFixed(1)}%
            </span>
          </div>

          <div className="my-2">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono block">
              {formatCurrency(weeklyTotals.curHourlyRate)} / hr
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              vs {formatCurrency(weeklyTotals.prevHourlyRate)} / hr prev week
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            {weeklyTotals.curTotalHours.toFixed(1)}h logged vs {weeklyTotals.prevTotalHours.toFixed(1)}h prev
          </div>
        </div>

        {/* Trips Comparison Card */}
        <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-purple-500" />
              Trip Volume
            </span>
            <span
              className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                weeklyTotals.tripsGrowthPct >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
              }`}
            >
              {weeklyTotals.tripsGrowthPct >= 0 ? "+" : ""}
              {weeklyTotals.tripsGrowthPct.toFixed(1)}%
            </span>
          </div>

          <div className="my-2">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono block">
              {weeklyTotals.curTotalTrips} Trips
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              vs {weeklyTotals.prevTotalTrips} trips prev week
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            Diff: {weeklyTotals.tripsDiff >= 0 ? "+" : ""}
            {weeklyTotals.tripsDiff} trips
          </div>
        </div>
      </div>

      {/* Main Side-by-Side Recharts Chart */}
      <div className="pt-2">
        <div className="h-72 w-full" id="weekly-recharts-bar-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
              <XAxis
                dataKey="dayName"
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => (metricMode === "earnings" || metricMode === "tips" ? `$${val}` : `${val}`)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }}
              />

              {metricMode === "earnings" && (
                <>
                  <Bar dataKey="currentWeek" name="Current Week ($)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="previousWeek" name="Previous Week ($)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </>
              )}

              {metricMode === "hours" && (
                <>
                  <Bar dataKey="currentHours" name="Current Week (Hrs)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="previousHours" name="Previous Week (Hrs)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </>
              )}

              {metricMode === "trips" && (
                <>
                  <Bar dataKey="currentTrips" name="Current Week (Trips)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="previousTrips" name="Previous Week (Trips)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day-by-Day Table Breakdown */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Day-By-Day Breakdown
        </h4>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="px-3.5 py-2.5">Day</th>
                <th className="px-3.5 py-2.5 text-right">This Week ({curWeekLabel})</th>
                <th className="px-3.5 py-2.5 text-right">Prev Week ({prevWeekLabel})</th>
                <th className="px-3.5 py-2.5 text-right">Variance ($)</th>
                <th className="px-3.5 py-2.5 text-right">% Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {comparisonData.map((d) => {
                const diff = d.currentWeek - d.previousWeek;
                const pct = d.previousWeek > 0 ? (diff / d.previousWeek) * 100 : (d.currentWeek > 0 ? 100 : 0);

                return (
                  <tr key={d.dayName} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-3.5 py-2 font-sans font-bold text-slate-800 dark:text-slate-200">
                      {d.fullDayName}
                    </td>
                    <td className="px-3.5 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(d.currentWeek)}
                    </td>
                    <td className="px-3.5 py-2 text-right text-slate-500 dark:text-slate-400">
                      {formatCurrency(d.previousWeek)}
                    </td>
                    <td
                      className={`px-3.5 py-2 text-right font-bold ${
                        diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatCurrency(diff)}
                    </td>
                    <td
                      className={`px-3.5 py-2 text-right font-bold ${
                        pct > 0 ? "text-emerald-600 dark:text-emerald-400" : pct < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                      }`}
                    >
                      {pct > 0 ? "+" : ""}
                      {pct.toFixed(1)}%
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
