import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Brain,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertCircle,
  Lightbulb,
  Zap,
  Award,
  ChevronRight,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import { IncomeEntry } from "../types";
import { formatCurrency } from "../utils";

interface EarningsAIInsightsProps {
  entries: IncomeEntry[];
}

interface KeyInsight {
  title: string;
  observation: string;
  impact: string;
}

interface ActionableSuggestion {
  category: string;
  title: string;
  recommendation: string;
  expectedBenefit: string;
}

interface AnalysisResult {
  weeklyTrendSummary: string;
  efficiencyRating: string;
  averageHourlyRate: number;
  peakPerformingDayOrShift: string;
  keyInsights: KeyInsight[];
  actionableSuggestions: ActionableSuggestion[];
}

export default function EarningsAIInsights({ entries }: EarningsAIInsightsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"suggestions" | "insights">("suggestions");

  const runAnalysis = async () => {
    if (!entries || entries.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("gig_auth_token");
      const res = await fetch("/api/insights/earnings-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to analyze earnings trends");
      }

      const data: AnalysisResult = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while calling the Gemini API.");
    } finally {
      setLoading(false);
    }
  };

  // Run analysis automatically on first load if entries exist and analysis is not present
  useEffect(() => {
    if (entries && entries.length > 0 && !analysis && !loading && !error) {
      runAnalysis();
    }
  }, [entries]);

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-left">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">AI Weekly Earnings & Trend Analysis</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Log at least one shift entry above to unlock Gemini AI driver efficiency suggestions and weekly trend insights.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6 text-left relative overflow-hidden" id="gemini-earnings-insights-card">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/20 text-white shrink-0 mt-0.5">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Gemini AI Weekly Earnings & Efficiency Analysis
              </h3>
              <span className="text-[10px] font-extrabold font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" /> AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analyzing logged hours, trip counts, fares, and tips to maximize your hourly revenue
            </p>
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto shadow-xs"
          id="refresh-ai-analysis-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Analyzing Logs..." : "Refresh AI Analysis"}</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-8 space-y-4 animate-pulse relative z-10">
          <div className="h-4 bg-slate-800 rounded-md w-3/4" />
          <div className="h-4 bg-slate-800 rounded-md w-1/2" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="h-20 bg-slate-800/60 rounded-2xl" />
            <div className="h-20 bg-slate-800/60 rounded-2xl" />
            <div className="h-20 bg-slate-800/60 rounded-2xl" />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-center justify-between gap-3 text-rose-300 text-xs relative z-10">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={runAnalysis}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-white text-[11px] font-bold rounded-lg transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Analysis Content */}
      {analysis && !loading && (
        <div className="space-y-6 relative z-10">
          
          {/* Executive Rating & Top KPI Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-400" /> Efficiency Score
              </span>
              <div className="mt-2">
                <span className="text-xl font-black text-emerald-400 font-mono block">
                  {analysis.efficiencyRating}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Based on active vs online hours ratio
                </span>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Average Revenue / Hour
              </span>
              <div className="mt-2">
                <span className="text-xl font-black text-blue-400 font-mono block">
                  {formatCurrency(analysis.averageHourlyRate)} / hr
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Calculated per online hour
                </span>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Peak Performing Window
              </span>
              <div className="mt-2">
                <span className="text-sm font-bold text-amber-300 block line-clamp-2">
                  {analysis.peakPerformingDayOrShift}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Highest hourly earnings pattern
                </span>
              </div>
            </div>
          </div>

          {/* Trend Summary Quote */}
          <div className="p-4 bg-purple-950/30 border border-purple-800/40 rounded-2xl">
            <p className="text-xs text-purple-100 leading-relaxed italic">
              "{analysis.weeklyTrendSummary}"
            </p>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveSubTab("suggestions")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
                activeSubTab === "suggestions"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
              <span>Actionable Suggestions ({analysis.actionableSuggestions.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("insights")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
                activeSubTab === "insights"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trend Observations ({analysis.keyInsights.length})</span>
            </button>
          </div>

          {/* Suggestions Tab */}
          {activeSubTab === "suggestions" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.actionableSuggestions.map((sugg, idx) => (
                <div
                  key={idx}
                  className="bg-slate-850/80 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-4 space-y-2 transition flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-full font-mono">
                        {sugg.category}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full font-mono">
                        {sugg.expectedBenefit}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white pt-1">
                      {sugg.title}
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {sugg.recommendation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Recommended action for next driving shift</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Insights Tab */}
          {activeSubTab === "insights" && (
            <div className="space-y-3">
              {analysis.keyInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="bg-slate-850/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      {insight.title}
                    </h4>
                    <p className="text-xs text-slate-300">
                      {insight.observation}
                    </p>
                  </div>

                  <div className="px-3 py-1.5 bg-slate-800 rounded-xl border border-slate-700/80 text-[11px] font-semibold text-purple-200 shrink-0 self-start sm:self-auto font-mono">
                    Impact: {insight.impact}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
