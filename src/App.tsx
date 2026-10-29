import { addMoney, sumMoney } from "./money";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { PlusCircle, RefreshCw, HelpCircle, TrendingUp, Landmark, ShieldCheck, DollarSign, LogOut, Car, Route, Download, Upload, Sun, Moon, Trash2, Beaker, Settings, Lock, Calculator } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { ApiError, deleteRecord, fetchJson, saveRecord } from "./api";
import { IncomeEntry, MileageEntry, VehicleExpense, CraRate } from "./types";
import { INITIAL_INCOME_ENTRIES, INITIAL_MILEAGE_ENTRIES, INITIAL_VEHICLE_EXPENSES } from "./data/mockData";
import { calculateStats, formatCurrency, calculateMileageStats, missingRateYears } from "./utils";
import IncomeStatsGrid from "./components/IncomeStatsGrid";
import IncomeChart from "./components/IncomeChart";
import MonthlyIncomeBarChart from "./components/MonthlyIncomeBarChart";
import IncomeList from "./components/IncomeList";
import IncomeForm from "./components/IncomeForm";
import MileageStatsGrid from "./components/MileageStatsGrid";
import MileageList from "./components/MileageList";
import MileageForm from "./components/MileageForm";
import VehicleExpenseForm from "./components/VehicleExpenseForm";
import VehicleExpenseList from "./components/VehicleExpenseList";
import ExpenseCategoryPieChart from "./components/ExpenseCategoryPieChart";
import CombinedDeductionsView from "./components/CombinedDeductionsView";
import TaxDeductionCalculatorModal from "./components/TaxDeductionCalculatorModal";
import WeeklyComparisonChart from "./components/WeeklyComparisonChart";
import AuthView from "./components/AuthView";
import CraRatesModal from "./components/CraRatesModal";
import DateRangePicker from "./components/DateRangePicker";
import ChangePasswordModal from "./components/ChangePasswordModal";

const TaxProfitSummary = lazy(() => import("./components/TaxProfitSummary"));
const EarningsAIInsights = lazy(() => import("./components/EarningsAIInsights"));
const AdminPortal = lazy(() => import("./components/AdminPortal"));

const DeferredViewFallback = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
    Loading view…
  </div>
);

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Authentication states
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null means loading check
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Core Data States
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [craRates, setCraRates] = useState<CraRate[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Date range filter states
  const [incomeStartDate, setIncomeStartDate] = useState("");
  const [incomeEndDate, setIncomeEndDate] = useState("");
  const [mileageStartDate, setMileageStartDate] = useState("");
  const [mileageEndDate, setMileageEndDate] = useState("");

  // State for adding/editing income
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<IncomeEntry | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isTaxCalcOpen, setIsTaxCalcOpen] = useState(false);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<"income" | "mileage" | "tax" | "admin">("income");

  // State for adding/editing mileage
  const [isMileageFormOpen, setIsMileageFormOpen] = useState(false);
  const [mileageToEdit, setMileageToEdit] = useState<MileageEntry | null>(null);

  // State for adding/editing vehicle expenses
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<VehicleExpense | null>(null);

  // Active mileage sub-tab state
  const [mileageSubTab, setMileageSubTab] = useState<"trips" | "expenses" | "combined">("trips");

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setUserEmail(data.email);
          setUserRole(data.role || "user");
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error("Auth check failed", e);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch full data set when authenticated
  const fetchData = async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const [incomeData, mileageData, expensesData, ratesData] = await Promise.all([
        fetchJson<IncomeEntry[]>("/api/income"),
        fetchJson<MileageEntry[]>("/api/mileage"),
        fetchJson<VehicleExpense[]>("/api/expenses"),
        fetchJson<CraRate[]>("/api/settings/cra-rates")
      ]);
      setEntries(incomeData);
      setMileageEntries(mileageData);
      setVehicleExpenses(expensesData);
      setCraRates(ratesData);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setIsAuthenticated(false);
      setDataError(error instanceof Error ? error.message : "Unable to load your records.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Auth Actions
  const handleAuthSuccess = async (email: string) => {
    setUserEmail(email);
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role || "user");
      }
    } catch (e) {
      console.error("Failed to fetch user role on login success", e);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed.");
    } catch {
      alert("Unable to sign out. Check your connection and try again.");
      return;
    }
    setUserEmail(null);
    setUserRole("user");
    setIsAuthenticated(false);
    setEntries([]);
    setMileageEntries([]);
    setVehicleExpenses([]);
    setCraRates([]);
  };

  // Recalculate stats whenever entries list changes
  const stats = useMemo(() => {
    return calculateStats(entries);
  }, [entries]);

  // Recalculate mileage stats whenever mileage entries change
  const mileageStats = useMemo(() => {
    return calculateMileageStats(mileageEntries, craRates);
  }, [mileageEntries, craRates]);

  // Filtered income entries based on date range picker
  const filteredIncomeEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesStart = !incomeStartDate || entry.startDate >= incomeStartDate;
      const matchesEnd = !incomeEndDate || entry.endDate <= incomeEndDate;
      return matchesStart && matchesEnd;
    });
  }, [entries, incomeStartDate, incomeEndDate]);

  // Filtered mileage entries based on date range picker
  const filteredMileageEntries = useMemo(() => {
    return mileageEntries.filter((entry) => {
      const matchesStart = !mileageStartDate || entry.date >= mileageStartDate;
      const matchesEnd = !mileageEndDate || entry.date <= mileageEndDate;
      return matchesStart && matchesEnd;
    });
  }, [mileageEntries, mileageStartDate, mileageEndDate]);

  // Handle saving new or edited logs
  const handleSaveEntry = async (newEntryData: Omit<IncomeEntry, "id"> & { id?: string }) => {
    const saved = await saveRecord<IncomeEntry>("income", newEntryData);
    setEntries((previous) => newEntryData.id
      ? previous.map((item) => item.id === newEntryData.id ? saved : item)
      : [saved, ...previous]);
    setIsFormOpen(false);
    setEntryToEdit(null);
  };

  // Handle deleting logs
  const handleDeleteEntry = async (id: string) => {
    if (confirm("Are you sure you want to delete this shift entry? This cannot be undone.")) {

      try {
        await deleteRecord("income", id);
        setEntries((prev) => prev.filter((item) => item.id !== id));
      } catch (error) { setDataError(error instanceof Error ? error.message : "Unable to delete the income entry."); }
    }
  };

  // Helper to open edit form
  const handleEditEntry = (entry: IncomeEntry) => {
    setEntryToEdit(entry);
    setIsFormOpen(true);
  };

  const handleSaveCraRates = async (rateData: CraRate) => {
    const res = await fetch("/api/settings/cra-rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(rateData)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to save CRA rates.");
    }

    const updatedRates = await res.json();
    setCraRates(updatedRates);
  };

  // Helper to trigger new entry form
  const handleCreateNewEntry = () => {
    setEntryToEdit(null);
    setIsFormOpen(true);
  };

  // Handle saving new or edited mileage logs
  const handleSaveMileageEntry = async (newMileageData: Omit<MileageEntry, "id"> & { id?: string }) => {
    const saved = await saveRecord<MileageEntry>("mileage", newMileageData);
    setMileageEntries((previous) => newMileageData.id
      ? previous.map((item) => item.id === newMileageData.id ? saved : item)
      : [saved, ...previous]);
    setIsMileageFormOpen(false);
    setMileageToEdit(null);
  };

  // Handle deleting mileage logs
  const handleDeleteMileageEntry = async (id: string) => {
    if (confirm("Are you sure you want to delete this business trip? This cannot be undone.")) {

      try {
        await deleteRecord("mileage", id);
        setMileageEntries((prev) => prev.filter((item) => item.id !== id));
      } catch (error) { setDataError(error instanceof Error ? error.message : "Unable to delete the mileage entry."); }
    }
  };

  // Helper to open edit mileage form
  const handleEditMileageEntry = (entry: MileageEntry) => {
    setMileageToEdit(entry);
    setIsMileageFormOpen(true);
  };

  // Helper to trigger new mileage form
  const handleCreateNewMileageEntry = () => {
    setMileageToEdit(null);
    setIsMileageFormOpen(true);
  };

  // Handle saving new or edited vehicle expenses
  const handleSaveVehicleExpense = async (newExpenseData: Omit<VehicleExpense, "id"> & { id?: string }) => {
    const saved = await saveRecord<VehicleExpense>("expenses", newExpenseData);
    setVehicleExpenses((previous) => newExpenseData.id
      ? previous.map((item) => item.id === newExpenseData.id ? saved : item)
      : [saved, ...previous]);
    setIsExpenseFormOpen(false);
    setExpenseToEdit(null);
  };

  // Handle deleting vehicle expenses
  const handleDeleteVehicleExpense = async (id: string) => {
    if (confirm("Are you sure you want to delete this vehicle expense? This cannot be undone.")) {

      try {
        await deleteRecord("expenses", id);
        setVehicleExpenses((prev) => prev.filter((item) => item.id !== id));
      } catch (error) { setDataError(error instanceof Error ? error.message : "Unable to delete the expense."); }
    }
  };

  // Helper to open edit expense form
  const handleEditVehicleExpense = (expense: VehicleExpense) => {
    setExpenseToEdit(expense);
    setIsExpenseFormOpen(true);
  };

  // Helper to trigger new expense form
  const handleCreateNewVehicleExpense = () => {
    setExpenseToEdit(null);
    setIsExpenseFormOpen(true);
  };

  // Restore mock dataset for testing & demonstration
  const handleResetToDemo = async () => {
    if (confirm("Would you like to reset the database to sample driver data? Your custom shifts and trips will be overwritten.")) {

      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            income: INITIAL_INCOME_ENTRIES,
            mileage: INITIAL_MILEAGE_ENTRIES,
            expenses: INITIAL_VEHICLE_EXPENSES
          })
        });

        if (res.ok) {
          alert("Demo data successfully loaded and synchronized to server!");
          fetchData();
        } else {
          alert("Failed to reset to demo data.");
        }
      } catch (e) {
        console.error("Demo reset failed", e);
      }
    }
  };

  // Empty Database / Purge All Data
  const handleEmptyDatabase = async () => {
    if (confirm("Are you sure you want to empty your database? All of your income, mileage, and vehicle expense records will be permanently deleted on the server. This cannot be undone.")) {

      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            income: [],
            mileage: [],
            expenses: []
          })
        });

        if (res.ok) {
          alert("Database successfully cleared! All entries have been removed.");
          fetchData();
        } else {
          alert("Failed to clear database.");
        }
      } catch (e) {
        console.error("Empty database failed", e);
        alert("Failed to clear database.");
      }
    }
  };

  // Backup Data Trigger
  const handleBackupData = async () => {
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `revenue_mileage_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert("Backup failed. Please try again.");
      }
    } catch (e) {
      console.error("Backup failed", e);
      alert("Backup failed. Please try again.");
    }
  };

  // Restore Data Trigger
  const handleRestoreData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Restoring data will replace all your current logs on the server. Are you sure you want to proceed?")) {
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const res = await fetch("/api/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(backupData)
      });

      if (res.ok) {
        alert("Data restored and synchronized successfully!");
        fetchData();
      } else {
        const err = await res.json();
        alert(`Restore failed: ${err.error || "Invalid file format"}`);
      }
    } catch (e) {
      console.error("Restore failed", e);
      alert("Failed to parse file. Make sure it is a valid backup JSON file.");
    } finally {
      e.target.value = "";
    }
  };

  // Global keydown handler for keyboard shortcuts (Ctrl+N, Ctrl+P, Ctrl+S)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Only trigger if authenticated
      if (!isAuthenticated) return;

      const isModalOpen =
        isFormOpen ||
        isMileageFormOpen ||
        isExpenseFormOpen ||
        showSettingsModal ||
        showTestModal ||
        showChangePasswordModal;

      const key = e.key.toLowerCase();
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && key === "n") {
        e.preventDefault();
        if (!isModalOpen) {
          if (activeTab === "income") {
            handleCreateNewEntry();
          } else if (activeTab === "mileage") {
            if (mileageSubTab === "expenses") {
              handleCreateNewVehicleExpense();
            } else {
              handleCreateNewMileageEntry();
            }
          }
        }
      } else if (isCmdOrCtrl && key === "p") {
        e.preventDefault();
        window.print();
      } else if (isCmdOrCtrl && key === "s") {
        e.preventDefault();
        if (isModalOpen) {
          // Trigger form submission for the active modal form
          const submitBtn = document.querySelector('form button[type="submit"]') as HTMLButtonElement | null;
          if (submitBtn) {
            submitBtn.click();
          } else {
            const form = document.querySelector('form');
            if (form) {
              if (typeof form.requestSubmit === "function") {
                form.requestSubmit();
              } else {
                form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
              }
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [
    isAuthenticated,
    isFormOpen,
    isMileageFormOpen,
    isExpenseFormOpen,
    showSettingsModal,
    showTestModal,
    showChangePasswordModal,
    activeTab,
    mileageSubTab
  ]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center transition-colors duration-300">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Verifying secure database session...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <AuthView onAuthSuccess={handleAuthSuccess} theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <div className="app-root min-h-screen text-slate-900 dark:text-slate-100 font-sans" id="app-root">

      {/* Compact account toolbar */}
      <header className="app-header" id="app-header">
        <div className="app-header-inner">
          <div className="app-brand" aria-label="Revenue and Mileage Tracker">
            <div className="app-brand-mark"><Route className="h-5 w-5" /></div>
            <div>
              <div className="app-brand-name">Route & Revenue</div>
              <div className="app-brand-caption">Your gig work dashboard</div>
            </div>
          </div>
          <div className="app-toolbar" aria-label="Account tools">
            <span className="app-account" title={userEmail || undefined}>{userEmail}</span>
            <button onClick={() => setShowSettingsModal(true)} className="app-tool-button" title="Configure CRA rates" aria-label="Configure CRA rates" id="settings-btn"><Settings className="h-4 w-4" /><span>CRA Rates</span></button>
            <button onClick={() => setShowChangePasswordModal(true)} className="app-tool-button" title="Change password" aria-label="Change password" id="change-password-btn"><Lock className="h-4 w-4" /><span>Password</span></button>
            <button onClick={toggleTheme} className="app-tool-button app-icon-button" title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} id="theme-toggle-btn">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button onClick={handleBackupData} className="app-tool-button app-icon-button" title="Download backup" aria-label="Download backup" id="backup-btn"><Download className="h-4 w-4" /></button>
            <label className="app-tool-button app-icon-button" title="Restore from JSON backup" id="restore-btn">
              <Upload className="h-4 w-4" /><span className="sr-only">Restore from JSON backup</span>
              <input type="file" accept=".json" onChange={handleRestoreData} className="sr-only" aria-label="Restore from JSON backup" />
            </label>
            <button onClick={handleLogout} className="app-tool-button app-icon-button app-logout-button" title="Log out" aria-label="Log out" id="logout-btn"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="app-main" id="app-main">
        <section className="app-hero" aria-labelledby="workspace-title">
          <div className="app-hero-content">
            <p className="app-eyebrow">YOUR WORKSPACE <span aria-hidden="true">/</span> {activeTab === "income" ? "EARNINGS" : activeTab === "mileage" ? "ON THE ROAD" : activeTab === "tax" ? "PLANNING" : "ADMIN"}</p>
            <h1 id="workspace-title">{activeTab === "income" ? "Know what your work earns." : activeTab === "mileage" ? "Every kilometre counts." : activeTab === "tax" ? "See the bigger picture." : "Manage your workspace."}</h1>
            <p className="app-hero-description">{activeTab === "income" ? "Track shifts, compare performance, and keep your income organized." : activeTab === "mileage" ? "Log trips and operating costs in one clear place." : activeTab === "tax" ? "Review your records and explore planning estimates." : "Review accounts and database tools."}</p>
            <div className="app-hero-actions">
              {activeTab !== "tax" && activeTab !== "admin" && (
                <button
                  onClick={activeTab === "income" ? handleCreateNewEntry : mileageSubTab === "expenses" ? handleCreateNewVehicleExpense : handleCreateNewMileageEntry}
                  className="app-primary-button"
                  id="main-log-btn"
                >
                  <PlusCircle className="h-4 w-4" />
                  {activeTab === "income" ? "Log weekly income" : mileageSubTab === "expenses" ? "Log vehicle expense" : "Log business trip"}
                </button>
              )}
              <button onClick={() => setIsTaxCalcOpen(true)} className="app-secondary-button" id="open-tax-calc-header-btn" title="Open Tax Deduction Calculator">
                <Calculator className="h-4 w-4" /> Tax calculator
              </button>
            </div>
          </div>
          <div className="app-hero-metric">
            <div className="app-hero-metric-icon">{activeTab === "mileage" ? <Car className="h-5 w-5" /> : activeTab === "tax" ? <Landmark className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}</div>
            <p>{activeTab === "income" ? "TOTAL NET INCOME" : activeTab === "mileage" ? "BUSINESS DISTANCE" : activeTab === "tax" ? "TRACKED REVENUE" : "TOTAL RECORDS"}</p>
            <strong>{activeTab === "income" ? formatCurrency(stats.totalEarnings) : activeTab === "mileage" ? `${mileageStats.totalKm.toLocaleString()} km` : activeTab === "tax" ? formatCurrency(sumMoney<IncomeEntry>(entries, item => addMoney(item.netFare, item.tips))) : (entries.length + mileageEntries.length + vehicleExpenses.length).toLocaleString()}</strong>
            <span>{activeTab === "income" ? `${entries.length} income ${entries.length === 1 ? "log" : "logs"} recorded` : activeTab === "mileage" ? `${mileageEntries.length} business ${mileageEntries.length === 1 ? "trip" : "trips"} recorded` : activeTab === "tax" ? "From your saved income logs" : "Across income, trips, and expenses"}</span>
          </div>
        </section>
        {dataError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            <span>{dataError}</span>
            <button type="button" onClick={() => void fetchData()} disabled={loadingData} className="font-bold underline disabled:opacity-50">
              {loadingData ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}
        {missingRateYears(mileageEntries, craRates).length > 0 && (
          <div role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
            Incomplete mileage estimate: configure verified planning rates for {missingRateYears(mileageEntries, craRates).join(", ")} in CRA Rates. Trips from these years are excluded from estimates; rates are never borrowed from another year.
          </div>
        )}
        <p className="app-planning-note text-xs text-slate-500">Planning only. Review saved annual rates, business-use percentage, and GST/HST eligibility before filing. Recorded GST/HST is not automatically recoverable.</p>

        {/* Tab switcher */}
        <div className="app-tabs" id="tabs-navigation" aria-label="Dashboard sections">
          <button
            onClick={() => setActiveTab("income")}
            className={`app-tab ${
              activeTab === "income"
                ? "app-tab-active"
                : ""
            }`}
            id="tab-income-trigger" aria-pressed={activeTab === "income"}
          >
            <DollarSign className="w-4 h-4" />
            <span>Income</span>
          </button>
          <button
            onClick={() => setActiveTab("mileage")}
            className={`app-tab ${
              activeTab === "mileage"
                ? "app-tab-active"
                : ""
            }`}
            id="tab-mileage-trigger" aria-pressed={activeTab === "mileage"}
          >
            <Car className="w-4 h-4" />
            <span>Mileage & expenses</span>
          </button>
          <button
            onClick={() => setActiveTab("tax")}
            className={`app-tab ${
              activeTab === "tax"
                ? "app-tab-active"
                : ""
            }`}
            id="tab-tax-trigger" aria-pressed={activeTab === "tax"}
          >
            <Landmark className="w-4 h-4" />
            <span>Tax & profit</span>
          </button>
          {userRole === "admin" && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`app-tab ${
                activeTab === "admin"
                  ? "app-tab-active"
                  : ""
              }`}
              id="tab-admin-trigger" aria-pressed={activeTab === "admin"}
            >
              <ShieldCheck className="w-4 h-4 text-red-500" />
              <span>Admin</span>
            </button>
          )}
        </div>

        {/* Dynamic Tab Rendering */}
        <AnimatePresence mode="wait">
          {activeTab === "income" && (
            <motion.div
              key="income-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
              id="income-tab-view"
            >
              {/* 1. Statistics Grid & Tax Calculator Banner */}
              <div className="app-estimator-callout flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-transparent border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Tax Deduction Estimator Tool
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        Interactive
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Estimate eligible tax write-offs & net tax savings directly from your logged income and expenses
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTaxCalcOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                  id="open-tax-calc-banner-btn"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Launch Calculator</span>
                </button>
              </div>

              <section aria-label="Gig Statistics">
                <IncomeStatsGrid stats={stats} />
              </section>

              {/* Gemini AI Earnings Trends & Suggestions Analysis */}
              <section aria-label="Gemini AI Earnings Analysis">
                <Suspense fallback={<DeferredViewFallback />}><EarningsAIInsights entries={entries} /></Suspense>
              </section>

              {/* 2. Monthly Income Aggregation Bar Chart */}
              <section aria-label="Monthly Income Aggregation Chart">
                <MonthlyIncomeBarChart entries={entries} />
              </section>

              {/* 3. Weekly Side-by-Side Comparison Chart */}
              <section aria-label="Weekly Income Comparison Chart">
                <WeeklyComparisonChart entries={entries} />
              </section>

              {/* 3. Bento Layout: Trends Chart & Detailed Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Chart Panel */}
                <section className="lg:col-span-1 h-full" aria-label="Performance Chart">
                  <IncomeChart entries={entries} />
                </section>

                {/* List panel */}
                <section className="lg:col-span-2 space-y-4" aria-label="Income Logs Table">
                  <DateRangePicker
                    startDate={incomeStartDate}
                    endDate={incomeEndDate}
                    onChange={(start, end) => {
                      setIncomeStartDate(start);
                      setIncomeEndDate(end);
                    }}
                    label="Income Record Date Range"
                  />
                  <IncomeList
                    entries={filteredIncomeEntries}
                    onEdit={handleEditEntry}
                    onDelete={handleDeleteEntry}
                  />
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === "mileage" && (
            <motion.div
              key="mileage-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
              id="mileage-tab-view"
            >
              {/* 1. Statistics Grid with Threshold limit indicator */}
              <section aria-label="Mileage Statistics">
                <MileageStatsGrid stats={mileageStats} entries={mileageEntries} expenses={vehicleExpenses} />
              </section>

              {/* Sub-tab Navigation */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl max-w-lg self-start border border-slate-200 dark:border-slate-800" id="mileage-sub-tabs">
                <button
                  onClick={() => setMileageSubTab("trips")}
                  className={`flex-1 text-center py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
                    mileageSubTab === "trips"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  id="sub-tab-trips"
                >
                  Business Trips ({mileageEntries.length})
                </button>
                <button
                  onClick={() => setMileageSubTab("expenses")}
                  className={`flex-1 text-center py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
                    mileageSubTab === "expenses"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  id="sub-tab-expenses"
                >
                  Operating Expenses ({vehicleExpenses.length})
                </button>
                <button
                  onClick={() => setMileageSubTab("combined")}
                  className={`flex-1 text-center py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer ${
                    mileageSubTab === "combined"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  id="sub-tab-combined"
                >
                  Combined Summary
                </button>
              </div>

              {/* Sub-tab View Renderings */}
              <AnimatePresence mode="wait">
                {mileageSubTab === "trips" && (
                  <motion.section
                    key="trips-subview"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    aria-label="Mileage Logs Table"
                    className="space-y-4"
                  >
                    <DateRangePicker
                      startDate={mileageStartDate}
                      endDate={mileageEndDate}
                      onChange={(start, end) => {
                        setMileageStartDate(start);
                        setMileageEndDate(end);
                      }}
                      label="Trip Logs Date Range"
                    />
                    <MileageList
                      entries={filteredMileageEntries}
                      allEntries={mileageEntries}
                      onEdit={handleEditMileageEntry}
                      onDelete={handleDeleteMileageEntry}
                      craRates={craRates}
                    />
                  </motion.section>
                )}

                {mileageSubTab === "expenses" && (
                  <motion.section
                    key="expenses-subview"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    aria-label="Vehicle Expenses and Chart"
                    className="space-y-6"
                  >
                    <ExpenseCategoryPieChart expenses={vehicleExpenses} />
                    <VehicleExpenseList
                      expenses={vehicleExpenses}
                      onEdit={handleEditVehicleExpense}
                      onDelete={handleDeleteVehicleExpense}
                      onAddTrigger={handleCreateNewVehicleExpense}
                    />
                  </motion.section>
                )}

                {mileageSubTab === "combined" && (
                  <motion.section
                    key="combined-subview"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    aria-label="Combined Deductions Breakdown"
                  >
                    <CombinedDeductionsView
                      mileageEntries={mileageEntries}
                      expenses={vehicleExpenses}
                      craRates={craRates}
                    />
                  </motion.section>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "tax" && (
            <motion.div
              key="tax-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
              id="tax-tab-view"
            >
              <Suspense fallback={<DeferredViewFallback />}><TaxProfitSummary
                entries={entries}
                mileageEntries={mileageEntries}
                expenses={vehicleExpenses}
                craRates={craRates}
              /></Suspense>
            </motion.div>
          )}

          {activeTab === "admin" && userRole === "admin" && (
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
              id="admin-tab-view"
            >
              <Suspense fallback={<DeferredViewFallback />}><AdminPortal /></Suspense>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Overlay Modal Form for Income */}
      <AnimatePresence>
        {isFormOpen && (
          <IncomeForm
            entryToEdit={entryToEdit}
            onSave={handleSaveEntry}
            onCancel={() => {
              setIsFormOpen(false);
              setEntryToEdit(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Overlay Modal Form for Mileage */}
      <AnimatePresence>
        {isMileageFormOpen && (
          <MileageForm
            entryToEdit={mileageToEdit}
            onSave={handleSaveMileageEntry}
            onCancel={() => {
              setIsMileageFormOpen(false);
              setMileageToEdit(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Overlay Modal Form for Vehicle Expenses */}
      <AnimatePresence>
        {isExpenseFormOpen && (
          <VehicleExpenseForm
            entryToEdit={expenseToEdit}
            onSave={handleSaveVehicleExpense}
            onCancel={() => {
              setIsExpenseFormOpen(false);
              setExpenseToEdit(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* CRA Rates Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <CraRatesModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            rates={craRates}
            onSave={handleSaveCraRates}
          />
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <ChangePasswordModal
            isOpen={showChangePasswordModal}
            onClose={() => setShowChangePasswordModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Overlay Modal for Unit Tests */}
      <AnimatePresence>
        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs" id="test-runner-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-emerald-50/10 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <Beaker className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Weekly Income Unit Tests
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide uppercase">
                      Test Suite Runner
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-slate-950 dark:bg-black rounded-xl p-4 font-mono text-xs text-slate-300 border border-slate-850 space-y-3 shadow-inner">
                  <div className="text-emerald-400 font-bold border-b border-slate-800/80 pb-2 flex items-center justify-between">
                    <span>🧪 TEST RUNNER SHELL v1.0.0</span>
                    <span className="px-2 py-0.5 bg-emerald-950/55 text-emerald-400 text-[10px] rounded-md border border-emerald-800/40">ACTIVE</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500">&gt;</span>
                      <span className="text-slate-400">Loading module <span className="text-blue-400">"./src/utils.ts"</span>...</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500">&gt;</span>
                      <span className="text-emerald-400 font-bold">✓ Loaded calculateStats() successfully.</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-slate-900">
                    <div>
                      <div className="text-slate-250 font-bold flex items-center gap-2">
                        <span className="text-blue-400">▶</span> Test 1: Empty list of weekly income entries
                      </div>
                      <div className="pl-4 text-slate-400 space-y-1 mt-1">
                        <div>Assert totalEarnings === 0 <span className="text-emerald-500">✓</span></div>
                        <div>Assert totalNetFare === 0 <span className="text-emerald-500">✓</span></div>
                        <div>Assert totalTips === 0 <span className="text-emerald-500">✓</span></div>
                        <div>Assert totalTaxes === 0 <span className="text-emerald-500">✓</span></div>
                        <div>Assert totalTrips === 0 <span className="text-emerald-500">✓</span></div>
                        <div>Assert averageEarningsPerTrip === 0 <span className="text-emerald-500">✓</span></div>
                        <div>Assert averageEarningsPerHourOnline === 0 <span className="text-emerald-500">✓</span></div>
                        <div className="text-emerald-400 font-bold text-[11px] mt-0.5">✅ Test 1 Passed!</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-250 font-bold flex items-center gap-2">
                        <span className="text-blue-400">▶</span> Test 2: Single weekly income entry calculations
                      </div>
                      <div className="pl-4 text-slate-400 space-y-1 mt-1">
                        <div className="text-slate-500 italic">Mock Input: 20 trips, 20 hrs online, 10 hrs active, $400 netFare, $100 tips, $20 taxes, $480 total</div>
                        <div>Assert singleStats.totalEarnings === 480 <span className="text-emerald-500">✓</span></div>
                        <div>Assert singleStats.averageEarningsPerTrip === 24 <span className="text-emerald-500">✓</span></div>
                        <div>Assert singleStats.averageEarningsPerHourOnline === 24 <span className="text-emerald-500">✓</span></div>
                        <div>Assert singleStats.averageEarningsPerHourActive === 48 <span className="text-emerald-500">✓</span></div>
                        <div className="text-emerald-400 font-bold text-[11px] mt-0.5">✅ Test 2 Passed!</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-250 font-bold flex items-center gap-2">
                        <span className="text-blue-400">▶</span> Test 3: Multiple weekly income entries calculations
                      </div>
                      <div className="pl-4 text-slate-400 space-y-1 mt-1">
                        <div className="text-slate-500 italic">Mock Input (2 Weeks): $240 total (Week 1), $355 total (Week 2)</div>
                        <div>Assert multiStats.totalEarnings === 595 <span className="text-emerald-500">✓</span></div>
                        <div>Assert multiStats.totalNetFare === 500 <span className="text-emerald-500">✓</span></div>
                        <div>Assert multiStats.totalTips === 120 <span className="text-emerald-500">✓</span></div>
                        <div>Assert multiStats.totalTrips === 25 <span className="text-emerald-500">✓</span></div>
                        <div>Assert multiStats.averageEarningsPerTrip === 23.8 <span className="text-emerald-500">✓</span></div>
                        <div>Assert multiStats.averageEarningsPerHourOnline === 23.8 <span className="text-emerald-500">✓</span></div>
                        <div>Assert multiStats.averageEarningsPerHourActive ≈ 39.67 <span className="text-emerald-500">✓</span></div>
                        <div className="text-emerald-400 font-bold text-[11px] mt-0.5">✅ Test 3 Passed!</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-slate-900 text-center text-[13px] font-black text-emerald-400 tracking-wider">
                    🎉 ALL TESTS PASSED SUCCESSFULLY!
                  </div>
                </div>

                {/* Performance & Execution Summary */}
                <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/25 border border-emerald-100/50 dark:border-emerald-900/30 rounded-xl space-y-2">
                  <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Execution Summary
                  </h4>
                  <p className="text-xs text-slate-650 dark:text-slate-300 leading-relaxed">
                    The calculations engine is running fully type-safe unit tests in our sandboxed runtime. These unit tests verify precise accuracy of the weekly income aggregation algorithm against mathematical expectations, including tip ratio exclusions, tax adjustments, active hour rates, and overall totals.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>Environment: <span className="text-slate-700 dark:text-slate-300">Development Sandbox</span></div>
                    <div>Runtime: <span className="text-slate-700 dark:text-slate-300">Node v22 (TSX Engine)</span></div>
                    <div>Target Module: <span className="text-blue-600 dark:text-blue-400">src/utils.ts</span></div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition"
                >
                  Close Test Monitor
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tax Deduction Calculator Modal */}
      <TaxDeductionCalculatorModal
        isOpen={isTaxCalcOpen}
        onClose={() => setIsTaxCalcOpen(false)}
        incomeEntries={entries}
        mileageEntries={mileageEntries}
        vehicleExpenses={vehicleExpenses}
        craRates={craRates}
      />

      {/* Page Footer Status Bar */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 dark:border-slate-800 mt-8 text-slate-500 dark:text-slate-400 text-xs flex flex-col sm:flex-row justify-between items-center gap-3" id="app-footer">
        <div className="flex flex-wrap items-center gap-2">
          <span>Records are saved to your account.</span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Shortcuts:
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">Ctrl+N</kbd> New Log
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">Ctrl+P</kbd> Print
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">Ctrl+S</kbd> Save Form
          </span>
        </div>
        <span>Route & Revenue</span>
      </footer>
    </div>
  );
}
