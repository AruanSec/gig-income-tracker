import React, { useState, useMemo, useEffect } from "react";
import {
  Calculator,
  X,
  DollarSign,
  TrendingDown,
  Sparkles,
  Percent,
  Check,
  Copy,
  Info,
  Car,
  FileText,
  ShieldAlert,
  HelpCircle
} from "lucide-react";
import { IncomeEntry, MileageEntry, VehicleExpense, CraRate } from "../types";
import { formatCurrency } from "../utils";

interface TaxDeductionCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomeEntries: IncomeEntry[];
  mileageEntries: MileageEntry[];
  vehicleExpenses: VehicleExpense[];
  craRates: CraRate[];
}

export default function TaxDeductionCalculatorModal({
  isOpen,
  onClose,
  incomeEntries,
  mileageEntries,
  vehicleExpenses,
  craRates,
}: TaxDeductionCalculatorModalProps) {
  // Calculated initial values from logs
  const loggedIncome = useMemo(() => {
    return incomeEntries.reduce((sum, e) => sum + (e.totalEarnings || 0), 0);
  }, [incomeEntries]);

  const loggedExpenseTotal = useMemo(() => {
    return vehicleExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [vehicleExpenses]);

  const defaultCraRate = useMemo(() => {
    if (craRates && craRates.length > 0) {
      return craRates[0].tier1_rate || 0.70;
    }
    return 0.70;
  }, [craRates]);

  const loggedBusinessKm = useMemo(() => {
    return mileageEntries.reduce((sum, m) => sum + (m.distance || 0), 0);
  }, [mileageEntries]);

  const loggedMileageDeduction = useMemo(() => {
    return loggedBusinessKm * defaultCraRate;
  }, [loggedBusinessKm, defaultCraRate]);

  // Editable Form state initialized from logs
  const [grossIncome, setGrossIncome] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(22); // 22% default estimated tax rate
  const [businessUsePct, setBusinessUsePct] = useState<number>(85); // 85% business use default
  const [vehicleExpenseInput, setVehicleExpenseInput] = useState<number>(0);
  const [mileageDeductionInput, setMileageDeductionInput] = useState<number>(0);
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<number>(350); // Cell phone / supplies estimate
  const [deductionMethod, setDeductionMethod] = useState<"standard_mileage" | "actual_expense">("standard_mileage");
  const [copied, setCopied] = useState(false);

  // Synchronize state when modal opens or entries change
  useEffect(() => {
    if (isOpen) {
      setGrossIncome(Math.round(loggedIncome));
      setVehicleExpenseInput(Math.round(loggedExpenseTotal));
      setMileageDeductionInput(Math.round(loggedMileageDeduction));
    }
  }, [isOpen, loggedIncome, loggedExpenseTotal, loggedMileageDeduction]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Calculation Logic
  const eligibleVehicleDeduction = useMemo(() => {
    if (deductionMethod === "standard_mileage") {
      return mileageDeductionInput;
    } else {
      return (vehicleExpenseInput * businessUsePct) / 100;
    }
  }, [deductionMethod, mileageDeductionInput, vehicleExpenseInput, businessUsePct]);

  const totalDeductions = useMemo(() => {
    return Math.max(0, eligibleVehicleDeduction + otherDeductionsInput);
  }, [eligibleVehicleDeduction, otherDeductionsInput]);

  const taxableIncome = useMemo(() => {
    return Math.max(0, grossIncome - totalDeductions);
  }, [grossIncome, totalDeductions]);

  const estimatedTaxWithoutDeductions = useMemo(() => {
    return (grossIncome * taxRate) / 100;
  }, [grossIncome, taxRate]);

  const estimatedTaxWithDeductions = useMemo(() => {
    return (taxableIncome * taxRate) / 100;
  }, [taxableIncome, taxRate]);

  const taxSavings = useMemo(() => {
    return Math.max(0, estimatedTaxWithoutDeductions - estimatedTaxWithDeductions);
  }, [estimatedTaxWithoutDeductions, estimatedTaxWithDeductions]);

  const effectiveSavingsPct = useMemo(() => {
    if (grossIncome <= 0) return 0;
    return Math.round((taxSavings / grossIncome) * 100);
  }, [taxSavings, grossIncome]);

  const handleResetToLogs = () => {
    setGrossIncome(Math.round(loggedIncome));
    setVehicleExpenseInput(Math.round(loggedExpenseTotal));
    setMileageDeductionInput(Math.round(loggedMileageDeduction));
    setBusinessUsePct(85);
    setOtherDeductionsInput(350);
  };

  const handleCopySummary = () => {
    const summaryText = `--- GIG DRIVER TAX DEDUCTION ESTIMATE ---
Gross Earnings: ${formatCurrency(grossIncome)}
Planning Method: ${deductionMethod === "standard_mileage" ? "Per-Kilometre Estimate ($0.70/km)" : `Actual Vehicle Expenses (${businessUsePct}% Business Use)`}
Vehicle/Mileage Deduction: ${formatCurrency(eligibleVehicleDeduction)}
Other Write-offs (Phone/Supplies): ${formatCurrency(otherDeductionsInput)}
Total Write-Offs: ${formatCurrency(totalDeductions)}
Taxable Income: ${formatCurrency(taxableIncome)}
Estimated Tax Rate: ${taxRate}%
Tax Saved from Deductions: ${formatCurrency(taxSavings)}
Estimated Tax Payable: ${formatCurrency(estimatedTaxWithDeductions)}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
      id="tax-calculator-modal-backdrop"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-6 transform transition-all flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        id="tax-calculator-modal-content"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Tax Deduction & Savings Calculator
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono">
                  Estimator
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estimate tax write-offs, net taxable income, and potential savings based on your logged earnings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            id="close-tax-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Top Quick Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Estimated Tax Saved
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                {formatCurrency(taxSavings)}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 block">
                {effectiveSavingsPct}% reduction on total earnings
              </span>
            </div>

            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                Total Tax Write-Offs
              </span>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">
                {formatCurrency(totalDeductions)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Reduces income subject to tax
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Estimated Net Tax Owed
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                {formatCurrency(estimatedTaxWithDeductions)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                At {taxRate}% effective tax rate
              </span>
            </div>
          </div>

          {/* Calculator Control Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-850/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
            
            {/* Column 1: Income & Tax Rate */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                Earnings & Tax Bracket
              </h4>

              {/* Gross Income Input */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Gross Annual Income ($)</span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    Logged: {formatCurrency(loggedIncome)}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">$</span>
                  <input
                    type="number"
                    value={grossIncome || ""}
                    onChange={(e) => setGrossIncome(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-900 dark:text-white border border-slate-250 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter gross earnings..."
                    id="calc-gross-income-input"
                  />
                </div>
              </div>

              {/* Tax Rate Selection */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Effective Tax Rate ({taxRate}%)</span>
                  <span className="text-[10px] text-slate-400">Fed + State/Prov combined</span>
                </label>
                
                {/* Tax Bracket Quick Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[15, 20, 22, 25, 30, 35].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setTaxRate(rate)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer font-mono ${
                        taxRate === rate
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer pt-1"
                />
              </div>

              {/* Deduction Method Selector */}
              <div className="space-y-1.5 text-left pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Vehicle Deduction Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeductionMethod("standard_mileage")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      deductionMethod === "standard_mileage"
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-100 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-blue-500" /> Standard Rate
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      CRA/IRS Mileage per km
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeductionMethod("actual_expense")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      deductionMethod === "actual_expense"
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-100 font-bold"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold block flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-purple-500" /> Actual Expenses
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Fuel, Insurance & Maintenance
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: Expense Inputs & Business Use */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                Deduction Variables
              </h4>

              {deductionMethod === "standard_mileage" ? (
                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Logged Mileage Deduction ($)</span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      {loggedBusinessKm} km @ ${defaultCraRate.toFixed(2)}/km
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      value={mileageDeductionInput || ""}
                      onChange={(e) => setMileageDeductionInput(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-900 dark:text-white border border-slate-250 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter mileage deduction..."
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Total Vehicle Receipts ($)</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Logged: {formatCurrency(loggedExpenseTotal)}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">$</span>
                      <input
                        type="number"
                        value={vehicleExpenseInput || ""}
                        onChange={(e) => setVehicleExpenseInput(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-900 dark:text-white border border-slate-250 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Total vehicle expenses..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Business Use Percentage ({businessUsePct}%)</span>
                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                        Eligible: {formatCurrency((vehicleExpenseInput * businessUsePct) / 100)}
                      </span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={businessUsePct}
                      onChange={(e) => setBusinessUsePct(Number(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Other Business Expenses */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Other Business Write-offs ($)</span>
                  <span className="text-[10px] text-slate-400">Phone, supplies, gear</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">$</span>
                  <input
                    type="number"
                    value={otherDeductionsInput || ""}
                    onChange={(e) => setOtherDeductionsInput(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-900 dark:text-white border border-slate-250 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Phone, data, supplies..."
                  />
                </div>
              </div>

              {/* Reset to Logged Data Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetToLogs}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Reset to Actual App Logs
                </button>
              </div>
            </div>
          </div>

          {/* Breakdown Comparison Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-left">
            <div className="bg-slate-50 dark:bg-slate-850 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tax Calculation Summary
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {deductionMethod === "standard_mileage" ? "Mileage Method" : "Actual Expenses Method"}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              <div className="px-4 py-2.5 flex justify-between items-center bg-white dark:bg-slate-900">
                <span className="font-sans font-medium text-slate-600 dark:text-slate-400">Gross Earnings:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(grossIncome)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center bg-white dark:bg-slate-900">
                <span className="font-sans font-medium text-slate-600 dark:text-slate-400">Vehicle / Mileage Deduction:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">- {formatCurrency(eligibleVehicleDeduction)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center bg-white dark:bg-slate-900">
                <span className="font-sans font-medium text-slate-600 dark:text-slate-400">Other Business Write-offs:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">- {formatCurrency(otherDeductionsInput)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center bg-slate-50/70 dark:bg-slate-850/50 font-bold">
                <span className="font-sans text-slate-800 dark:text-slate-200">Net Taxable Income:</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(taxableIncome)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-center bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                <span className="font-sans text-emerald-800 dark:text-emerald-300">Total Tax Saved by Deductions:</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(taxSavings)}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic flex items-start gap-1.5 text-left">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            Note: This tax calculation is an estimate for informational planning purposes. Always consult a licensed CPA or tax professional for official tax filing guidance.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={handleCopySummary}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            id="copy-tax-summary-btn"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Summary Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Summary to Clipboard</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer shadow-md"
            id="done-tax-calculator-btn"
          >
            Close Calculator
          </button>
        </div>
      </div>
    </div>
  );
}
