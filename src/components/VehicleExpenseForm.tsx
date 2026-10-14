import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X, Calendar, DollarSign, FileText, AlertCircle, Wrench } from "lucide-react";
import { VehicleExpense } from "../types";

interface VehicleExpenseFormProps {
  entryToEdit: VehicleExpense | null;
  onSave: (expense: Omit<VehicleExpense, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

const EXPENSE_CATEGORIES = [
  "Fuel",
  "Insurance",
  "Maintenance",
  "Repairs",
  "Oil Change",
  "Tires",
  "Cleaning/Detailing",
  "Parking/Tolls",
  "License/Registration",
  "Other"
];

export default function VehicleExpenseForm({ entryToEdit, onSave, onCancel }: VehicleExpenseFormProps) {
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Fuel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [gstHstEligible, setGstHstEligible] = useState(true);
  const [gstHstAmount, setGstHstAmount] = useState("");

  const [errors, setErrors] = useState<{
    date?: string;
    amount?: string;
    description?: string;
    gstHstAmount?: string;
  }>({});

  // Initialize fields if editing
  useEffect(() => {
    if (entryToEdit) {
      setDate(entryToEdit.date);
      setCategory(entryToEdit.category);
      setAmount(entryToEdit.amount.toString());
      setDescription(entryToEdit.description);
      setGstHstEligible(entryToEdit.gstHstEligible !== false); // default to true
      setGstHstAmount(entryToEdit.gstHstAmount !== undefined ? entryToEdit.gstHstAmount.toString() : "");
    } else {
      // Default to today's date
      const today = new Date().toISOString().split("T")[0];
      setDate(today);
      setGstHstEligible(true);
      setGstHstAmount("");
    }
  }, [entryToEdit]);

  // Handler to estimate tax based on provincial rates
  const handleEstimateTax = (rate: number) => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      // Pre-tax amount calculation: total / (1 + rate) -> tax = total - pre-tax
      const calculatedTax = numAmount - (numAmount / (1 + rate));
      setGstHstAmount(calculatedTax.toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!date) newErrors.date = "Please select a date.";
    
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = "Please enter a valid amount greater than $0.";
    }

    let parsedGstHst = 0;
    if (gstHstEligible) {
      parsedGstHst = parseFloat(gstHstAmount);
      if (gstHstAmount && (isNaN(parsedGstHst) || parsedGstHst < 0)) {
        newErrors.gstHstAmount = "Please enter a valid tax amount.";
      } else if (parsedGstHst > numAmount) {
        newErrors.gstHstAmount = "Tax cannot be greater than total expense.";
      }
    }

    if (!description.trim()) {
      newErrors.description = "Please provide a brief description.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      id: entryToEdit?.id,
      date,
      category,
      amount: numAmount,
      description: description.trim(),
      gstHstEligible,
      gstHstAmount: gstHstEligible ? (gstHstAmount ? parsedGstHst : 0) : 0,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        id="vehicle-expense-form"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 dark:bg-slate-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100" id="expense-form-title">
              {entryToEdit ? "Edit Vehicle Expense" : "Log Vehicle Expense"}
            </h3>
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
            id="close-expense-form-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* Date of Expense */}
          <div className="space-y-1">
            <label htmlFor="expense-date" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date of Expense
            </label>
            <input
              type="date"
              id="expense-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 dark:text-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition [color-scheme:dark] ${
                errors.date ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-800"
              }`}
            />
            {errors.date && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
                <AlertCircle className="w-3 h-3" /> {errors.date}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category selection */}
            <div className="space-y-1">
              <label htmlFor="expense-category" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Expense Category
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 dark:text-white border border-slate-250 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition cursor-pointer"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="dark:bg-slate-900 dark:text-white">
                    {cat}
                  </option>
                ))}
                {category && !EXPENSE_CATEGORIES.includes(category) && (
                  <option value={category} className="dark:bg-slate-900 dark:text-white">
                    {category}
                  </option>
                )}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label htmlFor="expense-amount" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Expense Amount ($)
              </label>
              <input
                type="number"
                id="expense-amount"
                min="0.01"
                step="0.01"
                placeholder="e.g., 89.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 dark:text-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                  errors.amount ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-800"
                }`}
              />
              {errors.amount && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3" /> {errors.amount}
                </p>
              )}
            </div>
          </div>

          {/* GST/HST Tracking Section */}
          <div className="p-3.5 bg-blue-50/20 dark:bg-blue-950/20 rounded-xl border border-blue-100/50 dark:border-blue-900/40 space-y-3" id="gst-hst-tracking-box">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstHstEligible}
                  onChange={(e) => setGstHstEligible(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  id="expense-gst-eligible-chk"
                />
                Track GST/HST on this expense
              </label>
              <span className="text-[9px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Input Tax Credit (ITC)
              </span>
            </div>

            {gstHstEligible && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1" id="gst-hst-subform">
                <div className="space-y-1">
                  <label htmlFor="expense-gst" className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    GST/HST Portion ($)
                  </label>
                  <input
                    type="number"
                    id="expense-gst"
                    min="0"
                    step="0.01"
                    placeholder="e.g., 10.30"
                    value={gstHstAmount}
                    onChange={(e) => setGstHstAmount(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 dark:text-white border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      errors.gstHstAmount ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-800"
                    }`}
                  />
                  {errors.gstHstAmount && (
                    <p className="text-[10px] text-red-500 font-medium mt-0.5">
                      {errors.gstHstAmount}
                    </p>
                  )}
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Estimate Taxes (from total):</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEstimateTax(0.13)}
                      className="flex-1 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                      title="Calculate 13% Ontario HST included in total"
                    >
                      13% HST (ON)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEstimateTax(0.05)}
                      className="flex-1 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                      title="Calculate 5% Federal GST included in total"
                    >
                      5% GST (CA)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor="expense-description" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Description & Receipt Notes
            </label>
            <textarea
              id="expense-description"
              placeholder="e.g., Synthetic oil change, tire rotation at mechanics"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 dark:text-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                errors.description ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-800"
              }`}
            />
            {errors.description && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
                <AlertCircle className="w-3 h-3" /> {errors.description}
              </p>
            )}
          </div>

          {/* Warning notice */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-normal flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400 dark:text-slate-550 shrink-0 mt-0.5" />
            <span>
              Always retain your receipts for tax purposes. Under Canada Revenue Agency rules, actual vehicle expenses may require a logbook showing total km driven vs. business km driven to calculate the deductible ratio.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition cursor-pointer"
              id="cancel-expense-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 border border-blue-700 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition shadow-md shadow-blue-100 dark:shadow-none cursor-pointer"
              id="submit-expense-btn"
            >
              {entryToEdit ? "Save Changes" : "Log Expense"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
