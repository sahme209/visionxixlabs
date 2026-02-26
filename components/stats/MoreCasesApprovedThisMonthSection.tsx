"use client";

import React from "react";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { StarIcon } from "@heroicons/react/24/solid";
import { SystemMonthlyStats } from "@/lib/types";
import { getSystemMonthlyStats } from "@/lib/statsService";

export default function MoreCasesApprovedThisMonthSection() {
  const [monthlyStats, setMonthlyStats] = useState<SystemMonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const formatter = new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          month: "2-digit",
        });
        const currentMonth = formatter.format(new Date());
        const stats = await getSystemMonthlyStats(currentMonth);
        setMonthlyStats(stats);
      } catch (error) {
        console.error("Error loading monthly stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="uscis-card min-h-[260px] flex flex-col">
        <div className="uscis-card-header">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">More Cases Approved This Month</h3>
        </div>
        <div className="p-6 flex-1 flex items-center justify-center">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
            <p className="text-sm text-[var(--text-secondary)]">Loading this month's approval statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!monthlyStats || monthlyStats.approvalsTotal === 0) {
    return (
      <div className="uscis-card min-h-[260px] flex flex-col">
        <div className="uscis-card-header">
          <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">More Cases Approved This Month</h3>
        </div>
        <div className="p-4 sm:p-6 flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <svg className="w-12 h-12 text-[var(--text-tertiary)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">No data available for this period</p>
            <p className="text-xs sm:text-sm text-[var(--text-tertiary)]">Check back later for updates</p>
          </div>
        </div>
      </div>
    );
  }

  const formatMonth = (monthString: string) => {
    try {
      const [year, month] = monthString.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, "MMMM yyyy");
    } catch {
      return monthString;
    }
  };

  const formatBestDay = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return format(date, "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-start gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-green-600 flex items-center justify-center shadow-md flex-shrink-0">
            <StarIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              This Month's Approval Activity
            </h3>
            <p className="text-[10px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed mb-1 sm:mb-2">
              <span className="hidden sm:inline">{formatMonth(monthlyStats.month)} - See how many cases got approved this month compared to last month</span>
              <span className="sm:hidden">{formatMonth(monthlyStats.month)}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4">
          <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] mb-1 sm:mb-2">
              <span className="hidden sm:inline">Total Approvals</span>
              <span className="sm:hidden">Total</span>
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">{monthlyStats.approvalsTotal.toLocaleString()}</p>
            <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] mt-0.5 sm:mt-1">
              <span className="hidden sm:inline">cases approved in {formatMonth(monthlyStats.month)}</span>
              <span className="sm:hidden">in {formatMonth(monthlyStats.month)}</span>
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] mb-1 sm:mb-2">
              <span className="hidden sm:inline">Daily Average</span>
              <span className="sm:hidden">Average</span>
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
              {monthlyStats.dailyAverage.toFixed(1)}
            </p>
            <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] mt-0.5 sm:mt-1">
              <span className="hidden sm:inline">approvals per day on average</span>
              <span className="sm:hidden">per day</span>
            </p>
          </div>
        </div>

        {monthlyStats.approvalsLastMonth !== undefined && (
          <div className={`p-4 rounded-lg mb-4 border-l-4 ${
            monthlyStats.approvalsTotal > monthlyStats.approvalsLastMonth
              ? "bg-green-50 dark:bg-green-900/20 border-green-500"
              : "bg-red-50 dark:bg-red-900/20 border-red-500"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-2xl ${
                  monthlyStats.approvalsTotal > monthlyStats.approvalsLastMonth
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {monthlyStats.approvalsTotal > monthlyStats.approvalsLastMonth ? "↑" : "↓"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {((monthlyStats.approvalsTotal - monthlyStats.approvalsLastMonth) /
                    monthlyStats.approvalsLastMonth) *
                    100 >
                  0
                    ? "+"
                    : ""}
                  {(
                    ((monthlyStats.approvalsTotal - monthlyStats.approvalsLastMonth) /
                      monthlyStats.approvalsLastMonth) *
                    100
                  ).toFixed(1)}
                  % vs last month
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {monthlyStats.approvalsTotal > monthlyStats.approvalsLastMonth
                    ? "More approvals than last month - things are speeding up! ⚡"
                    : "Fewer approvals than last month - processing may be slowing down ⚠️"}
                </p>
              </div>
            </div>
          </div>
        )}

        {monthlyStats.bestDay && monthlyStats.bestDayCount && (
          <div className="p-4 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-lg border-l-4 border-[var(--uscis-blue)]">
            <div className="flex items-center gap-2">
              <StarIcon className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)] mb-0.5">
                  Best Day This Month
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {formatBestDay(monthlyStats.bestDay)} had {monthlyStats.bestDayCount} approvals - the busiest day!
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
