import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, X, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (oldPassword === newPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setSuccess("Your account password has been updated successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs" id="change-password-modal-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-250 dark:border-slate-800 overflow-hidden animate-in fade-in"
        id="change-password-modal-card"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Lock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Change Account Password
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                Security Settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer font-semibold text-xs"
            id="close-password-modal-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" id="change-password-form">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/40 flex items-start gap-3" id="password-error-box">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-350 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/25 p-4 border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-3" id="password-success-box">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-700 dark:text-emerald-355 font-medium leading-relaxed">{success}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="oldPassword" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">
              Current Password
            </label>
            <input
              id="oldPassword"
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xs"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xs"
              placeholder="Min. 6 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-400">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xs"
              placeholder="Re-enter new password"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-350 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 border border-blue-700"
              id="submit-password-change"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
