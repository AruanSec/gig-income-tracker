import React, { useState, useMemo, useEffect } from "react";
import { Search, MapPin, Edit, Trash2, Shield, ArrowRight, Route, Coins, FileText, ChevronLeft, ChevronRight, LayoutGrid, Table, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { MileageEntry, CraRate } from "../types";
import { formatDate, formatCurrency, calculateTripDeductions } from "../utils";

interface MileageListProps {
  entries: MileageEntry[];
  allEntries?: MileageEntry[];
  onEdit: (entry: MileageEntry) => void;
  onDelete: (id: string) => void;
  craRates?: CraRate[];
}

type MileageSortField = "date" | "distance" | "deduction" | "purpose" | "tripType";
type SortOrder = "asc" | "desc";

export default function MileageList({ entries, allEntries = entries, onEdit, onDelete, craRates }: MileageListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<MileageSortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    return (localStorage.getItem("mileageViewMode") as "cards" | "table") || "cards";
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const handleSort = (field: MileageSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const renderSortIcon = (field: MileageSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400 font-bold" />
    );
  };

  // Compute precise chronological deductions (need all entries to calculate split thresholds correctly)
  const deductionsMap = useMemo(() => {
    return calculateTripDeductions(allEntries, craRates);
  }, [allEntries, craRates]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.trim().toLowerCase();

        const matchPurpose = entry.purpose.toLowerCase().includes(term);
        const matchTripType = entry.tripType.toLowerCase().includes(term);
        const matchNotes = entry.notes ? entry.notes.toLowerCase().includes(term) : false;
        const matchDate = entry.date.toLowerCase().includes(term);
        const matchKm = `${entry.distance}`.includes(term) || `${entry.distance} km`.toLowerCase().includes(term);
        
        const calc = deductionsMap[entry.id];
        const matchDeduction = calc ? (`$${calc.deduction.toFixed(2)}`.toLowerCase().includes(term) || calc.deduction.toString().includes(term)) : false;

        return matchPurpose || matchTripType || matchNotes || matchDate || matchKm || matchDeduction;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "date") {
          cmp = a.date.localeCompare(b.date);
        } else if (sortField === "distance") {
          cmp = a.distance - b.distance;
        } else if (sortField === "deduction") {
          const dedA = deductionsMap[a.id]?.deduction || 0;
          const dedB = deductionsMap[b.id]?.deduction || 0;
          cmp = dedA - dedB;
        } else if (sortField === "purpose") {
          cmp = a.purpose.localeCompare(b.purpose);
        } else if (sortField === "tripType") {
          cmp = a.tripType.localeCompare(b.tripType);
        }
        return sortOrder === "asc" ? cmp : -cmp;
      });
  }, [entries, searchTerm, deductionsMap, sortField, sortOrder]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;
  const paginatedEntries = useMemo(() => {
    return filteredEntries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredEntries, currentPage, itemsPerPage]);

  // Map category to styles
  const getCategoryStyles = (type: string) => {
    switch (type) {
      case "Ride-share":
        return "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50";
      case "Delivery":
        return "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-900/50";
      case "Client Meeting":
        return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-450 border-amber-100 dark:border-amber-900/50";
      case "Supplies Pick-up":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50";
      case "Courier Run":
        return "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400 border-pink-100 dark:border-pink-900/50";
      default:
        return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-700";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs h-full flex flex-col" id="mileage-list-card">
      
      {/* Search and Filters Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-900/50 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Mileage Logs & Deductions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chronologically ordered trip records</p>
          </div>
          
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-150 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => {
                  setViewMode("cards");
                  localStorage.setItem("mileageViewMode", "cards");
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
                  localStorage.setItem("mileageViewMode", "table");
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
                onClick={() => setSearchTerm("")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer text-left sm:text-right"
              >
                Reset search filter
              </button>
            )}
          </div>
        </div>

        <div className="max-w-md">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search trips by date, distance, purpose, or deduction ($)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition placeholder-slate-400 dark:placeholder-slate-500"
              id="mileage-search-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                title="Clear search filter"
                id="clear-mileage-search-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List Area */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center flex-1 flex flex-col items-center justify-center space-y-4" id="mileage-empty-state">
          <div className="p-4 bg-slate-50 dark:bg-slate-850 text-slate-400 dark:text-slate-500 rounded-full border border-slate-100 dark:border-slate-800">
            <MapPin className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {searchTerm ? "No trips found matching query" : "No business trips logged yet"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {searchTerm 
                ? "Try adjusting your search keywords or clear the filter."
                : "Record business travel and configure matching-year rates for kilometre planning estimates."
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {viewMode === "cards" ? (
            /* Cards Layout Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5 bg-slate-50/10 dark:bg-slate-900/50 overflow-y-auto" id="mileage-cards-grid">
              {paginatedEntries.map((entry) => {
                const tripCalc = deductionsMap[entry.id] || { tier1Distance: entry.distance, tier2Distance: 0, deduction: 0 };
                return (
                  <div
                    key={entry.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                    id={`mileage-card-${entry.id}`}
                  >
                    <div>
                      {/* Top row with Date, Category Tag, and Actions */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatDate(entry.date)}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${getCategoryStyles(entry.tripType)}`}>
                            {entry.tripType}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onEdit(entry)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                            title="Edit trip log"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(entry.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                            title="Delete trip log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Purpose */}
                      <div className="py-3">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">{entry.purpose}</h5>
                        {entry.notes && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed italic">
                            "{entry.notes}"
                          </p>
                        )}
                      </div>

                      {/* Readings & Distance */}
                      <div className="grid grid-cols-2 gap-3 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Odometer</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px] block mt-0.5">
                            {entry.startOdometer.toLocaleString()} → {entry.endOdometer.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Distance</span>
                          <span className="font-bold font-mono text-slate-800 dark:text-slate-200 text-[13px] block mt-0.5">
                            {entry.distance.toLocaleString()} km
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Deduction value */}
                    <div className="mt-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-lg p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">CRA Deduction</span>
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                          {deductionsMap[entry.id] ? formatCurrency(tripCalc.deduction) : "Rate needed"}
                        </span>
                      </div>
                      {tripCalc.tier2Distance > 0 && (
                        <div className="text-right">
                          <span className="text-[9px] text-amber-600 dark:text-amber-450 font-bold block bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/50">
                            Tier 2 Active
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Condensed Spreadsheet Table Layout */
            <div className="p-4 overflow-x-auto w-full">
              <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 text-xs" id="mileage-spreadsheet-table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Date"
                        id="sort-mileage-date-btn"
                      >
                        <span>Date</span>
                        {renderSortIcon("date")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => handleSort("purpose")}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Purpose"
                        id="sort-mileage-purpose-btn"
                      >
                        <span>Details & Purpose</span>
                        {renderSortIcon("purpose")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-center">
                      <button
                        onClick={() => handleSort("tripType")}
                        className="flex items-center justify-center gap-1.5 mx-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Category"
                        id="sort-mileage-category-btn"
                      >
                        <span>Category</span>
                        {renderSortIcon("tripType")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">Odometer Range</th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">
                      <button
                        onClick={() => handleSort("distance")}
                        className="flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Distance"
                        id="sort-mileage-distance-btn"
                      >
                        <span>Distance</span>
                        {renderSortIcon("distance")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 text-right">
                      <button
                        onClick={() => handleSort("deduction")}
                        className="flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-white transition cursor-pointer group"
                        title="Sort by Est. Deduction"
                        id="sort-mileage-deduction-btn"
                      >
                        <span>Est. Deduction</span>
                        {renderSortIcon("deduction")}
                      </button>
                    </th>
                    <th className="px-3.5 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-mono">
                  {paginatedEntries.map((entry) => {
                    const tripCalc = deductionsMap[entry.id] || { tier1Distance: entry.distance, tier2Distance: 0, deduction: 0 };
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-sans font-semibold whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 font-sans text-slate-800 dark:text-slate-200 max-w-xs">
                          <div className="font-bold line-clamp-1">{entry.purpose}</div>
                          {entry.notes && (
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal italic line-clamp-1 mt-0.5">
                              "{entry.notes}"
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-center font-sans whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${getCategoryStyles(entry.tripType)}`}>
                            {entry.tripType}
                          </span>
                        </td>
                        <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <span className="text-[11px]">{entry.startOdometer.toLocaleString()}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="text-[11px]">{entry.endOdometer.toLocaleString()}</span>
                        </td>
                        <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap">
                          {entry.distance.toLocaleString()} km
                        </td>
                        <td className="px-3.5 py-1.5 border-r border-slate-150 dark:border-slate-800 text-right text-emerald-600 dark:text-emerald-450 font-bold bg-emerald-50/10 dark:bg-emerald-950/5 whitespace-nowrap">
                          <div>{deductionsMap[entry.id] ? formatCurrency(tripCalc.deduction) : "Rate needed"}</div>
                          {tripCalc.tier2Distance > 0 && (
                            <div className="text-[8px] text-amber-600 dark:text-amber-450 font-bold">Tier 2 Active</div>
                          )}
                        </td>
                        <td className="px-3.5 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEdit(entry)}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                              title="Edit trip log"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDelete(entry.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                              title="Delete trip log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* List summary totals footer / Pagination */}
      {filteredEntries.length > 0 && (
        <div className="px-6 py-3.5 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-slate-700 dark:text-slate-300">
              {Math.min(filteredEntries.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredEntries.length, currentPage * itemsPerPage)}
            </span> of <span className="font-bold text-slate-700 dark:text-slate-300">{filteredEntries.length}</span> trips
          </p>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5" id="mileage-pagination">
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
      )}
      
      {/* Deductions Disclosure Notice */}
      <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-[10px] text-slate-500 dark:text-slate-450 font-medium">
          Deductions computed in compliance with CRA guidelines, resetting thresholds per calendar year based on configured rates.
        </span>
      </div>
    </div>
  );
}
