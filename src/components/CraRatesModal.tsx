import React, { useState, useEffect, useRef } from "react";
import { X, Plus, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { CraRate } from "../types";

interface CraRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: CraRate[];
  onSave: (newRates: CraRate) => Promise<void>;
}

export default function CraRatesModal({ isOpen, onClose, rates, onSave }: CraRatesModalProps) {
  const [editingYear, setEditingYear] = useState<string | null>(null);
  const [yearInput, setYearInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("");
  const [tier1RateInput, setTier1RateInput] = useState("");
  const [tier2RateInput, setTier2RateInput] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingYear(null);
    setYearInput("");
    setThresholdInput("");
    setTier1RateInput("");
    setTier2RateInput("");
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (rate: CraRate) => {
    setEditingYear(rate.year);
    setYearInput(rate.year);
    setThresholdInput(rate.tier1_threshold.toString());
    setTier1RateInput(rate.tier1_rate.toString());
    setTier2RateInput(rate.tier2_rate.toString());
    setError(null);
    setSuccess(null);
  };

  const handleAddNew = () => {
    setEditingYear("NEW_YEAR");
    setYearInput(new Date().getFullYear().toString());
    setThresholdInput("5000");
    setTier1RateInput("");
    setTier2RateInput("");
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validations
    const yr = yearInput.trim();
    if (!yr || !/^\d{4}$/.test(yr)) {
      setError("Please enter a valid 4-digit calendar year.");
      return;
    }

    const threshold = parseInt(thresholdInput, 10);
    if (isNaN(threshold) || threshold <= 0) {
      setError("Please enter a valid threshold (greater than 0).");
      return;
    }

    const tier1 = parseFloat(tier1RateInput);
    const tier2 = parseFloat(tier2RateInput);
    if (isNaN(tier1) || tier1 <= 0 || isNaN(tier2) || tier2 <= 0) {
      setError("Please enter positive numeric rates (e.g., 0.72).");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        year: yr,
        tier1_threshold: threshold,
        tier1_rate: tier1,
        tier2_rate: tier2,
      });
      setSuccess(`CRA rates for ${yr} saved successfully!`);
      setTimeout(() => {
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save CRA rates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut listener for saving the form (Ctrl+S)
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingYear && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmitRef.current(e as any);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingYear]);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      id="cra-rates-modal-overlay"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden"
        id="cra-rates-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">CRA Mileage Rate Settings</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure annual tax deduction rates without editing code</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Close rates editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Informational Alert Box */}
          <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300 leading-relaxed flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p>
              The Canada Revenue Agency (CRA) sets the per-kilometre limits for tax-free automobile allowances each year.
              Our calculator uses these exact rates to apply a higher per-kilometre rate to the first tier of driving distance, resetting at the beginning of each calendar year.
            </p>
          </div>

          {editingYear ? (
            /* Editing or Creating form */
            <form onSubmit={handleSubmit} className="space-y-4" id="cra-rate-form">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {editingYear === "NEW_YEAR" ? "Add New CRA Rate Profile" : `Edit Rates for Calendar Year ${editingYear}`}
              </h4>

              {error && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3.5 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40 rounded-xl text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Calendar Year */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Calendar Year</label>
                  <input
                    type="text"
                    maxLength={4}
                    disabled={editingYear !== "NEW_YEAR"}
                    value={yearInput}
                    onChange={(e) => setYearInput(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 disabled:opacity-50 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. 2027"
                    required
                  />
                </div>

                {/* Tier 1 Threshold */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tier 1 Threshold (Kilometres)</label>
                  <input
                    type="number"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="e.g. 5000"
                    required
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">CRA standard threshold is typically 5000 km.</p>
                </div>

                {/* Tier 1 Rate (Under Threshold) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tier 1 Rate ($/km)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tier1RateInput}
                    onChange={(e) => setTier1RateInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="e.g. 0.72"
                    required
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Rate applied to first 5,000 km</p>
                </div>

                {/* Tier 2 Rate (Over Threshold) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tier 2 Rate ($/km)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tier2RateInput}
                    onChange={(e) => setTier2RateInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="e.g. 0.66"
                    required
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Rate applied to any subsequent kms</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg cursor-pointer transition border border-blue-700 flex items-center gap-1.5"
                >
                  {loading ? "Saving..." : "Save Rate Profile"}
                </button>
              </div>
            </form>
          ) : (
            /* Rates List */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Active Annual Rate Profiles</h4>
                <button
                  onClick={handleAddNew}
                  className="px-2.5 py-1.5 text-[11px] font-extrabold text-blue-600 dark:text-blue-450 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition flex items-center gap-1 cursor-pointer"
                  id="add-year-rate-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure Year</span>
                </button>
              </div>

              {rates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No custom annual rates configured. Standard defaults will be applied dynamically.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden">
                  {rates.map((rate) => (
                    <div 
                      key={rate.year} 
                      className="p-4 bg-slate-50/20 dark:bg-slate-950/10 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-950/25 transition"
                    >
                      <div>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono text-sm block">
                          {rate.year} Calendar Year
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                          Threshold: <strong className="text-slate-600 dark:text-slate-300 font-mono">{rate.tier1_threshold} km</strong>
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Rates Applied</span>
                          <span className="font-bold text-slate-750 dark:text-slate-300 font-mono block mt-0.5">
                            Tier 1: <span className="text-blue-600 dark:text-blue-400">${rate.tier1_rate}</span> • Tier 2: <span className="text-emerald-600 dark:text-emerald-400">${rate.tier2_rate}</span>
                          </span>
                        </div>
                        
                        <button
                          onClick={() => handleEdit(rate)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-850 hover:bg-blue-50/40 border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 rounded-md shadow-xs transition cursor-pointer"
                        >
                          Modify
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer info banner */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
          <span>Updates here immediately recompute deduction stats across all tables and charts.</span>
          <span>Security Guaranteed</span>
        </div>
      </motion.div>
    </div>
  );
}
