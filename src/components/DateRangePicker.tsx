import React from "react";
import { motion } from "motion/react";
import { Calendar, X, CalendarDays, Sparkles } from "lucide-react";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  label?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  label = "Filter by Date Range"
}: DateRangePickerProps) {
  
  // Quick helper to get ISO date string (YYYY-MM-DD)
  const toISODate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const handlePreset = (preset: "this-week" | "last-week" | "this-month" | "last-month" | "this-year" | "all") => {
    const today = new Date();
    
    switch (preset) {
      case "this-week": {
        // Start of week: Monday
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        onChange(toISODate(monday), toISODate(new Date()));
        break;
      }
      case "last-week": {
        // Last week's Monday to Sunday
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const lastMonday = new Date(today.setDate(diff));
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        onChange(toISODate(lastMonday), toISODate(lastSunday));
        break;
      }
      case "this-month": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        onChange(toISODate(firstDay), toISODate(new Date()));
        break;
      }
      case "last-month": {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        onChange(toISODate(firstDayLastMonth), toISODate(lastDayLastMonth));
        break;
      }
      case "this-year": {
        const firstDayYear = new Date(today.getFullYear(), 0, 1);
        onChange(toISODate(firstDayYear), toISODate(new Date()));
        break;
      }
      case "all":
      default:
        onChange("", "");
        break;
    }
  };

  // Determine which preset is currently active (if any)
  const getActivePreset = (): string => {
    if (!startDate && !endDate) return "all";
    
    const today = new Date();
    const todayStr = toISODate(today);

    // This Week Check
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    if (startDate === toISODate(monday) && endDate === todayStr) return "this-week";

    // Last Week Check
    today.setDate(new Date().getDate()); // reset
    const lastDiff = today.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const lastMonday = new Date(today.setDate(lastDiff));
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    if (startDate === toISODate(lastMonday) && endDate === toISODate(lastSunday)) return "last-week";

    // This Month Check
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    if (startDate === toISODate(firstDay) && endDate === todayStr) return "this-month";

    // Last Month Check
    const firstDayLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastDayLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
    if (startDate === toISODate(firstDayLastMonth) && endDate === toISODate(lastDayLastMonth)) return "last-month";

    // This Year Check
    const firstDayYear = new Date(new Date().getFullYear(), 0, 1);
    if (startDate === toISODate(firstDayYear) && endDate === todayStr) return "this-year";

    return "custom";
  };

  const activePreset = getActivePreset();

  return (
    <div 
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3.5"
      id="date-range-picker-container"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {label}
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Filter records and metrics chronologically
            </p>
          </div>
        </div>

        {/* Clear filter button if range is active */}
        {(startDate || endDate) && (
          <button
            onClick={() => onChange("", "")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 hover:underline cursor-pointer transition self-end sm:self-auto"
            id="clear-range-btn"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset filter</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
        {/* Presets List */}
        <div className="lg:col-span-7 flex flex-wrap gap-1.5" id="preset-buttons-container">
          <button
            type="button"
            onClick={() => handlePreset("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
              activePreset === "all"
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white"
                : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
            id="preset-all"
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => handlePreset("this-week")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
              activePreset === "this-week"
                ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
            id="preset-this-week"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => handlePreset("last-week")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
              activePreset === "last-week"
                ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
            id="preset-last-week"
          >
            Last Week
          </button>
          <button
            type="button"
            onClick={() => handlePreset("this-month")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
              activePreset === "this-month"
                ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
            id="preset-this-month"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handlePreset("last-month")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
              activePreset === "last-month"
                ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
            id="preset-last-month"
          >
            Last Month
          </button>
          <button
            type="button"
            onClick={() => handlePreset("this-year")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer border ${
              activePreset === "this-year"
                ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
            id="preset-this-year"
          >
            This Year
          </button>
        </div>

        {/* Custom Inputs */}
        <div className="lg:col-span-5 flex items-center gap-2.5 w-full" id="manual-inputs-container">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider pl-0.5">
              From Date
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onChange(e.target.value, endDate)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition [color-scheme:light_dark]"
              id="date-picker-start"
            />
          </div>

          <div className="text-slate-300 dark:text-slate-700 shrink-0 font-medium pt-4.5">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>

          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-450 dark:text-slate-550 uppercase tracking-wider pl-0.5">
              To Date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onChange(startDate, e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition [color-scheme:light_dark]"
              id="date-picker-end"
            />
          </div>
        </div>
      </div>

      {/* Active Range Summary (Subtle) */}
      {startDate && endDate && (
        <motion.div 
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/50 dark:bg-blue-950/25 border border-blue-100/60 dark:border-blue-900/30 rounded-xl text-[11px] font-medium text-blue-700 dark:text-blue-300 w-fit"
          id="active-range-summary"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Active filter period: <span className="font-bold">{startDate}</span> to <span className="font-bold">{endDate}</span></span>
        </motion.div>
      )}
    </div>
  );
}
