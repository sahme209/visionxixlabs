"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import {
  getApprovalsByPriorityDateMonth,
  type ApprovalsByPDMonthPoint,
} from "@/lib/statsService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const BAR_COLOR_USER = "#10B981"; // emerald – your PD month
const BAR_RADIUS = 6;

export default function ApprovalsByPriorityDateChartSection() {
  const { profile } = useProfile();
  const [data, setData] = useState<ApprovalsByPDMonthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"30D" | "60D" | "90D">("60D");

  const formType =
    profile?.formType === "I-129F" || profile?.formType === "I-130"
      ? profile.formType
      : "I-130";

  const userPDMonth = profile?.priorityDate
    ? (() => {
        const d = new Date(profile.priorityDate);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        return `${y}-${String(m).padStart(2, "0")}`;
      })()
    : null;

  useEffect(() => {
    let mounted = true;
    const days = range === "30D" ? 30 : range === "60D" ? 60 : 90;
    setLoading(true);
    getApprovalsByPriorityDateMonth(formType, days)
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch(() => {
        if (mounted) setData([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [formType, range]);

  const chartData = data.map((d) => ({
    ...d,
    isUserMonth: userPDMonth !== null && d.month === userPDMonth,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--uscis-blue)] to-blue-800 flex items-center justify-center shadow-lg flex-shrink-0">
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Approvals by priority date month
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Which priority date months are being approved in the last {range === "30D" ? "30" : range === "60D" ? "60" : "90"} days. See if your month is in the current batch.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(["30D", "60D", "90D"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-[var(--uscis-blue)] text-white"
                  : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="uscis-card p-4 sm:p-6 overflow-hidden min-w-0">
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center">
            <svg
              className="w-12 h-12 text-[var(--text-tertiary)] mb-2"
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
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No data yet
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Approval data by priority date month will appear once data is available.
            </p>
          </div>
        ) : (
          <div className="w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient
                    id="pdBarGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#0071e3" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0071e3" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient
                    id="pdBarUserGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-color)"
                  opacity={0.2}
                  vertical={false}
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  width={42}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  cursor={{ fill: "var(--bg-surface-alt)", opacity: 0.5 }}
                  formatter={(value: number | undefined) => [
                    `${value ?? 0} approval${(value ?? 0) === 1 ? "" : "s"}`,
                    "",
                  ]}
                  labelFormatter={(label, payload) => {
                    const p = payload[0]?.payload as typeof chartData[0];
                    const suffix =
                      p?.isUserMonth ? " (your PD month)" : "";
                    return `${label}${suffix}`;
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Approvals"
                  radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
                  maxBarSize={48}
                  isAnimationActive
                  animationDuration={600}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.month}
                      fill={entry.isUserMonth ? "url(#pdBarUserGrad)" : "url(#pdBarGrad)"}
                      stroke={entry.isUserMonth ? "#059669" : undefined}
                      strokeWidth={entry.isUserMonth ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-3">
              <span>
                <strong className="text-[var(--text-primary)]">
                  {chartData.reduce((s, d) => s + d.count, 0)}
                </strong>{" "}
                approvals in period
              </span>
              {userPDMonth && chartData.some((d) => d.month === userPDMonth) && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: BAR_COLOR_USER }}
                    aria-hidden
                  />
                  Your PD month highlighted
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
