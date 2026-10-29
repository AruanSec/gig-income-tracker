import React, { useState } from "react";
import { ShieldCheck, Mail, Lock, LogIn, AlertCircle, Sun, Moon } from "lucide-react";
import { motion } from "motion/react";

interface AuthViewProps {
  onAuthSuccess: (email: string) => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
}

export default function AuthView({ onAuthSuccess, theme, toggleTheme }: AuthViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onAuthSuccess(data.email);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 relative lg:px-8 transition-colors duration-300" id="auth-page">
      {/* Theme Toggle for Login Page */}
      {toggleTheme && theme && (
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleTheme}
            className="p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            id="login-theme-toggle"
          >
            {theme === "light" ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
          </button>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center" id="auth-logo-container">
          <div className="h-14 w-14 rounded-2xl bg-teal-900 flex items-center justify-center text-emerald-100 shadow-lg shadow-teal-900/20 dark:shadow-none">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight" id="auth-title">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          Your earnings, mileage, and planning records are ready when you are.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          layout 
          className="auth-card bg-white dark:bg-slate-900 py-8 px-6 shadow-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:px-10"
          id="auth-card"
        >
          <form className="space-y-6" onSubmit={handleSubmit} id="auth-form">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/50 flex items-start gap-3" id="auth-error-box">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Email Address
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>


            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-teal-900 rounded-xl shadow-xs text-sm font-bold text-white bg-teal-900 hover:bg-teal-800 active:bg-teal-950 transition-all cursor-pointer disabled:opacity-50"
                id="auth-submit-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Processing...
                  </span>
                ) : (
                  <><LogIn className="h-4 w-4" /><span>Sign In</span></>
                )}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">Contact your administrator to create an account.</p>
        </motion.div>
      </div>
    </div>
  );
}
