"use client";

import { useEffect, useState } from "react";
import { getWeeklyApprovalBreakdown } from "@/lib/statsService";
import { WeeklyApprovalData } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

export default function WeeklyApprovalBreakdownSection() {
  const [data, setData] = useState<WeeklyApprovalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const breakdown = await getWeeklyApprovalBreakdown();
      setData(breakdown);
      const totalI129F = breakdown.reduce((sum, d) => sum + d.i129f, 0);
      const totalI130 = breakdown.reduce((sum, d) => sum + d.i130, 0);
      console.log(`[WeeklyApprovalBreakdown] Loaded ${breakdown.length} days of data, I-130: ${totalI130}, I-129F: ${totalI129F}`);
      
      // Debug: Log the breakdown data
      if (breakdown.length > 0) {
        console.log(`[WeeklyApprovalBreakdown] Full breakdown:`, breakdown);
      } else {
        console.warn(`[WeeklyApprovalBreakdown] No data returned from getWeeklyApprovalBreakdown`);
      }
    } catch (error) {
      console.error("Error loading weekly approval breakdown:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const chartData = data.map((item) => ({
    date: format(new Date(item.date), "MMM dd"),
    "I-130": item.i130,
    "I-129F": item.i129f,
  }));

  return (
    <div className="space-y-6">
      {/* Section Header - More Impactful */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center shadow-md">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
                  Daily Approval Activity This Week
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  See exactly how many cases got approved each day. Watch the pattern to know when approvals typically happen.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors flex-shrink-0"
                title="Refresh data"
              >
                <svg 
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>
        
      </div>

      {/* Chart */}
      <div className="uscis-card">
        <div className="p-6 min-h-[300px] min-w-0">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-[var(--text-secondary)]">Loading data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-3">
              <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No Approval Data Yet</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Weekly approval data will appear here once available. Check back soon!
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full min-h-[350px]">
              <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="i130Gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.9}/>
                  </linearGradient>
                  <linearGradient id="i129fGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
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
                <Legend 
                  wrapperStyle={{ paddingTop: 20 }}
                  iconType="square"
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                      {value === "I-130" ? "🔵 I-130" : "🟣 I-129F"}
                    </span>
                  )}
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
                <Bar 
                  dataKey="I-130" 
                  fill="url(#i130Gradient)" 
                  name="I-130"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={600}
                />
                <Bar 
                  dataKey="I-129F" 
                  fill="url(#i129fGradient)" 
                  name="I-129F"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={600}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
