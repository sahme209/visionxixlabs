"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { getI130ApprovalDataByDate, getApprovalTrendSummary } from "@/lib/statsService";
import { ApprovalData, ApprovalTrendSummary } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format, differenceInDays } from "date-fns";

export default function ApprovalTrendsI130Section() {
  const { profile } = useProfile();
  const [data, setData] = useState<ApprovalData[]>([]);
  const [summary, setSummary] = useState<ApprovalTrendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<"7D" | "30D" | "90D">("90D");
  
  // Calculate user's case age for reference line
  const userCaseAge = profile?.priorityDate 
    ? Math.floor(differenceInDays(new Date(), new Date(profile.priorityDate)))
    : null;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const daysBack = selectedRange === "7D" ? 7 : selectedRange === "30D" ? 30 : 90;
        const [approvalData, trendSummary] = await Promise.all([
          getI130ApprovalDataByDate(daysBack),
          getApprovalTrendSummary("I-130", daysBack),
        ]);
        setData(approvalData);
        setSummary(trendSummary);
      } catch (error) {
        console.error("Error loading approval trends:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedRange]);

  const chartData = data.map((item) => ({
    date: format(new Date(item.date), "MMM dd"),
    approvals: item.approvals,
  }));

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
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center shadow-md flex-shrink-0">
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
              <span className="hidden sm:inline">I-130 Approval Trend Over Time</span>
              <span className="sm:hidden">I-130 Trends</span>
            </h3>
            <p className="text-[10px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
              <span className="hidden sm:inline">Daily approval trends. {userCaseAge !== null && `Your case: ${userCaseAge} days`}</span>
              <span className="sm:hidden">{userCaseAge !== null ? `${userCaseAge}d` : "Daily trends"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Range Selector - Compact */}
      <div className="flex gap-1.5 sm:gap-2">
        {(["7D", "30D", "90D"] as const).map((range) => (
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

      {/* Summary Cards - Enhanced Design */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
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
              : "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800"
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
                <p className="text-sm text-[var(--text-secondary)]">Loading I-130 approval trends...</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-[var(--text-secondary)]">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No I-130 Approval Data Yet</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      I-130 approval trends will appear here once we have data for the selected period. Try a different time range or check back soon!
                    </p>
                  </div>
                </div>
              </p>
            </div>
          ) : (
            <div className="w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="approvalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--uscis-blue)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--uscis-blue)" stopOpacity={0}/>
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
                  wrapperStyle={{
                    zIndex: 1000,
                  }}
                  formatter={(value: any) => value}
                  separator=""
                />
                <Line
                  type="monotone"
                  dataKey="approvals"
                  stroke="var(--uscis-blue)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--uscis-blue)", strokeWidth: 1, stroke: "#fff", opacity: 0.8 }}
                  name="Daily Approvals"
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                {userCaseAge !== null && chartData.length > 0 && (
                  <ReferenceLine 
                    x={chartData[Math.max(0, Math.floor(chartData.length * 0.7))]?.date || chartData[0]?.date} 
                    stroke="#DC2626" 
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    label={{ 
                      value: `Your case: ${userCaseAge} days`, 
                      position: "top", 
                      fill: "#DC2626", 
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
