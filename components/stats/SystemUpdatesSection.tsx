"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StarIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import {
  getSystemDailyStats,
  getSystemMonthlyStats,
  getRFEStats,
  getCurrentMonth,
} from "@/lib/statsService";
import { scopeFromProfile, buildScopeId } from "@/lib/types";
import { format } from "date-fns";
import USCISStatusAPIDebug from "@/components/USCISStatusAPIDebug";

interface SystemDailyStats {
  date: string;
  approvalsCount: number;
  approvalsCountYesterday?: number;
  priorityDateMovement?: number;
  activeCasesProcessed?: number;
  updatedAt: any;
}

interface SystemMonthlyStats {
  month: string;
  approvalsTotal: number;
  approvalsLastMonth?: number;
  dailyAverage: number;
  bestDay?: string;
  bestDayCount?: number;
  updatedAt: any;
}

interface RFEStats {
  scopeId: string;
  cohortSize: number;
  rfeCount: number;
  rfeRate: number;
  updatedAt: any;
}

export default function SystemUpdatesSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState<SystemDailyStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<SystemMonthlyStats | null>(null);
  const [rfeStats, setRfeStats] = useState<RFEStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Secret 7-tap debug trigger (hidden under the blue icon)
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showDebugView, setShowDebugView] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SECRET_CLICK_THRESHOLD = 7;
  const CLICK_TIMEOUT_MS = 3000; // 3 seconds

  const handleSecretClick = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    setSecretClickCount((prev) => {
      const newCount = prev + 1;
      console.log(`🔐 Secret click on System Updates icon: ${newCount}/${SECRET_CLICK_THRESHOLD}`);

      if (newCount >= SECRET_CLICK_THRESHOLD) {
        console.log("✅ Showing USCISStatusAPIDebug");
        setShowDebugView(true);
        setSecretClickCount(0);
        return 0;
      }

      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }

      clickTimeoutRef.current = setTimeout(() => {
        if (newCount < SECRET_CLICK_THRESHOLD) {
          setSecretClickCount(0);
          console.log("⏱️ Secret click count reset (timeout)");
        }
      }, CLICK_TIMEOUT_MS);

      return newCount;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Load user profile
  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    }

    loadProfile();
  }, [user]);

  // Load stats data
  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        // Load daily stats
        const today = new Date();
        const daily = await getSystemDailyStats(today);
        setDailyStats(daily);

        // Load monthly stats
        const currentMonth = getCurrentMonth();
        const monthly = await getSystemMonthlyStats(currentMonth);
        setMonthlyStats(monthly);

        // Load RFE stats if profile exists
        if (profile) {
          const scope = scopeFromProfile(
            profile.formType,
            profile.serviceCenter,
            profile.country
          );
          const scopeId = buildScopeId(scope);
          const rfe = await getRFEStats(scopeId);
          setRfeStats(rfe);
        }
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    if (profile !== null) {
      loadStats();
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      {showDebugView && (
        <USCISStatusAPIDebug onClose={() => setShowDebugView(false)} />
      )}
      {/* Section Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 active:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            onClick={handleSecretClick}
            aria-label="System Updates"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">System Updates</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Latest updates and movements in the system
            </p>
          </div>
        </div>
      </div>

      {/* Today's Update Card */}
      {dailyStats && <TodaysUpdateCard stats={dailyStats} />}

      {/* This Month Card */}
      {monthlyStats && <ThisMonthCard stats={monthlyStats} />}

      {/* Approval & RFE Card */}
      {rfeStats && rfeStats.cohortSize >= 20 && (
        <ApprovalRFECard stats={rfeStats} />
      )}
    </div>
  );
}

function TodaysUpdateCard({ stats }: { stats: SystemDailyStats }) {
  const formatDate = (dateString: string) => {
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">What Changed Today</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Latest updates and movements in the system
            </p>
          </div>
          <span className="text-xs text-[var(--text-secondary)] px-3 py-1 bg-[var(--bg-surface-alt)] rounded-full">
            {formatDate(stats.date)}
          </span>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* New Approvals */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-[var(--text-secondary)] mb-2">New Approvals</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">+{stats.approvalsCount}</p>
            {stats.approvalsCountYesterday !== undefined && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                <span
                  className={
                    stats.approvalsCount > stats.approvalsCountYesterday
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {stats.approvalsCount > stats.approvalsCountYesterday ? "↑" : "↓"}{" "}
                  {Math.abs(stats.approvalsCount - stats.approvalsCountYesterday)} from yesterday
                </span>
              </p>
            )}
          </div>

          {/* Priority Date Movement */}
          {stats.priorityDateMovement !== undefined && (
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-[var(--text-secondary)] mb-2">Priority Date Movement</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.priorityDateMovement > 0 ? "+" : ""}
                {stats.priorityDateMovement} days
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {stats.priorityDateMovement > 0
                  ? "Processing ahead of schedule"
                  : "Normal pace"}
              </p>
            </div>
          )}

          {/* Active Cases */}
          {stats.activeCasesProcessed !== undefined && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-[var(--text-secondary)] mb-2">Active Cases</p>
              <p className="text-2xl font-bold text-purple-600">{stats.activeCasesProcessed}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Processed in last 24 hours
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThisMonthCard({ stats }: { stats: SystemMonthlyStats }) {
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">This Month</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{formatMonth(stats.month)}</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-2">Total Approvals</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.approvalsTotal}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-2">Daily Average</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.dailyAverage.toFixed(1)}
            </p>
          </div>
        </div>

        {stats.approvalsLastMonth !== undefined && (
          <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <span
                className={
                  stats.approvalsTotal > stats.approvalsLastMonth
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {stats.approvalsTotal > stats.approvalsLastMonth ? "↑" : "↓"}
              </span>
              <span className="text-sm text-[var(--text-primary)]">
                {((stats.approvalsTotal - stats.approvalsLastMonth) / stats.approvalsLastMonth) *
                  100 >
                0
                  ? "+"
                  : ""}
                {(
                  ((stats.approvalsTotal - stats.approvalsLastMonth) / stats.approvalsLastMonth) *
                  100
                ).toFixed(1)}
                % vs last month
              </span>
            </div>
          </div>
        )}

        {stats.bestDay && stats.bestDayCount && (
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <StarIcon className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-[var(--text-primary)]">
                Best day: {formatBestDay(stats.bestDay)} with {stats.bestDayCount} approvals
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalRFECard({ stats }: { stats: RFEStats }) {
  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Approval & RFE</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Risk analysis for similar cases
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-2">Cohort Size</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.cohortSize}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-2">RFE Count</p>
            <p className="text-2xl font-bold text-red-600">{stats.rfeCount}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-[var(--text-secondary)] mb-2">RFE Rate</p>
            <p className="text-2xl font-bold text-red-600">
              {(stats.rfeRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {stats.cohortSize < 30 && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-[var(--text-secondary)]">
                Small sample size - results may vary
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
