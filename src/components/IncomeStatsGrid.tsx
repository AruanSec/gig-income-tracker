import React from "react";
import { DollarSign, Clock, Navigation, Flame, Star } from "lucide-react";
import { motion } from "motion/react";
import { IncomeStats } from "../types";
import { formatCurrency, formatDuration } from "../utils";

interface IncomeStatsGridProps {
  stats: IncomeStats;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

export default function IncomeStatsGrid({ stats }: IncomeStatsGridProps) {
  const tipRatio = stats.totalNetFare > 0 
    ? (stats.totalTips / stats.totalNetFare) * 100 
    : 0;

  const activeEfficiency = stats.totalOnlineMinutes > 0 
    ? (stats.totalActiveMinutes / stats.totalOnlineMinutes) * 100 
    : 0;

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      id="stats-grid"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      
      {/* Primary Hero Card - Total Earnings */}
      <motion.div
        variants={cardVariants}
        className="p-5 bg-teal-950 dark:bg-teal-950 rounded-2xl border border-teal-900 shadow-lg shadow-teal-950/10 flex flex-col justify-between relative overflow-hidden group hover:border-teal-700 transition duration-350"
      >
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-300/20 rounded-full blur-xl group-hover:scale-125 transition duration-500"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-100/75 uppercase tracking-wider">
              Total Net Income
            </span>
            <div className="p-1.5 bg-white/10 rounded-lg border border-white/15">
              <DollarSign className="w-4 h-4 text-emerald-200" />
            </div>
          </div>
          <h4 className="text-3xl font-bold tracking-tight text-white mt-4 font-mono">
            {formatCurrency(stats.totalEarnings)}
          </h4>
        </div>
        <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100/75 relative z-10">
          <span>Fare: {formatCurrency(stats.totalNetFare)}</span>
          <span className="text-emerald-200 font-semibold">
            + {formatCurrency(stats.totalTips)} tips
          </span>
        </div>
      </motion.div>

      {/* Hourly Earnings Rate */}
      <motion.div
        variants={cardVariants}
        className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-350"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Avg. Hourly Rate
            </span>
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
              <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
          </div>
          <h4 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mt-4 font-mono">
            {formatCurrency(stats.averageEarningsPerHourOnline)}
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">/ hr</span>
          </h4>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Online: {formatDuration(stats.totalOnlineMinutes)}</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {formatCurrency(stats.averageEarningsPerHourActive)}/hr active
          </span>
        </div>
      </motion.div>

      {/* Average Earnings per Trip */}
      <motion.div
        variants={cardVariants}
        className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-350"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Avg. Per Trip
            </span>
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
              <Navigation className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
          </div>
          <h4 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mt-4 font-mono">
            {formatCurrency(stats.averageEarningsPerTrip)}
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">/ trip</span>
          </h4>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Total Trips: {stats.totalTrips}</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {stats.totalTrips > 0 ? (stats.totalOnlineMinutes / stats.totalTrips).toFixed(0) : 0} min / trip
          </span>
        </div>
      </motion.div>

      {/* Active Duty Efficiency */}
      <motion.div
        variants={cardVariants}
        className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-350"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Time Utilization
            </span>
            <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
              <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
          <h4 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mt-4 font-mono">
            {activeEfficiency.toFixed(1)}%
          </h4>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Active: {formatDuration(stats.totalActiveMinutes)}</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-450 text-amber-500" /> {tipRatio.toFixed(0)}% tips ratio
          </span>
        </div>
      </motion.div>

    </motion.div>
  );
}

