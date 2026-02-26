"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getI129FApprovalDataByDate,
  getApprovalTrendSummary,
} from "@/lib/statsService";
import { ApprovalData, ApprovalTrendSummary } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function I129FApprovalTrendsSection() {
  const [data, setData] = useState<ApprovalData[]>([]);
  const [summary, setSummary] = useState<ApprovalTrendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] =
    useState<"7D" | "30D" | "90D" | "1Y">("90D");
  const [refreshing, setRefreshing] = useState(false);

  // Helper to add per-call timeout to async operations
  const withTimeout = useCallback(
    async <T,>(p: Promise<T>, label: string, ms: number = 15000): Promise<T> => {
      return Promise.race<T>([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout ${ms}ms: ${label}`)),
            ms
          )
        ),
      ]);
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const daysBack =
        selectedRange === "7D"
          ? 7
          : selectedRange === "30D"
          ? 30
          : selectedRange === "90D"
          ? 90
          : 365;

      const [approvalData, trendSummary] = await Promise.all([
        withTimeout(
          getI129FApprovalDataByDate(daysBack),
          `getI129FApprovalDataByDate(${daysBack})`
        ),
        withTimeout(
          getApprovalTrendSummary("I-129F", daysBack),
          `getApprovalTrendSummary(I-129F, ${daysBack})`
        ),
      ]);

      setData(approvalData);
      setSummary(trendSummary);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[I129FApprovalTrends] Error loading I-129F approval trends:", error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    loadData();
  }, [selectedRange, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const chartData = data.map((item) => {
    try {
      const formattedDate = format(new Date(item.date), "MMM dd");
      return {
        date: formattedDate,
        approvals: item.approvals,
      };
    } catch {
      return {
        date: String(item.date),
        approvals: item.approvals,
      };
    }
  });

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "text-green-600";
      case "decreasing":
        return "text-slate-600 dark:text-slate-400";
      default:
        return "text-[var(--text-secondary)]";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "↑";
      case "decreasing":
        return "↓";
      default:
        return "→";
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      {/* Section Header - Compact on Mobile */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
              <span className="hidden sm:inline">I-129F Approval Trend Over Time</span>
              <span className="sm:hidden">I-129F Trends</span>
            </h3>
            <p className="text-[10px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
              <span className="hidden sm:inline">Daily approval trends for fiancé visas.</span>
              <span className="sm:hidden">Fiancé visa trends</span>
            </p>
          </div>
        </div>
      </div>

      {/* Range Selector and Refresh - Compact */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex gap-1.5 sm:gap-2">
          {(["7D", "30D", "90D", "1Y"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                selectedRange === range
                  ? "bg-[var(--uscis-blue)] text-white"
                  : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2 transition-colors"
        >
          <svg 
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Summary Cards - Enhanced Design */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-1">Total Approvals</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{summary.total.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border border-green-200 dark:border-green-800 shadow-sm">
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-1">Daily Average</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{summary.average}/day</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-1">Peak Day</p>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{summary.peak.count}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-medium">
              {format(new Date(summary.peak.date), "MMM d")}
            </p>
          </div>
          <div className={`p-4 rounded-xl border shadow-sm ${
            summary.trend === "increasing" 
              ? "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800"
              : summary.trend === "decreasing"
              ? "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 border-slate-200 dark:border-slate-800"
              : "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800"
          }`}>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-1">Trend</p>
            <p className={`text-2xl sm:text-3xl font-bold ${getTrendColor(summary.trend)}`}>
              {getTrendIcon(summary.trend)}
            </p>
            <p className="text-[10px] mt-1 font-bold text-[var(--text-primary)]">
              {summary.last7DaysDelta > 0 ? "+" : ""}
              {summary.last7DaysDelta}%
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="uscis-card">
        <div className="p-3 sm:p-4 md:p-6 min-h-[250px] sm:min-h-[300px] min-w-0">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Loading I-129F (fiancé visa) approval trends...
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="i129fGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    width={60}
                    allowDecimals={false}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                    label={{
                      value: "Approvals",
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle", fontSize: 11, fill: "var(--text-secondary)", fontWeight: 500 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "transparent",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    boxShadow: "none",
                  }}
                  labelStyle={{ display: "none" }}
                  itemStyle={{
                    padding: 0,
                    margin: 0,
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                  formatter={(value: any) => value}
                  separator=""
                />
                <Line
                  type="monotone"
                  dataKey="approvals"
                  stroke="#A855F7"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, fill: "#A855F7", strokeWidth: 1, stroke: "#fff", opacity: 0.8 }}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
