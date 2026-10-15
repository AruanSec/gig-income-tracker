import { addMoney, subtractMoney } from "../money";
import { localDateString } from "../utils";
import { useFormSubmission } from "../hooks/useFormSubmission";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X, Calculator, Calendar, Landmark, Clock, Car } from "lucide-react";
import { IncomeEntry } from "../types";

interface IncomeFormProps {
  entryToEdit: IncomeEntry | null;
  onSave: (entry: Omit<IncomeEntry, "id"> & { id?: string }) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  startDate?: string;
  endDate?: string;
  trips?: string;
  onlineMinutes?: string;
  activeMinutes?: string;
  netFare?: string;
  tips?: string;
  taxes?: string;
  [key: string]: string | undefined;
}

export default function IncomeForm({ entryToEdit, onSave, onCancel }: IncomeFormProps) {
  const { submit, isSaving, saveError } = useFormSubmission(onSave);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [trips, setTrips] = useState("");
  const [onlineMinutes, setOnlineMinutes] = useState("");
  const [activeMinutes, setActiveMinutes] = useState("");
  const [netFare, setNetFare] = useState("");
  const [tips, setTips] = useState("");
  const [taxes, setTaxes] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Live calculation of earnings
  const numNetFare = Number.isFinite(parseFloat(netFare)) ? parseFloat(netFare) : 0;
  const numTips = Number.isFinite(parseFloat(tips)) ? parseFloat(tips) : 0;
  const numTaxes = Number.isFinite(parseFloat(taxes)) ? parseFloat(taxes) : 0;
  const computedTotalEarnings = subtractMoney(addMoney(numNetFare, numTips), numTaxes);

  // Initialize fields if editing
  useEffect(() => {
    if (entryToEdit) {
      setStartDate(entryToEdit.startDate);
      setEndDate(entryToEdit.endDate);
      setTrips(entryToEdit.trips.toString());
      setOnlineMinutes(entryToEdit.onlineMinutes.toString());
      setActiveMinutes(entryToEdit.activeMinutes.toString());
      setNetFare(entryToEdit.netFare.toString());
      setTips(entryToEdit.tips.toString());
      setTaxes(entryToEdit.taxes.toString());
      setNotes(entryToEdit.notes || "");
    } else {
      // Default dates to today's local date
      const today = localDateString();
      setStartDate(today);
      setEndDate(today);
      setTrips("");
      setOnlineMinutes("");
      setActiveMinutes("");
      setNetFare("");
      setTips("");
      setTaxes("");
      setNotes("");
    }
    setErrors({});
    setTouched({});
    setIsSubmitted(false);
  }, [entryToEdit]);

  // Real-time validation
  useEffect(() => {
    const newErrors: FormErrors = {};

    // Date validations
    if (!startDate) newErrors.startDate = "Start date is required";
    if (!endDate) newErrors.endDate = "End date is required";
    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = "End date cannot be earlier than start date";
    }

    // Trips validations
    const tripsVal = parseInt(trips, 10);
    if (trips === "") {
      newErrors.trips = "Trips count is required";
    } else if (isNaN(tripsVal)) {
      newErrors.trips = "Please enter a valid number";
    } else if (tripsVal < 0) {
      newErrors.trips = "Trips cannot be negative";
    }

    // Duration validations
    const onlineVal = parseInt(onlineMinutes, 10);
    if (onlineMinutes === "") {
      newErrors.onlineMinutes = "Online minutes are required";
    } else if (isNaN(onlineVal)) {
      newErrors.onlineMinutes = "Please enter a valid number";
    } else if (onlineVal < 0) {
      newErrors.onlineMinutes = "Online minutes cannot be negative";
    }

    const activeVal = parseInt(activeMinutes, 10);
    if (activeMinutes === "") {
      newErrors.activeMinutes = "Active minutes are required";
    } else if (isNaN(activeVal)) {
      newErrors.activeMinutes = "Please enter a valid number";
    } else if (activeVal < 0) {
      newErrors.activeMinutes = "Active minutes cannot be negative";
    }

    if (!isNaN(onlineVal) && !isNaN(activeVal) && activeVal > onlineVal) {
      newErrors.activeMinutes = "Active minutes cannot exceed online minutes";
    }

    // Financial validations
    const fNetFare = parseFloat(netFare);
    if (netFare === "") {
      newErrors.netFare = "Net fare is required";
    } else if (isNaN(fNetFare)) {
      newErrors.netFare = "Please enter a valid number";
    } else if (fNetFare < 0) {
      newErrors.netFare = "Net fare cannot be negative";
    }

    const fTips = parseFloat(tips);
    if (tips === "") {
      newErrors.tips = "Tips field is required";
    } else if (isNaN(fTips)) {
      newErrors.tips = "Please enter a valid number";
    } else if (fTips < 0) {
      newErrors.tips = "Tips cannot be negative";
    }

    const fTaxes = parseFloat(taxes);
    if (taxes === "") {
      newErrors.taxes = "Taxes field is required";
    } else if (isNaN(fTaxes)) {
      newErrors.taxes = "Please enter a valid number";
    } else if (fTaxes < 0) {
      newErrors.taxes = "Taxes cannot be negative";
    }

    setErrors(newErrors);
  }, [startDate, endDate, trips, onlineMinutes, activeMinutes, netFare, tips, taxes]);

  // Synchronize end date with start date if end date is empty or prior
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    markTouched("startDate");
    if (!endDate || endDate < val) {
      setEndDate(val);
      markTouched("endDate");
    }
  };

  const markTouched = (field: string) => {
    setTouched(prev => prev[field] ? prev : { ...prev, [field]: true });
  };

  const showError = (field: keyof FormErrors) => {
    return !!(errors[field] && (touched[field as string] || isSubmitted));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    // Run field marks for touched so error styles light up on submission
    const allFields = ["startDate", "endDate", "trips", "onlineMinutes", "activeMinutes", "netFare", "tips", "taxes"];
    const nextTouched: Record<string, boolean> = {};
    allFields.forEach(f => {
      nextTouched[f] = true;
    });
    setTouched(nextTouched);

    if (Object.keys(errors).length > 0) return;

    void submit({
      id: entryToEdit?.id,
      startDate,
      endDate,
      trips: parseInt(trips, 10),
      onlineMinutes: parseInt(onlineMinutes, 10),
      activeMinutes: parseInt(activeMinutes, 10),
      netFare: numNetFare,
      tips: numTips,
      taxes: numTaxes,
      totalEarnings: computedTotalEarnings,
      notes: notes.trim() || undefined,
    });
  };

  // Keyboard shortcut listener for saving the form (Ctrl+S)
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmitRef.current(e as any);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        id="income-form-container"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100" id="form-title">
              {entryToEdit ? "Edit Weekly Income Period" : "Log Weekly Income Period"}
            </h3>
          </div>
          <button
            onClick={onCancel}
              disabled={isSaving}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
            id="close-form-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <fieldset disabled={isSaving} className="contents" aria-busy={isSaving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Dates */}
            <div className="space-y-4 md:col-span-2 bg-slate-50/50 dark:bg-slate-850/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Date & Time Period
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="startDate" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    onBlur={() => markTouched("startDate")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition [color-scheme:dark] ${
                      showError("startDate") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("startDate") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.startDate}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="endDate" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); markTouched("endDate"); }}
                    onBlur={() => markTouched("endDate")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition [color-scheme:dark] ${
                      showError("endDate") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("endDate") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.endDate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Performance metrics (Trips & Hours) */}
            <div className="space-y-4 bg-slate-50/50 dark:bg-slate-850/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Metrics & Times
              </span>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="trips" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Completed Trips
                  </label>
                  <input
                    type="number"
                    id="trips"
                    min="0"
                    step="1"
                    placeholder="e.g., 12"
                    value={trips}
                    onChange={(e) => { setTrips(e.target.value); markTouched("trips"); }}
                    onBlur={() => markTouched("trips")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      showError("trips") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("trips") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.trips}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="onlineMinutes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Online Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    id="onlineMinutes"
                    min="0"
                    step="1"
                    placeholder="e.g., 480"
                    value={onlineMinutes}
                    onChange={(e) => { setOnlineMinutes(e.target.value); markTouched("onlineMinutes"); }}
                    onBlur={() => markTouched("onlineMinutes")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      showError("onlineMinutes") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {onlineMinutes && !isNaN(parseInt(onlineMinutes)) && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      ≈ {(parseInt(onlineMinutes) / 60).toFixed(1)} hours online
                    </p>
                  )}
                  {showError("onlineMinutes") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.onlineMinutes}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="activeMinutes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Active Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    id="activeMinutes"
                    min="0"
                    step="1"
                    placeholder="e.g., 320"
                    value={activeMinutes}
                    onChange={(e) => { setActiveMinutes(e.target.value); markTouched("activeMinutes"); }}
                    onBlur={() => markTouched("activeMinutes")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      showError("activeMinutes") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {activeMinutes && !isNaN(parseInt(activeMinutes)) && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      ≈ {(parseInt(activeMinutes) / 60).toFixed(1)} hours active
                    </p>
                  )}
                  {showError("activeMinutes") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.activeMinutes}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Financials (Net Fare, Tips, Taxes) */}
            <div className="space-y-4 bg-slate-50/50 dark:bg-slate-850/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Financial breakdown
              </span>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="netFare" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Net Fare ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-slate-400 dark:text-slate-550">$</span>
                    <input
                      type="number"
                      id="netFare"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={netFare}
                      onChange={(e) => { setNetFare(e.target.value); markTouched("netFare"); }}
                      onBlur={() => markTouched("netFare")}
                      className={`w-full pl-7 pr-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                        showError("netFare") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                      }`}
                    />
                  </div>
                  {showError("netFare") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.netFare}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="tips" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tips ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-slate-400 dark:text-slate-550">$</span>
                    <input
                      type="number"
                      id="tips"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={tips}
                      onChange={(e) => { setTips(e.target.value); markTouched("tips"); }}
                      onBlur={() => markTouched("tips")}
                      className={`w-full pl-7 pr-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                        showError("tips") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                      }`}
                    />
                  </div>
                  {showError("tips") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.tips}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="taxes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Taxes / Deductions ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-slate-400 dark:text-slate-550">$</span>
                    <input
                      type="number"
                      id="taxes"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={taxes}
                      onChange={(e) => { setTaxes(e.target.value); markTouched("taxes"); }}
                      onBlur={() => markTouched("taxes")}
                      className={`w-full pl-7 pr-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                        showError("taxes") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                      }`}
                    />
                  </div>
                  {showError("taxes") && (
                    <p className="text-xs text-red-500 font-medium mt-0.5">{errors.taxes}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="notes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Notes / Shift Description (Optional)
              </label>
              <textarea
                id="notes"
                placeholder="Friday night surges, bad weather, or client feedback..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition resize-none"
              />
            </div>
          </div>

          {/* Real-time Earnings Calculation Summary Banner */}
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                <Calculator className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider">
                  Auto-Calculated Net Total
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Fare (${numNetFare.toFixed(2)}) + Tips (${numTips.toFixed(2)}) - Taxes (${numTaxes.toFixed(2)})
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold tracking-tight text-white font-mono">
                ${computedTotalEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{saveError}</p>}
          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 transition cursor-pointer"
              id="cancel-form-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 border border-blue-700 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition shadow-md shadow-blue-100 dark:shadow-none cursor-pointer"
              id="submit-form-btn"
            >
              {isSaving ? "Saving…" : entryToEdit ? "Save Changes" : "Log Shift"}
            </button>
          </div>
          </fieldset>
        </form>
      </motion.div>
    </div>
  );
}
