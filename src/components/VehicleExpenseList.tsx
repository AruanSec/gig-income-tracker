import { addMoney } from "../money";
import React, { useState, useMemo, useEffect } from "react";
import { Search, Wrench, Edit, Trash2, Shield, PlusCircle, Filter, ChevronLeft, ChevronRight, X } from "lucide-react";
import { VehicleExpense } from "../types";
import { formatDate, formatCurrency } from "../utils";

interface VehicleExpenseListProps {
  expenses: VehicleExpense[];
  onEdit: (expense: VehicleExpense) => void;
  onDelete: (id: string) => void;
  onAddTrigger: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Oil Change": "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40",
  "Tires": "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/40",
  "Insurance": "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/40",
  "Repairs": "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40",
  "Fuel": "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40",
  "Cleaning/Detailing": "bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/40",
  "Parking/Tolls": "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/40",
  "License/Registration": "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40",
  "Other": "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/40",
};

export default function VehicleExpenseList({ expenses, onEdit, onDelete, onAddTrigger }: VehicleExpenseListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Get list of distinct categories for filtering dropdown
  const uniqueCategories = useMemo(() => {
    const list = new Set<string>();
    expenses.forEach((e) => list.add(e.category));
    return ["All", ...Array.from(list)];
  }, [expenses]);

  // Filter expenses based on search, category filter, and date-range
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!searchTerm.trim()) {
          const matchCategory = selectedCategory === "All" || e.category === selectedCategory;
          const matchesStartDate = !startDateFilter || e.date >= startDateFilter;
          const matchesEndDate = !endDateFilter || e.date <= endDateFilter;
          return matchCategory && matchesStartDate && matchesEndDate;
        }

        const term = searchTerm.trim().toLowerCase();
        const matchSearch =
          e.description.toLowerCase().includes(term) ||
          e.category.toLowerCase().includes(term) ||
          e.date.toLowerCase().includes(term) ||
          `$${e.amount}`.toLowerCase().includes(term) ||
          e.amount.toString().includes(term);

        const matchCategory = selectedCategory === "All" || e.category === selectedCategory;
        const matchesStartDate = !startDateFilter || e.date >= startDateFilter;
        const matchesEndDate = !endDateFilter || e.date <= endDateFilter;
        return matchSearch && matchCategory && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  }, [expenses, searchTerm, selectedCategory, startDateFilter, endDateFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, startDateFilter, endDateFilter]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = useMemo(() => {
    return filteredExpenses.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredExpenses, currentPage, itemsPerPage]);

  // Group filtered expenses by month/year period (e.g. "June 2026")
  const monthlyPeriods = useMemo(() => {
    const groups: Record<string, { monthName: string; expenses: VehicleExpense[]; total: number }> = {};
    
    paginatedExpenses.forEach((exp) => {
      if (!exp.date) return;
      const [year, month] = exp.date.split("-");
      const dateObj = new Date(Number(year), Number(month) - 1, 15);
      const periodKey = `${year}-${month}`;
      const monthName = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      
      if (!groups[periodKey]) {
        groups[periodKey] = {
          monthName,
          expenses: [],
          total: 0,
        };
      }
      
      groups[periodKey].expenses.push(exp);
      groups[periodKey].total = addMoney(groups[periodKey].total, exp.amount);
    });

    // Sort periods descending by key
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => groups[key]);
  }, [paginatedExpenses]);

  // Overall stats
  const grandTotal = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => addMoney(acc, curr.amount), 0);
  }, [filteredExpenses]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs h-full flex flex-col" id="expense-list-card">
      
      {/* Search and Filters Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/40 space-y-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Car Maintenance & Vehicle Expenses</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Deductible operating costs grouped by monthly period</p>
          </div>

          <div className="flex items-center gap-3">
            {(searchTerm || selectedCategory !== "All" || startDateFilter || endDateFilter) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("All");
                  setStartDateFilter("");
                  setEndDateFilter("");
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}

            {/* Quick inline add button */}
            <button
              onClick={onAddTrigger}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg flex items-center gap-1 cursor-pointer transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search expenses by date, amount ($), or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition placeholder-slate-400 dark:placeholder-slate-500"
              id="expense-search-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                title="Clear search filter"
                id="clear-expense-search-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="relative flex items-center bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg px-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-1.5 pr-6 bg-transparent font-semibold text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat} className="dark:bg-slate-950 dark:text-white">
                  {cat === "All" ? "All Categories" : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date Filter */}
          <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg px-2.5 py-1 gap-2 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">From:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full text-xs bg-transparent dark:text-slate-100 border-none p-0 focus:ring-0 focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* End Date Filter */}
          <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg px-2.5 py-1 gap-2 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">To:</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full text-xs bg-transparent dark:text-slate-100 border-none p-0 focus:ring-0 focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Main List Area */}
      {expenses.length === 0 ? (
        <div className="p-12 text-center flex-1 flex flex-col items-center justify-center space-y-4" id="expense-empty-state">
          <div className="p-4 bg-slate-50 dark:bg-slate-850 text-slate-400 dark:text-slate-500 rounded-full border border-slate-100 dark:border-slate-800 animate-pulse">
            <Wrench className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No vehicle expenses logged yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Track actual car expenses such as fuel, commercial insurance, oil changes, tire replacements, or brake repairs. These can be logged alongside mileage for comprehensive tax planning.
            </p>
          </div>
          <button
            onClick={onAddTrigger}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition flex items-center gap-1 border border-blue-700 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Log Your First Expense</span>
          </button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="p-12 text-center flex-1 flex flex-col items-center justify-center space-y-2">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No expenses matches this filter</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Try clearing the category filter or search keywords.</p>
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("All");
            }}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-2"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px]">
          {monthlyPeriods.map((period) => (
            <div key={period.monthName} className="p-5 space-y-3.5 bg-slate-50/10">
              
              {/* Period Header Totalizer */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  {period.monthName}
                </span>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2">
                    Period Total:
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                    {formatCurrency(period.total)}
                  </span>
                </div>
              </div>

              {/* Expense List inside this month */}
              <div className="space-y-2.5">
                {period.expenses.map((exp) => (
                  <div 
                    key={exp.id} 
                    className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl p-3.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    id={`expense-row-${exp.id}`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Category & Date */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(exp.date)}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full border ${CATEGORY_COLORS[exp.category] || "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-700"}`}>
                          {exp.category}
                        </span>
                        {exp.gstHstEligible && exp.gstHstAmount !== undefined && exp.gstHstAmount > 0 && (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-450 border border-blue-100/50 dark:border-blue-900/40 flex items-center gap-1" title="GST/HST claimed for Input Tax Credit">
                            <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                            Tax: {formatCurrency(exp.gstHstAmount)}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-normal truncate sm:line-clamp-2 sm:whitespace-normal">
                        {exp.description}
                      </p>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50 dark:border-slate-800 shrink-0">
                      <div className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">
                        {formatCurrency(exp.amount)}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(exp)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition cursor-pointer"
                          title="Edit expense"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(exp.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grand summary footer for filtering */}
      {filteredExpenses.length > 0 && (
        <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="text-xs text-center sm:text-left">
              <span className="text-slate-400 font-medium">
                Showing {Math.min(filteredExpenses.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredExpenses.length, currentPage * itemsPerPage)} of {filteredExpenses.length} entries
              </span>
              {selectedCategory !== "All" && <span className="text-blue-400 font-semibold"> • filtered by {selectedCategory}</span>}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 bg-slate-850 p-0.5 rounded-lg border border-slate-800" id="expense-pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1 rounded text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-slate-800 transition cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold text-slate-400 px-1">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1 rounded text-slate-300 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-slate-800 transition cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto text-right shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Total:</span>
            <span className="text-base font-black font-mono text-blue-450">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      )}
      
      {/* Deductions Disclosure Notice */}
      <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
        <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span>
          Note: Under Canadian tax law, business write-offs can be calculated using either a simplified per-kilometre rate OR actual operating expense logs multiplied by business-use percentage.
        </span>
      </div>
    </div>
  );
}
