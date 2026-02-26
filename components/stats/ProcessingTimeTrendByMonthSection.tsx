"use client";

import { useEffect, useState } from "react";
import {
  getMedianProcessingTimeByApprovalMonth,
  MedianByApprovalMonthEntry,
} from "@/lib/statsService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ProcessingTimeTrendByMonthSection() {
  const [data, setData] = useState<MedianByApprovalMonthEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const entries = await getMedianProcessingTimeByApprovalMonth(6);
        setData(entries);
      } catch (error) {
        console.error("Error loading processing time trend by month:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartData = data.map((d) => ({
    name: d.month,
    medianDays: d.medianDays,
    count: d.count,
  }));

  return (
    <div className="uscis-card relative overflow-hidden">
      <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/5 dark:bg-teal-400/5 rounded-full -mr-14 -mt-14 blur-2xl" aria-hidden />
      <div className="relative uscis-card-header">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md flex-shrink-0">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
              Processing Time Trend by Approval Month
            </h3>
            <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
              Median days from filing to approval for cases approved each month (I-130). See if pace is changing.
            </p>
          </div>
        </div>
      </div>
      <div className="relative p-4 sm:p-6 min-w-0">
        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center text-[var(--text-secondary)] text-sm">
            <p>No trend data yet. Check back as more approvals are recorded.</p>
          </div>
        ) : (
          <div className="w-full h-56 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="trendBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14B8A6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                  label={{
                    value: "Median days",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "var(--text-secondary)" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Median days"]}
                  labelFormatter={(label) => label}
                />
                <Bar
                  dataKey="medianDays"
                  fill="url(#trendBarGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive
                  animationDuration={400}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
