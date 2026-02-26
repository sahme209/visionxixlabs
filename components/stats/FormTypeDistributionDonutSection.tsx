"use client";

import { useEffect, useState } from "react";
import { getWeeklyApprovalBreakdown } from "@/lib/statsService";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface FormTypeData {
  name: string;
  value: number;
  color: string;
}

export default function FormTypeDistributionDonutSection() {
  const [data, setData] = useState<FormTypeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const breakdown = await getWeeklyApprovalBreakdown();
        const totalI130 = breakdown.reduce((s, d) => s + d.i130, 0);
        const totalI129f = breakdown.reduce((s, d) => s + d.i129f, 0);

        const result: FormTypeData[] = [];
        if (totalI130 > 0) {
          result.push({ name: "I-130", value: totalI130, color: "#3B82F6" });
        }
        if (totalI129f > 0) {
          result.push({ name: "I-129F", value: totalI129f, color: "#8B5CF6" });
        }
        setData(result);
      } catch (error) {
        console.error("Error loading form type distribution:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center shadow-lg flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
            Form Type Split
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            I-130 vs I-129F volume in recent approvals. See the overall blend of case types.
          </p>
        </div>
      </div>

      <div className="uscis-card p-4 sm:p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-[var(--text-tertiary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-primary)]">No data yet</p>
            <p className="text-xs text-[var(--text-secondary)]">Form type split will appear once data is available.</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full max-w-[280px] h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data as { name: string; value: number }[]}
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--bg-surface)"
                    strokeWidth={3}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {data.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value, name) => {
                      const v = typeof value === "number" ? value : 0;
                      return [`${v} (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`, name ?? ""];
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    formatter={(value) => (
                      <span className="text-sm font-medium text-[var(--text-secondary)]">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-semibold text-[var(--text-primary)]">I-130</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Family-based petitions. {data.find((d) => d.name === "I-130")?.value ?? 0} approvals in period (
                  {total > 0 ? (((data.find((d) => d.name === "I-130")?.value ?? 0) / total) * 100).toFixed(1) : 0}%)
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="font-semibold text-[var(--text-primary)]">I-129F</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Fiancé(e) visas. {data.find((d) => d.name === "I-129F")?.value ?? 0} approvals in period (
                  {total > 0 ? (((data.find((d) => d.name === "I-129F")?.value ?? 0) / total) * 100).toFixed(1) : 0}%)
                </p>
              </div>
              <p className="text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-color)]">
                Based on recent weekly data. Total: <strong>{total}</strong> approvals
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
