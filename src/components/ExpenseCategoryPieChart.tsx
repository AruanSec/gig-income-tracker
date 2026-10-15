import { addMoney } from "../money";
import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { PieChart as PieIcon, DollarSign, Tag, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { VehicleExpense } from "../types";
import { formatCurrency } from "../utils";

interface ExpenseCategoryPieChartProps {
  expenses: VehicleExpense[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Fuel: "#f59e0b", // Amber
  Insurance: "#8b5cf6", // Violet
  Maintenance: "#06b6d4", // Cyan
  Repairs: "#ef4444", // Red
  "Oil Change": "#3b82f6", // Blue
  Tires: "#6366f1", // Indigo
  "Cleaning/Detailing": "#10b981", // Emerald
  "Parking/Tolls": "#64748b", // Slate
  "License/Registration": "#ec4899", // Pink
  "License/Registration/Taxes": "#ec4899",
  Other: "#a855f7", // Purple
};

const DEFAULT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#6366f1", "#64748b", "#a855f7"
];

export default function ExpenseCategoryPieChart({ expenses }: ExpenseCategoryPieChartProps) {
  // Extract available years from expenses date
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    expenses.forEach((e) => {
      if (e.date) {
        const yr = e.date.split("-")[0];
        if (yr && yr.length === 4) {
          yearsSet.add(yr);
        }
      }
    });
    const sorted = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    return ["All", ...sorted];
  }, [expenses]);

  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Filter expenses by selected year
  const filteredExpenses = useMemo(() => {
    if (selectedYear === "All") return expenses;
    return expenses.filter((e) => e.date && e.date.startsWith(selectedYear));
  }, [expenses, selectedYear]);

  // Aggregate by category
  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; count: number }> = {};

    filteredExpenses.forEach((item) => {
      const cat = item.category?.trim() || "Other";
      if (!map[cat]) {
        map[cat] = { name: cat, value: 0, count: 0 };
      }
      map[cat].value = addMoney(map[cat].value, item.amount);
      map[cat].count += 1;
    });

    const total = Object.values(map).reduce((acc, curr) => addMoney(acc, curr.value), 0);

    return Object.values(map)
      .map((item, idx) => ({
        ...item,
        value: parseFloat(item.value.toFixed(2)),
        percentage: total > 0 ? parseFloat(((item.value / total) * 100).toFixed(1)) : 0,
        color: CATEGORY_COLORS[item.name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const totalExpenseAmount = useMemo(() => {
    return categoryData.reduce((acc, c) => addMoney(acc, c.value), 0);
  }, [categoryData]);

  const topCategory = categoryData[0] || null;

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl p-3 shadow-2xl text-xs font-sans border border-slate-800 backdrop-blur-xs min-w-[170px] space-y-1.5 text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-extrabold text-slate-100 flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: data.color }}
              />
              {data.name}
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              {data.percentage}%
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Spent:</span>
              <span className="font-bold text-blue-400">{formatCurrency(data.value)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Entries:</span>
              <span>{data.count} log{data.count === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5" id="expense-pie-chart-card">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Expense Category Breakdown
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/50 font-mono">
                {selectedYear === "All" ? "All Time" : selectedYear}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visual distribution of vehicle operational costs by category
            </p>
          </div>
        </div>

        {/* Year Filter Dropdown */}
        {availableYears.length > 1 && (
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 pl-2">Filter Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
              id="expense-pie-chart-year-select"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="dark:bg-slate-900 dark:text-white">
                  {yr === "All" ? "All Time" : yr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {categoryData.length === 0 ? (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-2 text-slate-400 dark:text-slate-500">
          <AlertCircle className="w-8 h-8 opacity-50" />
          <p className="text-xs font-medium">No vehicle expenses logged for this timeframe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Left / Top: Recharts Pie Chart Canvas */}
          <div className="md:col-span-6 lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="h-64 w-full relative" id="recharts-pie-canvas-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="#ffffff"
                        strokeWidth={activeIndex === index ? 3 : 1}
                        className="transition-all duration-200 cursor-pointer hover:opacity-90 dark:stroke-slate-900"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Total Spent
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {formatCurrency(totalExpenseAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Right / Bottom: Category Legend Breakdown Grid */}
          <div className="md:col-span-6 lg:col-span-7 space-y-3">
            
            {/* Top Category Badge */}
            {topCategory && (
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-purple-600 dark:text-purple-400 block">
                      Largest Expense Category
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {topCategory.name}
                    </span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="font-extrabold text-slate-900 dark:text-white block">
                    {formatCurrency(topCategory.value)}
                  </span>
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                    {topCategory.percentage}% of total
                  </span>
                </div>
              </div>
            )}

            {/* List of categories */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {categoryData.map((item, index) => {
                const isHovered = activeIndex === index;
                return (
                  <div
                    key={item.name}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isHovered
                        ? "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-2xs"
                        : "bg-slate-50/50 dark:bg-slate-850/40 border-slate-100 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        ({item.count} log{item.count === 1 ? "" : "s"})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono shrink-0">
                      <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white w-16 text-right">
                        {formatCurrency(item.value)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-10 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
