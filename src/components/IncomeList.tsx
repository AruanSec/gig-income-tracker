import { addMoney } from "../money";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, Trash2, Edit2, Search, SlidersHorizontal, ChevronLeft, ChevronRight, LayoutGrid, Table, X, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { IncomeEntry } from "../types";
import { formatCurrency, formatDuration, formatDateRange } from "../utils";

interface IncomeListProps {
  entries: IncomeEntry[];
  onEdit: (entry: IncomeEntry) => void;
  onDelete: (id: string) => void;
}

type SortField = "date" | "earnings" | "trips" | "netFare" | "tips";
type SortOrder = "asc" | "desc";

export default function IncomeList({ entries, onEdit, onDelete }: IncomeListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    return (localStorage.getItem("incomeViewMode") as "cards" | "table") || "cards";
  });

  // Handler for sorting toggles
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400 font-bold" />
    );
  };

  // Filter and sort logical execution
  const filteredEntries = entries
    .filter((entry) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.trim().toLowerCase();
      const matchesNotes = entry.notes?.toLowerCase().includes(term) ?? false;
      const matchesStart = entry.startDate.toLowerCase().includes(term);
      const matchesEnd = entry.endDate.toLowerCase().includes(term);
      const matchesEarnings =
        `$${entry.totalEarnings}`.toLowerCase().includes(term) ||
        entry.totalEarnings.toString().includes(term) ||
        `$${entry.netFare}`.toLowerCase().includes(term) ||
        entry.netFare.toString().includes(term) ||
        `$${entry.tips}`.toLowerCase().includes(term) ||
        entry.tips.toString().includes(term);
      const matchesTrips = `${entry.trips}`.includes(term) || `${entry.trips} trips`.toLowerCase().includes(term);
      return matchesNotes || matchesStart || matchesEnd || matchesEarnings || matchesTrips;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = a.startDate.localeCompare(b.startDate);
      } else if (sortField === "earnings") {
        comparison = a.totalEarnings - b.totalEarnings;
      } else if (sortField === "trips") {
        comparison = a.trips - b.trips;
      } else if (sortField === "netFare") {
        comparison = a.netFare - b.netFare;
      } else if (sortField === "tips") {
        comparison = a.tips - b.tips;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSortField("date");
    setSortOrder("desc");
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" id="income-list-card">
      
      {/* Controls: Search & Sorting Options */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-600 rounded-full inline-block"></span>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Filter & Sort Weekly Shifts
            </h4>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-150 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => {
                  setViewMode("cards");
                  localStorage.setItem("incomeViewMode", "cards");
                }}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                }`}
                title="Detailed Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("table");
                  localStorage.setItem("incomeViewMode", "table");
                }}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                }`}
                title="Condensed Table View"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {searchTerm && (
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          {/* Search input for Provider Name or Notes */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              id="income-search-input"
              placeholder="Search income by date, amount ($), trips, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition shadow-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                title="Clear search filter"
                id="clear-income-search-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile/Compact sorting selector */}
          <div className="flex bg-slate-150 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => handleSort("date")}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 transition cursor-pointer ${
                sortField === "date" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Date {sortField === "date" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              onClick={() => handleSort("earnings")}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 transition cursor-pointer ${
                sortField === "earnings" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Earnings {sortField === "earnings" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
            <button
              onClick={() => handleSort("trips")}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 transition cursor-pointer ${
                sortField === "trips" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Trips {sortField === "trips" && (sortOrder === "asc" ? "↑" : "↓")}
            </button>
          </div>
        </div>

        {/* Quick provider / note search chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter by:
          </span>
          {["Uber", "Lyft", "DoorDash", "Surge", "Airport"].map((chip) => {
            const active = searchTerm.toLowerCase() === chip.toLowerCase();
            return (
              <button
                key={chip}
                onClick={() => setSearchTerm(active ? "" : chip)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Headers (Visible on Desktop, only when in cards mode) */}
      {viewMode === "cards" && (
        <div className="hidden md:grid md:grid-cols-12 gap-2 px-6 py-3.5 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
          <div className="col-span-3">Date Period</div>
          <div className="col-span-1 text-center">Trips</div>
          <div className="col-span-2">Durations</div>
          <div className="col-span-3">Financials</div>
          <div className="col-span-2 text-right">Net Total</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
      )}

      {/* List content */}
      <div className={viewMode === "cards" ? "divide-y divide-slate-100 dark:divide-slate-800" : "p-4 overflow-x-auto w-full"} id="entries-list">
        <AnimatePresence initial={false}>
          {paginatedEntries.length > 0 ? (
            viewMode === "cards" ? (
              paginatedEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-5 md:px-6 md:py-4 border-l-4 border-l-transparent hover:border-l-blue-600 dark:hover:border-l-blue-500 hover:bg-slate-50/90 dark:hover:bg-slate-800/90 transition-all duration-150 flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 group"
                >
                  {/* Date column */}
                  <div className="col-span-3 flex items-start md:items-center gap-2.5">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 shrink-0 border border-slate-100 dark:border-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatDateRange(entry.startDate, entry.endDate)}
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-slate-450 dark:text-slate-400 line-clamp-1 mt-0.5 max-w-xs italic">
                          "{entry.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Trips column */}
                  <div className="col-span-1 flex md:justify-center items-center gap-2 md:gap-0">
                    <span className="text-xs text-slate-400 dark:text-slate-500 md:hidden font-medium">Trips:</span>
                    <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-700">
                      {entry.trips}
                    </span>
                  </div>

                  {/* Durations column */}
                  <div className="col-span-2 flex flex-row md:flex-col gap-x-4 gap-y-0.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase w-12 md:w-auto">Online:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{formatDuration(entry.onlineMinutes)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase w-12 md:w-auto">Active:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formatDuration(entry.activeMinutes)}</span>
                    </div>
                  </div>

                  {/* Financials details breakdown column */}
                  <div className="col-span-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Fare: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(entry.netFare)}</span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Tips: <span className="font-bold">{formatCurrency(entry.tips)}</span>
                    </span>
                    {entry.taxes > 0 && (
                      <span className="text-rose-600 dark:text-rose-450">
                        Taxes: <span className="font-semibold">-{formatCurrency(entry.taxes)}</span>
                      </span>
                    )}
                  </div>

                  {/* Net Total Earnings Column */}
                  <div className="col-span-2 flex justify-between md:block items-center border-t md:border-none pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-400 dark:text-slate-500 md:hidden font-medium">Net Earnings:</span>
                    <div className="text-right">
                      <span className="text-sm md:text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
                        {formatCurrency(entry.totalEarnings)}
                      </span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 hidden md:block">
                        {((entry.netFare + entry.tips) > 0 ? (entry.tips / (entry.netFare + entry.tips) * 100) : 0).toFixed(0)}% tips ratio
                      </p>
                    </div>
                  </div>

                  {/* Action buttons column */}
                  <div className="col-span-1 flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-none border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => onEdit(entry)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Edit shift entry"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Delete shift entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800" id="income-spreadsheet-table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Date"
                        id="sort-income-date-btn"
                      >
                        <span>Date Period</span>
                        {renderSortIcon("date")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-center">
                      <button
                        onClick={() => handleSort("trips")}
                        className="flex items-center justify-center gap-1.5 mx-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Trips"
                        id="sort-income-trips-btn"
                      >
                        <span>Trips</span>
                        {renderSortIcon("trips")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">Online Time</th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">Active Time</th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">
                      <button
                        onClick={() => handleSort("netFare")}
                        className="flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Fare"
                        id="sort-income-fare-btn"
                      >
                        <span>Fare</span>
                        {renderSortIcon("netFare")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">
                      <button
                        onClick={() => handleSort("tips")}
                        className="flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Tips"
                        id="sort-income-tips-btn"
                      >
                        <span>Tips</span>
                        {renderSortIcon("tips")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">Taxes</th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">
                      <button
                        onClick={() => handleSort("earnings")}
                        className="flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Net Total Amount"
                        id="sort-income-earnings-btn"
                      >
                        <span>Net Total</span>
                        {renderSortIcon("earnings")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-mono text-xs">
                  {paginatedEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 hover:text-slate-900 dark:hover:text-white transition-colors duration-150">
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                        {formatDateRange(entry.startDate, entry.endDate)}
                        {entry.notes && (
                          <span className="block text-[10px] text-slate-450 dark:text-slate-500 font-normal italic line-clamp-1 mt-0.5">
                            "{entry.notes}"
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-center text-slate-800 dark:text-slate-200">
                        {entry.trips}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-slate-600 dark:text-slate-400">
                        {formatDuration(entry.onlineMinutes)}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-slate-800 dark:text-slate-200">
                        {formatDuration(entry.activeMinutes)}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(entry.netFare)}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(entry.tips)}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-rose-600 dark:text-rose-450">
                        {entry.taxes > 0 ? `-${formatCurrency(entry.taxes)}` : "$0.00"}
                      </td>
                      <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-blue-600 dark:text-blue-400 font-bold bg-blue-50/20 dark:bg-blue-950/10">
                        {formatCurrency(entry.totalEarnings)}
                      </td>
                      <td className="px-3.5 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEdit(entry)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-150 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Edit shift entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(entry.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                            title="Delete shift entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-full text-slate-400 mb-3">
                <Search className="w-6 h-6 text-slate-350 dark:text-slate-500" />
              </div>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-white">No shift logs found</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {searchTerm
                  ? "Try adjusting your search queries."
                  : "Start logging your weekly income by clicking 'Log Weekly Income'."}
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* List summary totals footer */}
      {filteredEntries.length > 0 && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-4 w-full md:w-auto">
            <p className="text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-700 dark:text-slate-300">
                {Math.min(filteredEntries.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredEntries.length, currentPage * itemsPerPage)}
              </span> of <span className="font-bold text-slate-700 dark:text-slate-300">{filteredEntries.length}</span> records
            </p>
            
            {/* Pagination Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 mt-2 sm:mt-0" id="income-pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-450 px-1">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200 font-medium shrink-0">
            <span>Aggregated Period Earnings:</span>
            <span className="font-bold text-sm text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg font-mono shadow-xs">
              {formatCurrency(filteredEntries.reduce((sum, e) => addMoney(sum, e.totalEarnings), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
