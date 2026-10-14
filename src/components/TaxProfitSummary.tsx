import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Download, 
  Printer, 
  Calendar, 
  Sparkles, 
  Calculator, 
  AlertCircle, 
  Coins, 
  Scale, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  BookOpen, 
  FileText,
  HelpCircle,
  BarChart3,
  Layers,
  Flame,
  Sun,
  Snowflake,
  Filter,
  RotateCcw,
  GripVertical
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableDashboardSection } from "./SortableDashboardSection";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { IncomeEntry, MileageEntry, VehicleExpense, CraRate } from "../types";
import { formatCurrency, formatDate, calendarDate, calculateTripDeductions } from "../utils";

interface TaxProfitSummaryProps {
  entries: IncomeEntry[];
  mileageEntries: MileageEntry[];
  expenses: VehicleExpense[];
  craRates?: CraRate[];
}

type PeriodType = "all" | "annual" | "quarterly" | "monthly";

const DEFAULT_TAX_SECTION_ORDER = [
  "summary-widgets",
  "filters-estimators",
  "trend-chart",
  "seasonal-breakdown",
  "filing-comparison",
  "itemized-ledger",
];

export default function TaxProfitSummary({ entries, mileageEntries, expenses, craRates }: TaxProfitSummaryProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("annual");
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [breakdownYear, setBreakdownYear] = useState<number>(() => new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(() => Math.ceil((new Date().getMonth() + 1) / 3));
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [taxRate, setTaxRate] = useState<number>(15); // Marginal tax rate slider (default 15%)
  const [businessUsePercentage, setBusinessUsePercentage] = useState<number>(85); // Actual expense business ratio (default 85%)

  const [planningMethod, setPlanningMethod] = useState<"actual" | "standard">("actual");

  // Drag and drop section reordering state
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("tax_summary_section_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_TAX_SECTION_ORDER.length) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_TAX_SECTION_ORDER;
  });

  useEffect(() => {
    try {
      localStorage.setItem("tax_summary_section_order", JSON.stringify(sectionOrder));
    } catch (e) {
      // ignore
    }
  }, [sectionOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleResetLayout = () => {
    setSectionOrder(DEFAULT_TAX_SECTION_ORDER);
  };

  // Keep breakdownYear updated when selectedYear changes
  useEffect(() => {
    setBreakdownYear(selectedYear);
  }, [selectedYear]);

  // Extract available years from our records
  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]); // ensure current local year is default
    
    entries.forEach(e => {
      const y = calendarDate(e.startDate).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    mileageEntries.forEach(e => {
      const y = calendarDate(e.date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    expenses.forEach(e => {
      const y = calendarDate(e.date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [entries, mileageEntries, expenses]);

  // Period filtering logic
  const filteredData = useMemo(() => {
    const filteredEntries = entries.filter(entry => {
      const date = calendarDate(entry.startDate);
      const y = date.getFullYear();
      const m = date.getMonth() + 1; // 1-indexed

      if (periodType === "all") return true;
      if (y !== selectedYear) return false;

      if (periodType === "annual") return true;
      if (periodType === "quarterly") {
        const q = Math.ceil(m / 3);
        return q === selectedQuarter;
      }
      if (periodType === "monthly") {
        return m === selectedMonth;
      }
      return true;
    });

    const filteredMileage = mileageEntries.filter(entry => {
      const date = calendarDate(entry.date);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;

      if (periodType === "all") return true;
      if (y !== selectedYear) return false;

      if (periodType === "annual") return true;
      if (periodType === "quarterly") {
        const q = Math.ceil(m / 3);
        return q === selectedQuarter;
      }
      if (periodType === "monthly") {
        return m === selectedMonth;
      }
      return true;
    });

    const filteredExpenses = expenses.filter(entry => {
      const date = calendarDate(entry.date);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;

      if (periodType === "all") return true;
      if (y !== selectedYear) return false;

      if (periodType === "annual") return true;
      if (periodType === "quarterly") {
        const q = Math.ceil(m / 3);
        return q === selectedQuarter;
      }
      if (periodType === "monthly") {
        return m === selectedMonth;
      }
      return true;
    });

    return {
      entries: filteredEntries,
      mileage: filteredMileage,
      expenses: filteredExpenses
    };
  }, [entries, mileageEntries, expenses, periodType, selectedYear, selectedQuarter, selectedMonth]);

  // Core calculations based on filtered data
  const stats = useMemo(() => {
    // Gross Income (Net fare + tips)
    let grossIncome = 0;
    let netFare = 0;
    let tips = 0;
    let taxesWithheld = 0;
    let totalOnlineMinutes = 0;

    filteredData.entries.forEach(e => {
      netFare += e.netFare;
      tips += e.tips;
      taxesWithheld += e.taxes;
      grossIncome += (e.netFare + e.tips);
      totalOnlineMinutes += e.onlineMinutes;
    });

    // 1. Mileage standard deductions
    // Under CRA: standard rates are chronologically calculated (first 5,000km of the calendar year is Tier 1 @ 0.72, after is Tier 2 @ 0.66)
    // To make this robust, we calculate the trip deductions chronologically for the full year and then filter/sum those that fall in the filtered set.
    const allTripsForYear = mileageEntries.filter(e => {
      if (periodType === "all") return true;
      return calendarDate(e.date).getFullYear() === selectedYear;
    });
    
    const tripDeductionMap = calculateTripDeductions(allTripsForYear, craRates);
    
    let mileageDeduction = 0;
    let mileageKm = 0;
    filteredData.mileage.forEach(e => {
      mileageKm += e.distance;
      const calc = tripDeductionMap[e.id];
      if (calc) {
        mileageDeduction += calc.deduction;
      } else {
        // Fallback standard flat rate
        mileageDeduction += e.distance * 0.72;
      }
    });

    // 2. Actual Expenses
    let totalActualExpenses = 0;
    let gstHstTotal = 0;
    const actualExpensesByCategory: Record<string, number> = {};

    filteredData.expenses.forEach(e => {
      totalActualExpenses += e.amount;
      gstHstTotal += (e.gstHstAmount || 0);
      actualExpensesByCategory[e.category] = (actualExpensesByCategory[e.category] || 0) + e.amount;
    });

    // Deductible actual expenses = Actual vehicle expenses * business ratio
    const deductibleActualExpenses = totalActualExpenses * (businessUsePercentage / 100);

    // The user chooses a planning comparison; this does not establish tax eligibility.
    const chosenDeduction = planningMethod === "standard" ? mileageDeduction : deductibleActualExpenses;
    
    // Profit calculations
    const netProfitStandard = grossIncome - mileageDeduction;
    const netProfitActual = grossIncome - deductibleActualExpenses;
    const optimalNetProfit = grossIncome - chosenDeduction;

    // Estimated Taxes Owed
    const estTaxOwed = Math.max(0, optimalNetProfit) * (taxRate / 100);

    return {
      grossIncome,
      netFare,
      tips,
      taxesWithheld,
      mileageKm,
      mileageDeduction,
      totalActualExpenses,
      gstHstTotal,
      actualExpensesByCategory,
      deductibleActualExpenses,
      planningMethod,
      chosenDeduction,
      optimalNetProfit,
      netProfitStandard,
      netProfitActual,
      estTaxOwed,
      totalOnlineMinutes
    };
  }, [filteredData, mileageEntries, craRates, periodType, selectedYear, taxRate, businessUsePercentage, planningMethod]);

  // 6-Month Trend Data for Recharts Line Chart
  const last6MonthsData = useMemo(() => {
    const result = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-indexed
      
      const monthEntries = entries.filter(e => {
        const ed = calendarDate(e.startDate);
        return ed.getFullYear() === year && ed.getMonth() === month;
      });
      
      const monthMileage = mileageEntries.filter(e => {
        const md = calendarDate(e.date);
        return md.getFullYear() === year && md.getMonth() === month;
      });
      
      const monthExpenses = expenses.filter(e => {
        const xd = calendarDate(e.date);
        return xd.getFullYear() === year && xd.getMonth() === month;
      });
      
      const gross = monthEntries.reduce((acc, curr) => acc + curr.netFare + curr.tips, 0);
      
      const allTripsForYear = mileageEntries.filter(e => calendarDate(e.date).getFullYear() === year);
      const tripDeductions = calculateTripDeductions(allTripsForYear, craRates);
      
      let mileageDeduct = 0;
      monthMileage.forEach(e => {
        const calc = tripDeductions[e.id];
        if (calc) {
          mileageDeduct += calc.deduction;
        } else {
          mileageDeduct += e.distance * 0.72;
        }
      });
      
      const actualTotal = monthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      const actualDeduct = actualTotal * (businessUsePercentage / 100);
      
      const chosenDeduct = planningMethod === "standard" ? mileageDeduct : actualDeduct;
      const netProfit = gross - chosenDeduct;
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      result.push({
        name: `${monthNames[month]} ${year}`,
        "Net Profit": Number(netProfit.toFixed(2)),
        "Gross Revenue": Math.round(gross),
        "Deductions": Math.round(chosenDeduct),
      });
    }
    return result;
  }, [entries, mileageEntries, expenses, craRates, businessUsePercentage, planningMethod]);

  // 12-Month Seasonal Breakdown Data for Breakdown Year
  const monthlyBreakdownData = useMemo(() => {
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthNamesFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const yearEntries = entries.filter(e => {
      const d = calendarDate(e.startDate);
      return !isNaN(d.getTime()) && d.getFullYear() === breakdownYear;
    });
    const yearMileage = mileageEntries.filter(e => {
      const d = calendarDate(e.date);
      return !isNaN(d.getTime()) && d.getFullYear() === breakdownYear;
    });
    const yearExpenses = expenses.filter(e => {
      const d = calendarDate(e.date);
      return !isNaN(d.getTime()) && d.getFullYear() === breakdownYear;
    });

    const yearTripsForDeduction = calculateTripDeductions(yearMileage, craRates);

    let maxRevenue = 0;
    let maxExpense = 0;
    let peakRevMonth = "N/A";
    let peakRevVal = 0;
    let peakExpMonth = "N/A";
    let peakExpVal = 0;
    let peakProfitMonth = "N/A";
    let peakProfitVal = -Infinity;

    let totalYearRevenue = 0;
    let totalYearExpenses = 0;
    let totalYearMileageDeduction = 0;
    let totalYearClaimedDeductions = 0;
    let totalYearNetProfit = 0;

    const monthlyStats = monthNamesShort.map((shortName, monthIdx) => {
      const mEntries = yearEntries.filter(e => calendarDate(e.startDate).getMonth() === monthIdx);
      const mExpenses = yearExpenses.filter(e => calendarDate(e.date).getMonth() === monthIdx);
      const mMileage = yearMileage.filter(e => calendarDate(e.date).getMonth() === monthIdx);

      const revenue = mEntries.reduce((acc, curr) => acc + curr.netFare + curr.tips, 0);
      const netFare = mEntries.reduce((acc, curr) => acc + curr.netFare, 0);
      const tips = mEntries.reduce((acc, curr) => acc + curr.tips, 0);

      const actualExpenses = mExpenses.reduce((acc, curr) => acc + curr.amount, 0);

      let mileageDeduct = 0;
      let mileageKm = 0;
      mMileage.forEach(e => {
        mileageKm += e.distance;
        const calc = yearTripsForDeduction[e.id];
        if (calc) {
          mileageDeduct += calc.deduction;
        } else {
          mileageDeduct += e.distance * 0.72;
        }
      });

      const deductibleActual = actualExpenses * (businessUsePercentage / 100);
      const claimedDeduction = planningMethod === "standard" ? mileageDeduct : deductibleActual;
      const netProfit = revenue - claimedDeduction;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      totalYearRevenue += revenue;
      totalYearExpenses += actualExpenses;
      totalYearMileageDeduction += mileageDeduct;
      totalYearClaimedDeductions += claimedDeduction;
      totalYearNetProfit += netProfit;

      if (revenue > maxRevenue) maxRevenue = revenue;
      if (actualExpenses > maxExpense) maxExpense = actualExpenses;

      if (revenue > peakRevVal && revenue > 0) {
        peakRevVal = revenue;
        peakRevMonth = monthNamesFull[monthIdx];
      }
      if (actualExpenses > peakExpVal && actualExpenses > 0) {
        peakExpVal = actualExpenses;
        peakExpMonth = monthNamesFull[monthIdx];
      }
      if (netProfit > peakProfitVal && revenue > 0) {
        peakProfitVal = netProfit;
        peakProfitMonth = monthNamesFull[monthIdx];
      }

      return {
        month: shortName,
        fullMonth: monthNamesFull[monthIdx],
        monthIdx,
        revenue: Number(revenue.toFixed(2)),
        netFare: Number(netFare.toFixed(2)),
        tips: Number(tips.toFixed(2)),
        actualExpenses: Number(actualExpenses.toFixed(2)),
        mileageKm: Math.round(mileageKm),
        mileageDeduction: Number(mileageDeduct.toFixed(2)),
        claimedDeduction: Number(claimedDeduction.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        profitMargin: Math.round(profitMargin),
      };
    });

    const quarterly = [
      { q: "Q1", label: "Jan – Mar", months: monthlyStats.slice(0, 3) },
      { q: "Q2", label: "Apr – Jun", months: monthlyStats.slice(3, 6) },
      { q: "Q3", label: "Jul – Sep", months: monthlyStats.slice(6, 9) },
      { q: "Q4", label: "Oct – Dec", months: monthlyStats.slice(9, 12) },
    ].map(item => {
      const qRev = item.months.reduce((acc, m) => acc + m.revenue, 0);
      const qExp = item.months.reduce((acc, m) => acc + m.actualExpenses, 0);
      const qDed = item.months.reduce((acc, m) => acc + m.claimedDeduction, 0);
      const qProfit = item.months.reduce((acc, m) => acc + m.netProfit, 0);
      const qMargin = qRev > 0 ? (qProfit / qRev) * 100 : 0;
      return {
        quarter: item.q,
        label: item.label,
        revenue: qRev,
        expenses: qExp,
        deductions: qDed,
        netProfit: qProfit,
        profitMargin: Math.round(qMargin),
      };
    });

    return {
      monthlyStats,
      quarterly,
      totalYearRevenue,
      totalYearExpenses,
      totalYearMileageDeduction,
      totalYearClaimedDeductions,
      totalYearNetProfit,
      maxRevenue: maxRevenue || 1,
      maxExpense: maxExpense || 1,
      peakRevMonth,
      peakRevVal,
      peakExpMonth,
      peakExpVal,
      peakProfitMonth,
      peakProfitVal: peakProfitVal > -Infinity ? peakProfitVal : 0,
    };
  }, [entries, mileageEntries, expenses, breakdownYear, businessUsePercentage, craRates, planningMethod]);

  // Recharts Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white border border-slate-800 rounded-xl p-3 shadow-2xl text-left font-sans text-xs flex flex-col gap-1.5 pointer-events-none min-w-[145px]" id="recharts-custom-tooltip">
          <p className="font-bold text-slate-100 border-b border-slate-800 pb-1 mb-0.5">{label}</p>
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-4 items-center">
              <span className="text-slate-400 font-medium">{entry.name}:</span>
              <span className="font-bold font-mono" style={{ color: entry.stroke || entry.color }}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format helper for label
  const getPeriodLabel = () => {
    if (periodType === "all") return "All Time";
    const yearSuffix = ` ${selectedYear}`;
    if (periodType === "annual") return `Full Year${yearSuffix}`;
    if (periodType === "quarterly") return `Q${selectedQuarter}${yearSuffix}`;
    if (periodType === "monthly") {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return `${monthNames[selectedMonth - 1]}${yearSuffix}`;
    }
    return "";
  };

  // CSV Export Trigger
  const handleExportCSV = () => {
    const title = `Gig_Economy_Tax_Summary_${getPeriodLabel().replace(/\s+/g, "_")}`;
    const headers = ["Financial Line Item", "Amount (CAD)", "Notes / Description"];
    
    const rows = [
      ["Gross Income (Net Fare + Tips)", stats.grossIncome.toFixed(2), "Total driver platform revenue before write-offs"],
      ["  - Net Fare portion", stats.netFare.toFixed(2), "Platform fares after company fees"],
      ["  - Tips portion", stats.tips.toFixed(2), "100% driver-retained customer tips"],
      ["Taxes Withheld at Source", stats.taxesWithheld.toFixed(2), "Income tax pre-deducted by platforms"],
      [],
      ["DEDUCTION OPTION 1: Standard Km Rate", stats.mileageDeduction.toFixed(2), `Standard CRA Rate (${stats.mileageKm} km tracked)`],
      ["DEDUCTION OPTION 2: Actual Vehicle Costs", stats.totalActualExpenses.toFixed(2), "Sum of all logged operating receipts"],
      [`  - Deductible portion (${businessUsePercentage}%)`, stats.deductibleActualExpenses.toFixed(2), "Calculated based on business use ratio slider"],
      [],
      ["SELECTED PLANNING METHOD", stats.planningMethod === "standard" ? "Standard Km Mileage Rate" : "Actual Receipts Method", "User-selected comparison; confirm eligibility before filing"],
      ["Planning Expense Estimate", stats.chosenDeduction.toFixed(2), "Deduction value applied to net profit calculation"],
      [],
      ["Estimated Profit / Loss", stats.optimalNetProfit.toFixed(2), "Gross revenue minus the selected planning expense estimate"],
      [`Estimated Taxes Owed (${taxRate}%)`, stats.estTaxOwed.toFixed(2), `Estimated income tax based on interactive ${taxRate}% rate`],
      ["Tracked GST/HST (ITCs)", stats.gstHstTotal.toFixed(2), "Tracked tax amounts before eligibility and business-use review"]
    ];

    // Build categories breakdown
    if (Object.keys(stats.actualExpensesByCategory).length > 0) {
      rows.push([]);
      rows.push(["ACTUAL EXPENSES BREAKDOWN", "", ""]);
      Object.entries(stats.actualExpensesByCategory).forEach(([cat, val]) => {
        rows.push([`  - ${cat}`, (val as number).toFixed(2), ""]);
      });
    }

    // Seasonal Monthly Breakdown Table Export
    rows.push([]);
    rows.push([`SEASONAL MONTHLY BREAKDOWN (${breakdownYear})`, "", "Monthly Revenue vs. Total Expenses"]);
    rows.push(["Month", "Gross Revenue ($)", "Actual Expenses ($)", "Planning Expense Estimate (CAD)", "Estimated Profit / Loss ($)", "Profit Margin (%)"]);
    monthlyBreakdownData.monthlyStats.forEach(m => {
      rows.push([
        m.fullMonth,
        m.revenue.toFixed(2),
        m.actualExpenses.toFixed(2),
        m.claimedDeduction.toFixed(2),
        m.netProfit.toFixed(2),
        `${m.profitMargin}%`
      ]);
    });
    rows.push([
      "FULL YEAR TOTAL",
      monthlyBreakdownData.totalYearRevenue.toFixed(2),
      monthlyBreakdownData.totalYearExpenses.toFixed(2),
      monthlyBreakdownData.totalYearClaimedDeductions.toFixed(2),
      monthlyBreakdownData.totalYearNetProfit.toFixed(2),
      monthlyBreakdownData.totalYearRevenue > 0
        ? `${Math.round((monthlyBreakdownData.totalYearNetProfit / monthlyBreakdownData.totalYearRevenue) * 100)}%`
        : "0%"
    ]);

    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csvContent = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // PDF / System print friendly trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="tax-profit-summary-view">
      
      {/* 1. Header with Period Selectors */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <Calculator className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Tax Planner & Profit Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tax-Ready Financial Statement</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bring your weekly platform earnings and deductible vehicle expenses together to analyze your actual net take-home and prep for tax season.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <button
            onClick={handleResetLayout}
            className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 transition flex items-center gap-1.5 cursor-pointer rounded-lg shadow-2xs"
            title="Reset dashboard sections to default layout order"
            id="reset-layout-btn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Layout</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download statement as comma-separated values spreadsheet"
            id="export-csv-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Print tax-ready report or save as PDF"
            id="print-pdf-btn"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {sectionOrder.map((sectionId) => {
              if (sectionId === "filters-estimators") {
                return (
                  <SortableDashboardSection key="filters-estimators" id="filters-estimators" headerLabel="Period Filters & Tax Estimators">
                    {/* 2. Interactive Period Controls */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left Controls: Period Selection */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 lg:col-span-2">
                        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Filter Accounting Period
                        </h3>

                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Period Type Selection */}
                          <div className="flex flex-col gap-1 sm:w-1/3">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Report Frequency</span>
                            <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
                              <button
                                onClick={() => setPeriodType("annual")}
                                className={`py-1.5 text-center text-xs font-bold rounded-md transition cursor-pointer ${
                                  periodType === "annual" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-800/50" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                Annual
                              </button>
                              <button
                                onClick={() => setPeriodType("quarterly")}
                                className={`py-1.5 text-center text-xs font-bold rounded-md transition cursor-pointer ${
                                  periodType === "quarterly" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-800/50" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                Quarter
                              </button>
                              <button
                                onClick={() => setPeriodType("monthly")}
                                className={`py-1.5 text-center text-xs font-bold rounded-md transition cursor-pointer ${
                                  periodType === "monthly" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-800/50" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                Month
                              </button>
                              <button
                                onClick={() => setPeriodType("all")}
                                className={`py-1.5 text-center text-xs font-bold rounded-md transition cursor-pointer ${
                                  periodType === "all" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-800/50" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                All Time
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Suffix Selector based on Selection */}
                          <div className="flex-1 flex flex-wrap gap-4">
                            {/* Year Select (Active for everything except All Time) */}
                            {periodType !== "all" && (
                              <div className="flex flex-col gap-1 min-w-[100px]">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tax Year</span>
                                <select
                                  value={selectedYear}
                                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 font-bold text-slate-700 dark:text-slate-300"
                                >
                                  {availableYears.map(yr => (
                                    <option key={yr} value={yr} className="dark:bg-slate-950 dark:text-white">{yr}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Quarter Select */}
                            {periodType === "quarterly" && (
                              <div className="flex flex-col gap-1 min-w-[130px] flex-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Calendar Quarter</span>
                                <div className="grid grid-cols-4 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                                  {[1, 2, 3, 4].map(q => (
                                    <button
                                      key={q}
                                      onClick={() => setSelectedQuarter(q)}
                                      className={`py-1.5 text-center text-xs font-black rounded-md transition cursor-pointer ${
                                        selectedQuarter === q ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                                      }`}
                                    >
                                      Q{q}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Month Select */}
                            {periodType === "monthly" && (
                              <div className="flex flex-col gap-1 min-w-[150px] flex-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Specific Month</span>
                                <select
                                  value={selectedMonth}
                                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 font-bold text-slate-700 dark:text-slate-300"
                                >
                                  {[
                                    { v: 1, n: "January" },
                                    { v: 2, n: "February" },
                                    { v: 3, n: "March" },
                                    { v: 4, n: "April" },
                                    { v: 5, n: "May" },
                                    { v: 6, n: "June" },
                                    { v: 7, n: "July" },
                                    { v: 8, n: "August" },
                                    { v: 9, n: "September" },
                                    { v: 10, n: "October" },
                                    { v: 11, n: "November" },
                                    { v: 12, n: "December" },
                                  ].map(m => (
                                    <option key={m.v} value={m.v} className="dark:bg-slate-950 dark:text-white">{m.n}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Displaying Current Filters info */}
                            <div className="flex-1 flex flex-col justify-end min-w-[180px]">
                              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/40 p-2.5 rounded-xl text-left">
                                <p className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Active Statement Period</p>
                                <p className="text-sm font-black text-blue-900 dark:text-blue-300 font-mono mt-0.5">{getPeriodLabel()}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Controls: Interactive Tax Sliders */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Interactive Tax Estimators
                        </h3>

                        {/* Tax Rate Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-300">Est. Tax Rate</span>
                            <span className="font-black text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                              {taxRate}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="45"
                            step="1"
                            value={taxRate}
                            onChange={(e) => setTaxRate(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">
                            Set your personal income tax bracket for local + federal estimate.
                          </p>
                        </div>

                        {/* Business Use Ratio Slider */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-300">Vehicle Business Ratio</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-450 font-mono bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                              {businessUsePercentage}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={businessUsePercentage}
                            onChange={(e) => setBusinessUsePercentage(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">
                            Percentage of car kilometres driven strictly for business/gigs.
                          </p>
                        </div>
                      </div>

                    </div>
                  </SortableDashboardSection>
                );
              }

              if (sectionId === "summary-widgets") {
                return (
                  <SortableDashboardSection key="summary-widgets" id="summary-widgets" headerLabel="Profit Summary Cards">
                    {/* 3. Main Profit Summary Widgets */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      
                      {/* Gross Income Card */}
                      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 dark:border-slate-950 text-left space-y-1 relative group/gross cursor-help">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Platform Revenue</p>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition shrink-0" />
                          <div className="absolute bottom-full left-4 right-4 mb-2.5 bg-slate-950 text-slate-200 rounded-xl p-3 shadow-2xl text-[10px] leading-relaxed font-sans font-medium opacity-0 invisible group-hover/gross:opacity-100 group-hover/gross:visible transition-all duration-200 z-50 border border-slate-800 pointer-events-none">
                            Total combined fares and client tips received from all delivery/rideshare applications before tax write-offs.
                            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45"></div>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-white font-mono">{formatCurrency(stats.grossIncome)}</p>
                        <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 border-t border-slate-800">
                          <span>Fares: {formatCurrency(stats.netFare)}</span>
                          <span>Tips: {formatCurrency(stats.tips)}</span>
                        </div>
                      </div>

                      {/* Allowed Deductions Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 text-left space-y-1 relative group/deduct cursor-help">
                        <div className="absolute top-2.5 right-2.5 bg-blue-50 dark:bg-blue-950/60 text-[8px] font-black text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 border border-blue-100 dark:border-blue-900/50">
                          <CheckCircle2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                          Optimized
                        </div>
                        <div className="flex items-center justify-between pr-16">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planning Expense Estimate</p>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 transition shrink-0" />
                          <div className="absolute bottom-full left-4 right-4 mb-2.5 bg-slate-950 text-slate-200 rounded-xl p-3 shadow-2xl text-[10px] leading-relaxed font-sans font-medium opacity-0 invisible group-hover/deduct:opacity-100 group-hover/deduct:visible transition-all duration-200 z-50 border border-slate-800 pointer-events-none">
                            Planning comparison between a per-kilometre estimate and actual operating receipts. Confirm your eligible filing method with current CRA guidance.
                            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45"></div>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(stats.chosenDeduction)}</p>
                        <div className="flex items-center gap-1.5 pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Method:</span>
                          <span>{stats.planningMethod === "standard" ? "Standard Km Rate" : `Actual Receipts (${businessUsePercentage}%)`}</span>
                        </div>
                      </div>

                      {/* Estimated Profit / Loss Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 text-left space-y-1 relative group/net cursor-help">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimated Profit / Loss</p>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 transition shrink-0" />
                          <div className="absolute bottom-full left-4 right-4 mb-2.5 bg-slate-950 text-slate-200 rounded-xl p-3 shadow-2xl text-[10px] leading-relaxed font-sans font-medium opacity-0 invisible group-hover/net:opacity-100 group-hover/net:visible transition-all duration-200 z-50 border border-slate-800 pointer-events-none">
                            Your taxable business income after writing off business expenses. This is the value upon which taxes are estimated.
                            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45"></div>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-450 font-mono">{formatCurrency(stats.optimalNetProfit)}</p>
                        <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          <span>Net Profit Ratio:</span>
                          <span className="font-bold font-mono">
                            {stats.grossIncome > 0 ? `${Math.round((stats.optimalNetProfit / stats.grossIncome) * 100)}%` : "0%"}
                          </span>
                        </div>
                      </div>

                      {/* Estimated Income Taxes Card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 text-left space-y-1 relative group/tax cursor-help">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Taxes Owed</p>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 transition shrink-0" />
                          <div className="absolute bottom-full left-4 right-4 mb-2.5 bg-slate-950 text-slate-200 rounded-xl p-3 shadow-2xl text-[10px] leading-relaxed font-sans font-medium opacity-0 invisible group-hover/tax:opacity-100 group-hover/tax:visible transition-all duration-200 z-50 border border-slate-800 pointer-events-none">
                            Estimated income tax owed to the CRA based on your active net profit and the interactive tax rate slider.
                            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-950 border-r border-b border-slate-800 rotate-45"></div>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{formatCurrency(stats.estTaxOwed)}</p>
                        <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          <span>Rate: {taxRate}%</span>
                          <span>Withheld: {formatCurrency(stats.taxesWithheld)}</span>
                        </div>
                      </div>

                    </div>
                  </SortableDashboardSection>
                );
              }

              if (sectionId === "trend-chart") {
                return (
                  <SortableDashboardSection key="trend-chart" id="trend-chart" headerLabel="6-Month Performance Trend">
                    {/* 6-Month Net Profit Trend Line Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> 6-Month Business Performance Trend
                          </h3>
                          <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5">
                            Monthly overview of your gross revenues, optimised tax deductions, and net taxable profits.
                          </p>
                        </div>
                        <span className="self-start sm:self-auto text-[10px] font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-blue-100 dark:border-blue-900/40">
                          Monthly Analytics
                        </span>
                      </div>

                      <div className="h-64 w-full pt-4" id="net-profit-trend-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={last6MonthsData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              verticalAlign="top" 
                              height={36} 
                              iconType="circle"
                              iconSize={8}
                              wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}
                            />
                            <Line 
                              name="Net Profit" 
                              type="monotone" 
                              dataKey="Net Profit" 
                              stroke="#10b981" 
                              strokeWidth={3} 
                              activeDot={{ r: 6, strokeWidth: 0 }}
                              dot={{ r: 3, strokeWidth: 0, fill: '#10b981' }}
                            />
                            <Line 
                              name="Gross Revenue" 
                              type="monotone" 
                              dataKey="Gross Revenue" 
                              stroke="#3b82f6" 
                              strokeWidth={2} 
                              strokeDasharray="4 4"
                              dot={{ r: 2, strokeWidth: 0, fill: '#3b82f6' }}
                            />
                            <Line 
                              name="Deductions" 
                              type="monotone" 
                              dataKey="Deductions" 
                              stroke="#f59e0b" 
                              strokeWidth={1.5} 
                              strokeDasharray="2 2"
                              dot={{ r: 2, strokeWidth: 0, fill: '#f59e0b' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </SortableDashboardSection>
                );
              }

              if (sectionId === "seasonal-breakdown") {
                return (
                  <SortableDashboardSection key="seasonal-breakdown" id="seasonal-breakdown" headerLabel="Seasonal Trend Analysis">
                    {/* NEW: Monthly Revenue vs. Total Expenses Seasonal Breakdown */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5 text-left" id="monthly-seasonal-breakdown-section">
        
        {/* Header & Year Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Seasonal Trend Analysis</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              Monthly Revenue vs. Total Expenses Breakdown
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluate monthly income streams against vehicle expenses to detect seasonal peaks, off-peak months, and net profit margins.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tax Year:</span>
            <select
              value={breakdownYear}
              onChange={(e) => setBreakdownYear(Number(e.target.value))}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 font-bold text-slate-700 dark:text-slate-200"
              id="seasonal-breakdown-year-select"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr} className="dark:bg-slate-950 dark:text-white">{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3 Seasonal High-level Metric Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Peak Revenue Month */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-500" /> Peak Revenue Month
              </span>
              <p className="text-base font-black text-emerald-900 dark:text-emerald-200 mt-0.5">
                {monthlyBreakdownData.peakRevMonth}
              </p>
              <p className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(monthlyBreakdownData.peakRevVal)}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-300 shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          {/* Peak Expenses Month */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Snowflake className="w-3 h-3 text-blue-400" /> Highest Expense Month
              </span>
              <p className="text-base font-black text-amber-900 dark:text-amber-200 mt-0.5">
                {monthlyBreakdownData.peakExpMonth}
              </p>
              <p className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400">
                {formatCurrency(monthlyBreakdownData.peakExpVal)}
              </p>
            </div>
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-300 shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>

          {/* Most Profitable Month */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" /> Most Profitable Month
              </span>
              <p className="text-base font-black text-blue-900 dark:text-blue-200 mt-0.5">
                {monthlyBreakdownData.peakProfitMonth}
              </p>
              <p className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(monthlyBreakdownData.peakProfitVal)} Net
              </p>
            </div>
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Visual Revenue vs. Expenses Dual Bar Chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {breakdownYear} Monthly Revenue vs. Expense Comparison
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Green = Revenue | Amber = Expenses | Blue = Claimed Write-Off
            </span>
          </div>
          <div className="h-64 w-full pt-2" id="monthly-revenue-vs-expense-barchart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBreakdownData.monthlyStats} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={32} 
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}
                />
                <Bar name="Gross Revenue" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar name="Actual Expenses" dataKey="actualExpenses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar name="Claimed Deduction" dataKey="claimedDeduction" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quarterly Breakdown Summary Bar */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" /> Quarterly Performance Summary ({breakdownYear})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {monthlyBreakdownData.quarterly.map((q) => (
              <div 
                key={q.quarter}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-1.5">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 font-mono">{q.quarter} ({q.label})</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    q.profitMargin >= 60 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                    q.profitMargin >= 30 ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {q.profitMargin}% Margin
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Revenue:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(q.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Expenses:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(q.expenses)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200/50 dark:border-slate-800 font-extrabold">
                    <span>Net Profit:</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatCurrency(q.netProfit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 12-Month Detailed Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Complete 12-Month Ledger & Seasonal Ratios
            </h4>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Annual Revenue: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(monthlyBreakdownData.totalYearRevenue)}</strong> | 
              Annual Expenses: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(monthlyBreakdownData.totalYearExpenses)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                  <th className="py-2.5 px-3 text-right">Actual Expenses</th>
                  <th className="py-2.5 px-3 text-right">Claimed Deduction</th>
                  <th className="py-2.5 px-3 text-right">Net Profit</th>
                  <th className="py-2.5 px-3 text-center">Profit Margin</th>
                  <th className="py-2.5 px-3">Seasonal Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {monthlyBreakdownData.monthlyStats.map((m) => {
                  const isPeakRev = m.fullMonth === monthlyBreakdownData.peakRevMonth && m.revenue > 0;
                  const isPeakExp = m.fullMonth === monthlyBreakdownData.peakExpMonth && m.actualExpenses > 0;
                  const revRatio = Math.round((m.revenue / monthlyBreakdownData.maxRevenue) * 100);

                  return (
                    <tr 
                      key={m.month}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-850 transition ${
                        isPeakRev ? "bg-emerald-50/20 dark:bg-emerald-950/10" : 
                        isPeakExp ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold font-sans text-slate-800 dark:text-slate-200">
                        {m.fullMonth}
                      </td>

                      {/* Revenue */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(m.revenue)}
                        </span>
                        {m.revenue > 0 && (
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${revRatio}%` }} />
                          </div>
                        )}
                      </td>

                      {/* Actual Expenses */}
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(m.actualExpenses)}
                      </td>

                      {/* Claimed Deductions */}
                      <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">
                        {formatCurrency(m.claimedDeduction)}
                      </td>

                      {/* Net Profit */}
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(m.netProfit)}
                      </td>

                      {/* Margin % */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.profitMargin >= 65 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          m.profitMargin >= 35 ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                          m.revenue > 0 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                          "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                        }`}>
                          {m.revenue > 0 ? `${m.profitMargin}%` : "0%"}
                        </span>
                      </td>

                      {/* Seasonal Tag */}
                      <td className="py-2.5 px-3 font-sans">
                        {isPeakRev ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                            <Sun className="w-3 h-3 text-amber-500" /> Peak Revenue
                          </span>
                        ) : isPeakExp ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                            <Snowflake className="w-3 h-3 text-blue-400" /> High Expense
                          </span>
                        ) : m.revenue > 0 ? (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            Standard Activity
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-350 dark:text-slate-600 italic">
                            No Logs
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-950 font-bold border-t-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                  <td className="py-2.5 px-3 font-sans">12-Month Total</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(monthlyBreakdownData.totalYearRevenue)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatCurrency(monthlyBreakdownData.totalYearExpenses)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                    {formatCurrency(monthlyBreakdownData.totalYearClaimedDeductions)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-450">
                    {formatCurrency(monthlyBreakdownData.totalYearNetProfit)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {monthlyBreakdownData.totalYearRevenue > 0
                      ? `${Math.round((monthlyBreakdownData.totalYearNetProfit / monthlyBreakdownData.totalYearRevenue) * 100)}%`
                      : "0%"}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-[10px] text-slate-500 dark:text-slate-400">
                    Full Calendar Summary
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
                  </SortableDashboardSection>
                );
              }

              if (sectionId === "filing-comparison") {
                return (
                  <SortableDashboardSection key="filing-comparison" id="filing-comparison" headerLabel="Planning Comparison & Tracked GST/HST">
                    {/* 4. Comparison & Recommendations Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Comparison of claim methods */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-500" /> Comparison of Planning Methods
            </h3>
            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-450 bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Planning Only
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Compare actual operating costs with a per-kilometre estimate for planning. CRA allowance rates are not automatically a deduction method for self-employed workers. Confirm your eligible method, business-use ratio, and GST/HST treatment before filing. Income spanning multiple days is assigned to its start date in these reports.
          </p>

          <label className="block text-sm font-semibold" htmlFor="planning-method">Planning method</label>
          <select id="planning-method" value={planningMethod} onChange={event => setPlanningMethod(event.target.value as "actual" | "standard")} className="rounded border p-2 bg-white dark:bg-slate-900">
            <option value="actual">Actual vehicle expenses</option>
            <option value="standard">Per-kilometre comparison</option>
          </select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Standard Km Rate Column */}
            <div className={`p-4 rounded-xl border transition ${
              stats.planningMethod === "standard"
                ? "bg-blue-50/20 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-100/50 dark:ring-blue-900/30" 
                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">1. Per-Kilometre Planning Estimate</span>
                {stats.planningMethod === "standard" && (
                  <span className="text-[9px] font-black text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                    SELECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Per-kilometre comparison using your configured annual rates; eligibility is not determined here.</p>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-100/50 dark:border-slate-800/50 pb-1">
                  <span className="text-slate-500 dark:text-slate-400">Distance Tracked:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{stats.mileageKm.toLocaleString()} km</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 dark:border-slate-800/50 pb-1">
                  <span className="text-slate-500 dark:text-slate-400">CRA Rate (approx):</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">Configured annual rates</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Total Deduction:</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(stats.mileageDeduction)}</span>
                </div>
              </div>
            </div>

            {/* Actual Operating Costs Column */}
            <div className={`p-4 rounded-xl border transition ${
              stats.planningMethod === "actual"
                ? "bg-blue-50/20 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-100/50 dark:ring-blue-900/30" 
                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">2. Actual Receipts Method</span>
                {stats.planningMethod === "actual" && (
                  <span className="text-[9px] font-black text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                    SELECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Operating costs multiplied by vehicle business use ratio.</p>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-100/50 dark:border-slate-800/50 pb-1">
                  <span className="text-slate-500 dark:text-slate-400">Gross Operating Costs:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{formatCurrency(stats.totalActualExpenses)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100/50 dark:border-slate-800/50 pb-1">
                  <span className="text-slate-500 dark:text-slate-400">Business Ratio:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{businessUsePercentage}%</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Planning Expense Estimate:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-450 font-mono">{formatCurrency(stats.deductibleActualExpenses)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Expert Tip box */}
          <div className="bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/40 p-3.5 rounded-xl text-left flex gap-2.5 items-start">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-emerald-950 dark:text-emerald-300">Choose an Eligible Method</p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-450 leading-normal">
                Your selection changes the planning totals. A higher estimate does not establish an allowable deduction. Retain receipts and mileage logs, and verify eligibility with current CRA guidance or a qualified tax professional.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: GST/HST Input Tax Credits (ITC) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 lg:col-span-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Tracked GST/HST
              </h3>
            </div>

            {/* ITC Stat display */}
            <div className="bg-blue-50/20 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl text-center space-y-1">
              <p className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Recoverable GST/HST Paid</p>
              <p className="text-3xl font-black text-blue-600 dark:text-blue-450 font-mono">{formatCurrency(stats.gstHstTotal)}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1.5">Claimable Input Tax Credits (ITCs) for active period</p>
            </div>

            <div className="space-y-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <p>
                Rideshare and delivery drivers in Canada are required to track or pay GST/HST. 
              </p>
              <p>
                By tracking the GST/HST included in fuel, repairs, and maintenance, you can claim <strong>Input Tax Credits (ITCs)</strong> on your Form GST34 to directly reduce your net sales tax payable.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 rounded-lg text-[10px] text-slate-400 dark:text-slate-500 flex items-start gap-1.5 leading-normal">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>Eligible ITCs will be deducted dollar-for-dollar from the GST/HST sales tax you owe to the CRA.</span>
          </div>
        </div>
      </div>
                  </SortableDashboardSection>
                );
              }

              if (sectionId === "itemized-ledger") {
                return (
                  <SortableDashboardSection key="itemized-ledger" id="itemized-ledger" headerLabel="Statement Supporting Ledger">
                    {/* 5. Itemized Ledger Checklist */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-400" /> Statement Supporting Ledger ({filteredData.entries.length} Shifts, {filteredData.expenses.length} Expenses)
        </h3>

        {filteredData.entries.length === 0 && filteredData.expenses.length === 0 ? (
          <div className="text-center p-8 text-slate-400 dark:text-slate-500 text-xs">
            No records match the active filters. Go to other tabs to log income or expenses.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="py-2.5 px-3">Date / Week</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description / Details</th>
                  <th className="py-2.5 px-3 text-right">Income</th>
                  <th className="py-2.5 px-3 text-right">Expenses</th>
                  <th className="py-2.5 px-3 text-right">Tracked Tax portion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {/* 1. Income Entries */}
                {filteredData.entries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/40">
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(item.startDate)}</td>
                    <td className="py-2.5 px-3"><span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-1.5 py-0.5 rounded">INCOME</span></td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans font-bold">Weekly platform payouts ({item.trips} trips, {item.onlineMinutes}m online)</td>
                    <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200 font-bold">{formatCurrency(item.netFare + item.tips)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 dark:text-slate-700">—</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 dark:text-slate-700">—</td>
                  </tr>
                ))}

                {/* 2. Mileage standard deduction row as totalizer */}
                {filteredData.mileage.length > 0 && (
                  <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-850/40">
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">Period Total</td>
                    <td className="py-2.5 px-3"><span className="text-[10px] font-bold text-blue-600 dark:text-blue-450 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 px-1.5 py-0.5 rounded">MILEAGE</span></td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans font-bold">Standard rate deduction claim for {stats.mileageKm.toLocaleString()} km ({filteredData.mileage.length} trips)</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 dark:text-slate-700">—</td>
                    <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">{formatCurrency(stats.mileageDeduction)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 dark:text-slate-700">—</td>
                  </tr>
                )}

                {/* 3. Expenses */}
                {filteredData.expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/40">
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(item.date)}</td>
                    <td className="py-2.5 px-3"><span className="text-[10px] font-bold text-amber-600 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-1.5 py-0.5 rounded">EXPENSE</span></td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans font-bold">{item.description} ({item.category})</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 dark:text-slate-700">—</td>
                    <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200 font-bold">{formatCurrency(item.amount)}</td>
                    <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-bold">{item.gstHstEligible ? formatCurrency(item.gstHstAmount || 0) : "Exempt"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
                  </SortableDashboardSection>
                );
              }

              return null;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
