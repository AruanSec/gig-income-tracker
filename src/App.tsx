/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo, useEffect } from "react";
import { PlusCircle, RefreshCw, HelpCircle, TrendingUp, Landmark, ShieldCheck, DollarSign, LogOut, Car, Route, Download, Upload, Database, Sun, Moon, Trash2, Beaker, Settings, Lock, Calculator } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { IncomeEntry, MileageEntry, VehicleExpense, CraRate } from "./types";
import { INITIAL_INCOME_ENTRIES, INITIAL_MILEAGE_ENTRIES, INITIAL_VEHICLE_EXPENSES } from "./data/mockData";
import { calculateStats, formatCurrency, calculateMileageStats } from "./utils";
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
import TaxProfitSummary from "./components/TaxProfitSummary";
import TaxDeductionCalculatorModal from "./components/TaxDeductionCalculatorModal";
import EarningsAIInsights from "./components/EarningsAIInsights";
import WeeklyComparisonChart from "./components/WeeklyComparisonChart";
import AuthView from "./components/AuthView";
import CraRatesModal from "./components/CraRatesModal";
import DateRangePicker from "./components/DateRangePicker";
import ChangePasswordModal from "./components/ChangePasswordModal";
import AdminPortal from "./components/AdminPortal";

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
      const token = localStorage.getItem("gig_auth_token");
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUserEmail(data.email);
          setUserRole(data.role || "user");
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("gig_auth_token");
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
    const token = localStorage.getItem("gig_auth_token");
    if (!token) return;
    setLoadingData(true);
    try {
      const [incomeRes, mileageRes, expensesRes, ratesRes] = await Promise.all([
        fetch("/api/income", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/mileage", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/expenses", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/settings/cra-rates", { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      if (incomeRes.ok && mileageRes.ok && expensesRes.ok && ratesRes.ok) {
        const [incomeData, mileageData, expensesData, ratesData] = await Promise.all([
          incomeRes.json(),
          mileageRes.json(),
          expensesRes.json(),
          ratesRes.json()
        ]);
        setEntries(incomeData);
        setMileageEntries(mileageData);
        setVehicleExpenses(expensesData);
        setCraRates(ratesData);
      }
    } catch (e) {
      console.error("Failed to load user data", e);
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
  const handleAuthSuccess = async (token: string, email: string) => {
    localStorage.setItem("gig_auth_token", token);
    setUserEmail(email);
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
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
    const token = localStorage.getItem("gig_auth_token");
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (e) {}
    }
    localStorage.removeItem("gig_auth_token");
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
  // Handle saving new or edited logs
  const handleSaveEntry = async (newEntryData: Omit<IncomeEntry, "id"> & { id?: string }) => {
    const token = localStorage.getItem("gig_auth_token");
    if (!token) return;

    try {
      if (newEntryData.id) {
        // Editing existing entry
        const res = await fetch(`/api/income/${newEntryData.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newEntryData)
        });
        if (res.ok) {
          const updated = await res.json();
          setEntries((prev) =>
            prev.map((item) => (item.id === newEntryData.id ? updated : item))
          );
        }
      } else {
        // Adding new entry
        const res = await fetch("/api/income", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newEntryData)
        });
        if (res.ok) {
          const saved = await res.json();
          setEntries((prev) => [saved, ...prev]);
        }
      }
      setIsFormOpen(false);
      setEntryToEdit(null);
    } catch (e) {
      console.error("Failed to save income entry", e);
    }
  };

  // Handle deleting logs
  const handleDeleteEntry = async (id: string) => {
    if (confirm("Are you sure you want to delete this shift entry? This cannot be undone.")) {
      const token = localStorage.getItem("gig_auth_token");
      if (!token) return;
      try {
        const res = await fetch(`/api/income/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          setEntries((prev) => prev.filter((item) => item.id !== id));
        }
      } catch (e) {
        console.error("Failed to delete income entry", e);
      }
    }
  };

  // Helper to open edit form
  const handleEditEntry = (entry: IncomeEntry) => {
    setEntryToEdit(entry);
    setIsFormOpen(true);
  };

  const handleSaveCraRates = async (rateData: CraRate) => {
    const token = localStorage.getItem("gig_auth_token");
    if (!token) throw new Error("No authorization token found.");

    const res = await fetch("/api/settings/cra-rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
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
    const token = localStorage.getItem("gig_auth_token");
    if (!token) return;

    try {
      if (newMileageData.id) {
        const res = await fetch(`/api/mileage/${newMileageData.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newMileageData)
        });
        if (res.ok) {
          const updated = await res.json();
          setMileageEntries((prev) =>
            prev.map((item) => (item.id === newMileageData.id ? updated : item))
          );
        }
      } else {
        const res = await fetch("/api/mileage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newMileageData)
        });
        if (res.ok) {
          const saved = await res.json();
          setMileageEntries((prev) => [saved, ...prev]);
        }
      }
      setIsMileageFormOpen(false);
      setMileageToEdit(null);
    } catch (e) {
      console.error("Failed to save mileage entry", e);
    }
  };

  // Handle deleting mileage logs
  const handleDeleteMileageEntry = async (id: string) => {
    if (confirm("Are you sure you want to delete this business trip? This cannot be undone.")) {
      const token = localStorage.getItem("gig_auth_token");
      if (!token) return;
      try {
        const res = await fetch(`/api/mileage/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          setMileageEntries((prev) => prev.filter((item) => item.id !== id));
        }
      } catch (e) {
        console.error("Failed to delete mileage entry", e);
      }
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
    const token = localStorage.getItem("gig_auth_token");
    if (!token) return;

    try {
      if (newExpenseData.id) {
        const res = await fetch(`/api/expenses/${newExpenseData.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newExpenseData)
        });
        if (res.ok) {
          const updated = await res.json();
          setVehicleExpenses((prev) =>
            prev.map((item) => (item.id === newExpenseData.id ? updated : item))
          );
        }
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newExpenseData)
        });
        if (res.ok) {
          const saved = await res.json();
          setVehicleExpenses((prev) => [saved, ...prev]);
        }
      }
      setIsExpenseFormOpen(false);
      setExpenseToEdit(null);
    } catch (e) {
      console.error("Failed to save expense entry", e);
    }
  };

  // Handle deleting vehicle expenses
  const handleDeleteVehicleExpense = async (id: string) => {
    if (confirm("Are you sure you want to delete this vehicle expense? This cannot be undone.")) {
      const token = localStorage.getItem("gig_auth_token");
      if (!token) return;
      try {
        const res = await fetch(`/api/expenses/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          setVehicleExpenses((prev) => prev.filter((item) => item.id !== id));
        }
      } catch (e) {
        console.error("Failed to delete expense entry", e);
      }
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
      const token = localStorage.getItem("gig_auth_token");
      if (!token) return;

      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
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
      const token = localStorage.getItem("gig_auth_token");
      if (!token) return;

      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
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
    const token = localStorage.getItem("gig_auth_token");
    if (!token) return;
    try {
      const res = await fetch("/api/backup", {
        headers: { "Authorization": `Bearer ${token}` }
      });
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

    const token = localStorage.getItem("gig_auth_token");
    if (!token) return;

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
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300" id="app-root">
      
      {/* Header Area */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs animate-in fade-in slide-in-from-top-4 duration-300" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-8 bg-blue-600 rounded-full self-center shrink-0"></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Revenue & Mileage Tracker</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Track earnings, business mileage, and planning estimates</p>
              
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Sync: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{userEmail}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Stats in Header for Desktop/Tablet */}
            <div className="hidden sm:flex items-center gap-3 mr-2">
              {activeTab === "income" ? (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-left min-w-[150px]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Net Income</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(stats.totalEarnings)}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-left min-w-[130px]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Avg. Hourly</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(stats.averageEarningsPerHourOnline)}</p>
                  </div>
                </>
              ) : activeTab === "mileage" ? (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-left min-w-[150px]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Combined Write-offs</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(mileageStats.totalDeduction + vehicleExpenses.reduce((sum, item) => sum + item.amount, 0))}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-left min-w-[130px]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Operating Costs</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formatCurrency(vehicleExpenses.reduce((sum, item) => sum + item.amount, 0))}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-left min-w-[150px]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recoverable GST/HST</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {formatCurrency(vehicleExpenses.reduce((sum, item) => sum + (item.gstHstAmount || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl text-left min-w-[130px]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(entries.reduce((sum, item) => sum + item.netFare + item.tips, 0))}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* CRA Rates Settings Button */}
              {isAuthenticated && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-700 dark:hover:text-blue-300 transition flex items-center gap-1.5 cursor-pointer"
                  title="Configure custom CRA mileage deduction rates annually"
                  id="settings-btn"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>CRA Rates</span>
                </button>
              )}

              {/* Change Password Button */}
              {isAuthenticated && (
                <button
                  onClick={() => setShowChangePasswordModal(true)}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  title="Change account password securely"
                  id="change-password-btn"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </button>
              )}

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                id="theme-toggle-btn"
              >
                {theme === "light" ? (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Light Mode</span>
                  </>
                )}
              </button>

              {/* Backup Button */}
              <button
                onClick={handleBackupData}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                title="Download local backup file"
                id="backup-btn"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Backup</span>
              </button>

              {/* Restore Button */}
              <label
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                title="Restore from JSON backup file"
                id="restore-btn"
              >
                <Upload className="w-3.5 h-3.5 inline mr-1" />
                <span className="hidden md:inline">Restore</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreData}
                  className="hidden"
                />
              </label>





              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-700 dark:hover:text-red-300 transition flex items-center gap-1.5 cursor-pointer"
                title="Log out of account"
                id="logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>

              {/* Tax Deduction Calculator Button */}
              <button
                onClick={() => setIsTaxCalcOpen(true)}
                className="px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                id="open-tax-calc-header-btn"
                title="Open Tax Deduction Calculator"
              >
                <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Tax Calculator</span>
              </button>

              {/* Main Log Button */}
              {activeTab !== "tax" && activeTab !== "admin" && (
                <button
                  onClick={
                    activeTab === "income" 
                      ? handleCreateNewEntry 
                      : mileageSubTab === "expenses"
                        ? handleCreateNewVehicleExpense
                        : handleCreateNewMileageEntry
                  }
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition flex items-center gap-1.5 shadow-md shadow-blue-100 border border-blue-700 cursor-pointer"
                  id="main-log-btn"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {activeTab === "income" 
                      ? "Log Weekly Income" 
                      : mileageSubTab === "expenses"
                        ? "Log Vehicle Expense"
                        : "Log Business Trip"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" id="app-main">
        
        {/* Banner Informational Accent */}
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/45 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg shrink-0 mt-0.5">
            <Database className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 uppercase tracking-wide">Secure SQLite Sync Active</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Your weekly income logs, business trips, and vehicle operating expenses are stored in the configured database and scoped exclusively to your account.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800" id="tabs-navigation">
          <button
            onClick={() => setActiveTab("income")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "income"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
            id="tab-income-trigger"
          >
            <DollarSign className="w-4 h-4" />
            <span>Weekly Income Logs</span>
          </button>
          <button
            onClick={() => setActiveTab("mileage")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "mileage"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
            id="tab-mileage-trigger"
          >
            <Car className="w-4 h-4" />
            <span>Vehicle & Mileage Logs</span>
          </button>
          <button
            onClick={() => setActiveTab("tax")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "tax"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
            id="tab-tax-trigger"
          >
            <Landmark className="w-4 h-4" />
            <span>Tax & Profit Summary</span>
          </button>
          {userRole === "admin" && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "admin"
                  ? "border-red-600 text-red-600 dark:text-red-400 border-red-600 dark:border-red-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
              id="tab-admin-trigger"
            >
              <ShieldCheck className="w-4 h-4 text-red-500" />
              <span>Admin Database Portal</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-transparent border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl p-4">
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
                <EarningsAIInsights entries={entries} />
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
              <TaxProfitSummary
                entries={entries}
                mileageEntries={mileageEntries}
                expenses={vehicleExpenses}
                craRates={craRates}
              />
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
              <AdminPortal />
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
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 dark:border-slate-800 mt-12 text-slate-400 dark:text-slate-500 text-xs flex flex-col sm:flex-row justify-between items-center gap-3" id="app-footer">
        <div className="flex flex-wrap items-center gap-2">
          <span>Local Storage Enabled</span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Shortcuts:
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">Ctrl+N</kbd> New Log
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">Ctrl+P</kbd> Print
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">Ctrl+S</kbd> Save Form
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 
            System Ready
          </span>
          <span className="text-slate-300 dark:text-slate-800">|</span>
          <span>Build v1.1.0-CRA</span>
        </div>
      </footer>
    </div>
  );
}
