"use client";

import { useEffect, useState } from "react";
import { getBacklogByServiceCenter } from "@/lib/statsService";
import { BacklogByCenterEntry } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const APPROVALS_COLOR = "#10B981";
const BACKLOG_COLOR = "#0071e3";
const BACKLOG_GRADIENT_ID = "backlogGradient";
const APPROVALS_GRADIENT_ID = "approvalsGradient";

export default function USCISBacklogSection() {
  const [data, setData] = useState<BacklogByCenterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const entries = await getBacklogByServiceCenter();
        setData(entries);
      } catch (error) {
        console.error("Error loading USCIS backlog:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartData = data.map((d) => ({
    name: d.name,
    "Approvals (30d)": d.approvals30d,
    "Est. backlog": d.estimatedBacklog,
  }));

  const maxVal = Math.max(
    ...chartData.flatMap((d) => [d["Approvals (30d)"], d["Est. backlog"]]),
    1
  );

  return (
    <div className="uscis-card border-2 border-[var(--uscis-blue)]/20 bg-gradient-to-br from-slate-50/50 via-white to-blue-50/50 dark:from-slate-900/10 dark:via-[var(--bg-surface)] dark:to-blue-900/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-28 h-28 bg-[var(--uscis-blue)]/5 rounded-full -mr-14 -mt-14 blur-2xl" aria-hidden />
      <div className="relative p-2.5 sm:p-6">
        {/* Header - same weight as Approval Countdown */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
          <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[var(--uscis-blue)] to-indigo-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg
              className="w-4 h-4 sm:w-7 sm:h-7 text-white"
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
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] mb-0 sm:mb-1">
              USCIS backlog by service center
            </h3>
            <p className="text-[10px] sm:text-sm text-[var(--text-secondary)] hidden sm:block">
              Estimated cases in pipeline and approvals in the last 30 days—from real approval data.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="min-h-[320px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--uscis-blue)] border-t-transparent" />
              <p className="text-sm text-[var(--text-secondary)]">Loading backlog estimates...</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="min-h-[320px] flex items-center justify-center">
            <div className="text-center space-y-2 p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">No backlog data yet</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Estimates will appear as more approval data is collected.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full min-h-[320px] sm:min-h-[350px] min-w-0">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id={APPROVALS_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id={BACKLOG_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0071e3" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1E88E5" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.25} />
                  <XAxis
                    type="number"
                    domain={[0, Math.ceil(maxVal * 1.1)]}
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={72}
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                    labelStyle={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}
                    formatter={(value, name) => [
                      (value ?? 0).toLocaleString(),
                      name === "Approvals (30d)" ? "Approvals (30 days)" : "Est. backlog (in pipeline)",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 8 }}
                    iconType="square"
                    iconSize={10}
                    formatter={(value) =>
                      value === "Approvals (30d)"
                        ? "Approvals (30 days)"
                        : "Est. backlog (in pipeline)"
                    }
                    style={{ fontSize: 11 }}
                  />
                  <Bar
                    dataKey="Approvals (30d)"
                    fill={`url(#${APPROVALS_GRADIENT_ID})`}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                    isAnimationActive
                    animationDuration={500}
                  />
                  <Bar
                    dataKey="Est. backlog"
                    fill={`url(#${BACKLOG_GRADIENT_ID})`}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                    isAnimationActive
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] mt-2 sm:mt-3 text-center">
              Est. backlog = approvals in last 30 days × (median processing days ÷ 30). Based on I-130 & I-129F approval data.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
