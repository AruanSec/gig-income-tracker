import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Database,
  TrendingUp,
  MapPin,
  DollarSign,
  Trash2,
  Edit2,
  UserPlus,
  Search,
  Check,
  X,
  AlertCircle,
  Key,
  ShieldAlert,
  HardDrive,
  UserCheck,
  Layers,
  FileText
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils";

interface AdminStats {
  usersCount: number;
  incomeCount: number;
  mileageCount: number;
  expensesCount: number;
  totalEarnings: number;
  totalDistance: number;
  totalExpenses: number;
  tables: Array<{ name: string; count: number }>;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  incomeCount: number;
  mileageCount: number;
  expenseCount: number;
}

export default function AdminPortal() {
  const [activeSubTab, setActiveSubTab] = useState<"stats" | "users" | "data">("stats");
  const [dataSubTab, setDataSubTab] = useState<"income" | "mileage" | "expenses">("income");

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<any[]>([]);
  const [mileageEntries, setMileageEntries] = useState<any[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<any[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search filter states
  const [userSearch, setUserSearch] = useState("");
  const [dataSearch, setDataSearch] = useState("");

  // Modals / forms states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // New user form states
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");

  // Edit user form states
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState("user");

  const token = localStorage.getItem("gig_auth_token");

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load admin stats.");
      }
    } catch (e: any) {
      setError(e.message || "Error reaching server.");
    }
  };

  // Fetch Users list
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {}
  };

  // Fetch all user records
  const fetchGlobalData = async () => {
    try {
      setLoading(true);
      const [incomeRes, mileageRes, expensesRes] = await Promise.all([
        fetch("/api/admin/data/income", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/data/mileage", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/data/expenses", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (incomeRes.ok && mileageRes.ok && expensesRes.ok) {
        const [income, mileage, expenses] = await Promise.all([
          incomeRes.json(),
          mileageRes.json(),
          expensesRes.json()
        ]);
        setIncomeEntries(income);
        setMileageEntries(mileage);
        setExpenseEntries(expenses);
      }
    } catch (e) {
      console.error("Failed to load global data logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    setError(null);
    setSuccessMessage(null);

    if (activeSubTab === "stats") {
      fetchStats();
    } else if (activeSubTab === "users") {
      fetchUsers();
    } else if (activeSubTab === "data") {
      fetchGlobalData();
    }
  }, [activeSubTab]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newUserEmail || !newUserPassword) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUsers([data, ...users]);
        setShowAddUserModal(false);
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("user");
        showSuccess(`User account "${data.email}" created successfully.`);
        // Refresh stats
        fetchStats();
      } else {
        setError(data.error || "Failed to create user.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Edit user save
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: editUserEmail,
          role: editUserRole,
          password: editUserPassword ? editUserPassword : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUsers(users.map(u => (u.id === data.id ? data : u)));
        setShowEditUserModal(false);
        setEditingUser(null);
        setEditUserPassword("");
        showSuccess(`User account "${data.email}" updated successfully.`);
      } else {
        setError(data.error || "Failed to update user.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Delete user
  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`CRITICAL WARNING:\nAre you sure you want to permanently delete user "${user.email}"?\n\nThis will instantly wipe out all of their income logs, mileage records, and vehicle expenses from the database. This action is completely irreversible!`)) {
      return;
    }
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setUsers(users.filter(u => u.id !== user.id));
        showSuccess(`User "${user.email}" and all associated logs deleted from SQLite.`);
        fetchStats();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete user.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Delete specific income entry globally
  const handleDeleteIncome = async (id: string) => {
    if (!confirm("Delete this income entry permanently?")) return;
    try {
      const res = await fetch(`/api/admin/data/income/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIncomeEntries(incomeEntries.filter(e => e.id !== id));
        showSuccess("Income entry deleted from database.");
        fetchStats();
      }
    } catch (e) {}
  };

  // Delete specific mileage entry globally
  const handleDeleteMileage = async (id: string) => {
    if (!confirm("Delete this mileage log permanently?")) return;
    try {
      const res = await fetch(`/api/admin/data/mileage/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMileageEntries(mileageEntries.filter(e => e.id !== id));
        showSuccess("Mileage log deleted from database.");
        fetchStats();
      }
    } catch (e) {}
  };

  // Delete specific expense entry globally
  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense record permanently?")) return;
    try {
      const res = await fetch(`/api/admin/data/expenses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setExpenseEntries(expenseEntries.filter(e => e.id !== id));
        showSuccess("Expense record deleted from database.");
        fetchStats();
      }
    } catch (e) {}
  };

  // Filter users
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Filter global records based on selected database sub-tab
  const filteredIncome = incomeEntries.filter(e =>
    (e.userEmail?.toLowerCase() || "").includes(dataSearch.toLowerCase()) ||
    (e.notes?.toLowerCase() || "").includes(dataSearch.toLowerCase())
  );

  const filteredMileage = mileageEntries.filter(e =>
    (e.userEmail?.toLowerCase() || "").includes(dataSearch.toLowerCase()) ||
    (e.purpose?.toLowerCase() || "").includes(dataSearch.toLowerCase()) ||
    (e.notes?.toLowerCase() || "").includes(dataSearch.toLowerCase())
  );

  const filteredExpenses = expenseEntries.filter(e =>
    (e.userEmail?.toLowerCase() || "").includes(dataSearch.toLowerCase()) ||
    (e.category?.toLowerCase() || "").includes(dataSearch.toLowerCase()) ||
    (e.description?.toLowerCase() || "").includes(dataSearch.toLowerCase())
  );

  return (
    <div className="space-y-6" id="admin-portal-root">
      
      {/* Messages */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/40 flex items-start gap-3 text-left" id="admin-error-box">
          <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-red-800 dark:text-red-300">Admin Action Error</h5>
            <div className="text-[11px] text-red-700 dark:text-red-400 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/25 p-4 border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-3 text-left" id="admin-success-box">
          <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Database Synchronized</h5>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">{successMessage}</div>
          </div>
        </div>
      )}

      {/* Admin Title Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-850 dark:from-slate-950 dark:to-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 shadow-inner">
            <ShieldAlert className="w-6.5 h-6.5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">SQLite Database Administration</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage user accounts, audit recorded logs, and inspect server database tables.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Connection Live
          </span>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-150 dark:border-slate-800 max-w-2xl text-left" id="admin-sub-tabs">
        <button
          onClick={() => setActiveSubTab("stats")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeSubTab === "stats"
              ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          id="admin-sub-tab-stats"
        >
          <Database className="w-4 h-4" />
          <span>System Stats & Tables</span>
        </button>
        <button
          onClick={() => setActiveSubTab("users")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeSubTab === "users"
              ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          id="admin-sub-tab-users"
        >
          <Users className="w-4 h-4" />
          <span>User Accounts ({users.length || "..."})</span>
        </button>
        <button
          onClick={() => setActiveSubTab("data")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeSubTab === "data"
              ? "bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          id="admin-sub-tab-data"
        >
          <Layers className="w-4 h-4" />
          <span>Global Records Auditor</span>
        </button>
      </div>

      {/* Tab Render Area */}
      <div className="space-y-6">
        
        {/* TAB 1: stats */}
        {activeSubTab === "stats" && stats && (
          <div className="space-y-6 text-left animate-in fade-in duration-200">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Drivers</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.usersCount}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Users className="w-5.5 h-5.5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Aggregated Earnings</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(stats.totalEarnings)}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <TrendingUp className="w-5.5 h-5.5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Distance Tracked</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{(stats.totalDistance / 10).toFixed(1)} km</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <MapPin className="w-5.5 h-5.5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total ExpensesLogged</p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(stats.totalExpenses)}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
                  <DollarSign className="w-5.5 h-5.5" />
                </div>
              </div>
            </div>

            {/* Tables Info Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Table stats list */}
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" /> Database Table Allocations
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">A low-level audit of recorded rows in the project's SQLite engine.</p>
                </div>

                <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-150 dark:divide-slate-800">
                  {stats.tables.map(table => (
                    <div key={table.name} className="flex justify-between items-center px-4 py-3 bg-slate-50/40 dark:bg-slate-900/20 text-xs">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{table.name}</span>
                      <span className="font-semibold text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {table.count} rows
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SQLite Health summary card */}
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-500" /> SQLite Driver Details
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Physical health metrics and configuration parameters for SQLite3.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/45 border border-slate-200 dark:border-slate-850 rounded-xl flex items-start gap-3">
                    <Database className="w-5 h-5 text-slate-450 mt-0.5 shrink-0" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-slate-700 dark:text-slate-300">Durable SQLite Engine Active</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        The application is utilizing standard <code className="bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1 rounded font-mono font-bold">better-sqlite3</code>. All user registrations and records are persisted inside the local file <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded font-mono font-bold">database.db</code>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 text-xs text-left">
                    <div className="bg-slate-50/55 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Foreign Keys</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">ON DELETE CASCADE (Active)</p>
                    </div>
                    <div className="bg-slate-50/55 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Access Level</p>
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">Superuser Admin Portal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: users */}
        {activeSubTab === "users" && (
          <div className="space-y-4 text-left animate-in fade-in duration-200">
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user accounts by email or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-450 dark:placeholder-slate-550 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                />
              </div>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center justify-center gap-1.5 border border-blue-700 cursor-pointer shadow-xs self-start sm:self-auto"
                id="create-user-modal-btn"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New User</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800">
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email Address</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Created At</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Income logs</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Mileage logs</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Expense logs</th>
                      <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/65 text-xs">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-450 dark:text-slate-500 font-semibold">
                          No registered user accounts match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="p-4 font-bold text-slate-800 dark:text-slate-150">
                            <div className="flex items-center gap-2">
                              {user.role === "admin" && (
                                <span className="p-1 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded" title="Administrator account">
                                  <UserCheck className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span>{user.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              user.role === "admin"
                                ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-slate-400 font-mono font-medium">
                            {formatDate(user.created_at)}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-350">{user.incomeCount}</td>
                          <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-350">{user.mileageCount}</td>
                          <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-350">{user.expenseCount}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditUserEmail(user.email);
                                  setEditUserRole(user.role);
                                  setEditUserPassword("");
                                  setShowEditUserModal(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Edit user account configuration"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                                title="Permanently delete user and all their records"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: global data explorer */}
        {activeSubTab === "data" && (
          <div className="space-y-4 text-left animate-in fade-in duration-200">
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Inner Tabs switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl max-w-lg border border-slate-200 dark:border-slate-800" id="data-sub-tabs">
                <button
                  onClick={() => setDataSubTab("income")}
                  className={`py-1.5 px-3.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    dataSubTab === "income"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Weekly Income ({incomeEntries.length})
                </button>
                <button
                  onClick={() => setDataSubTab("mileage")}
                  className={`py-1.5 px-3.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    dataSubTab === "mileage"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Business Trips ({mileageEntries.length})
                </button>
                <button
                  onClick={() => setDataSubTab("expenses")}
                  className={`py-1.5 px-3.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    dataSubTab === "expenses"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/50 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Vehicle Expenses ({expenseEntries.length})
                </button>
              </div>

              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search logs by driver email or keywords..."
                  value={dataSearch}
                  onChange={(e) => setDataSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white placeholder-slate-450 dark:placeholder-slate-550 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                />
              </div>
            </div>

            {/* Selected Inner Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                
                {dataSubTab === "income" && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800">
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Driver Email</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Start Date</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Trips</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Online Hrs</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Net Fare</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Tips</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Total Earnings</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredIncome.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-450 dark:text-slate-500 font-semibold">
                            No income records found in SQLite database.
                          </td>
                        </tr>
                      ) : (
                        filteredIncome.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-350">{entry.userEmail}</td>
                            <td className="p-4 font-mono font-semibold">{formatDate(entry.startDate)}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{entry.trips}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{(entry.onlineMinutes / 60).toFixed(1)}h</td>
                            <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-450">{formatCurrency(entry.netFare)}</td>
                            <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-450">{formatCurrency(entry.tips)}</td>
                            <td className="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(entry.totalEarnings)}</td>
                            <td className="p-4 max-w-xs truncate text-slate-500 dark:text-slate-400" title={entry.notes}>{entry.notes || "—"}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteIncome(entry.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {dataSubTab === "mileage" && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800">
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Driver Email</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Purpose</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Start Odo</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">End Odo</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Distance</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Type</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredMileage.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-450 dark:text-slate-500 font-semibold">
                            No business trips found in SQLite database.
                          </td>
                        </tr>
                      ) : (
                        filteredMileage.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-350">{entry.userEmail}</td>
                            <td className="p-4 font-mono font-semibold">{formatDate(entry.date)}</td>
                            <td className="p-4 max-w-xs truncate text-slate-700 dark:text-slate-300 font-medium">{entry.purpose}</td>
                            <td className="p-4 text-right font-mono text-slate-500">{(entry.startOdometer / 10).toFixed(1)} km</td>
                            <td className="p-4 text-right font-mono text-slate-500">{(entry.endOdometer / 10).toFixed(1)} km</td>
                            <td className="p-4 text-right font-mono font-black text-blue-600 dark:text-blue-400">{(entry.distance / 10).toFixed(1)} km</td>
                            <td className="p-4 text-center">
                              <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                                {entry.tripType}
                              </span>
                            </td>
                            <td className="p-4 max-w-xs truncate text-slate-500 dark:text-slate-400" title={entry.notes}>{entry.notes || "—"}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteMileage(entry.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {dataSubTab === "expenses" && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800">
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Driver Email</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Amount</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">GST/HST Claim</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">GST/HST Amt</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-450 dark:text-slate-500 font-semibold">
                            No vehicle operating expenses found in SQLite database.
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="p-4 font-bold text-slate-700 dark:text-slate-350">{entry.userEmail}</td>
                            <td className="p-4 font-mono font-semibold">{formatDate(entry.date)}</td>
                            <td className="p-4">
                              <span className="inline-block bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-100 dark:border-amber-900/30">
                                {entry.category}
                              </span>
                            </td>
                            <td className="p-4 max-w-xs truncate text-slate-700 dark:text-slate-300 font-medium" title={entry.description}>{entry.description}</td>
                            <td className="p-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">{formatCurrency(entry.amount)}</td>
                            <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400">
                              {entry.gstHstEligible ? "Yes" : "No"}
                            </td>
                            <td className="p-4 text-right font-mono text-slate-500">{entry.gstHstAmount ? formatCurrency(entry.gstHstAmount) : "—"}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteExpense(entry.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

              </div>
            </div>
          </div>
        )}

      </div>

      {/* CREATE USER MODAL */}
      <AnimatePresence>
        {showAddUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs text-left" id="add-user-modal-container">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Create New Driver Account</h3>
                </div>
                <button onClick={() => setShowAddUserModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="addUserEmail" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">Email Address</label>
                  <input
                    id="addUserEmail"
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="driver@example.com"
                    className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="addUserPassword" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">Initial Password</label>
                  <input
                    id="addUserPassword"
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="addUserRole" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">Account Access Role</label>
                  <select
                    id="addUserRole"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs cursor-pointer"
                  >
                    <option value="user">User (Standard Driver Dashboard)</option>
                    <option value="admin">Admin (Full Database Access)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-350 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer border border-blue-700"
                    id="submit-create-user"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT USER MODAL */}
      <AnimatePresence>
        {showEditUserModal && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs text-left" id="edit-user-modal-container">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Configure User Profile</h3>
                </div>
                <button onClick={() => setShowEditUserModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="editUserEmail" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">Email Address</label>
                  <input
                    id="editUserEmail"
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="editUserPassword" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">
                    Reset Password <span className="text-[9px] font-semibold text-slate-400">(Leave empty to keep current)</span>
                  </label>
                  <input
                    id="editUserPassword"
                    type="password"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    placeholder="Enter new password if resetting"
                    className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="editUserRole" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">Account Access Role</label>
                  <select
                    id="editUserRole"
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value)}
                    className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-xs cursor-pointer"
                  >
                    <option value="user">User (Standard Driver Dashboard)</option>
                    <option value="admin">Admin (Full Database Access)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditUserModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-350 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer border border-blue-700"
                    id="submit-edit-user"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
