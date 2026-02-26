"use client";

import { useEffect, useState } from "react";
import {
  getI130ApprovalDataByDate,
  getI129FApprovalDataByDate,
} from "@/lib/statsService";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays } from "date-fns";

interface CumulativePoint {
  date: string;
  dateLabel: string;
  i130: number;
  i129f: number;
  total: number;
  cumulativeI130: number;
  cumulativeI129f: number;
  cumulative: number;
}

export default function CumulativeApprovalsCurveSection() {
  const [data, setData] = useState<CumulativePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"30D" | "60D" | "90D">("90D");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const days = range === "30D" ? 30 : range === "60D" ? 60 : 90;
        const [i130Data, i129fData] = await Promise.all([
          getI130ApprovalDataByDate(days),
          getI129FApprovalDataByDate(days),
        ]);

        const byDate = new Map<string, { i130: number; i129f: number }>();
        const today = new Date();
        for (let i = 0; i < days; i++) {
          const d = subDays(today, days - 1 - i);
          const key = format(d, "yyyy-MM-dd");
          byDate.set(key, { i130: 0, i129f: 0 });
        }
        i130Data.forEach((d) => {
          const cur = byDate.get(d.date) || { i130: 0, i129f: 0 };
          cur.i130 = d.approvals;
          byDate.set(d.date, cur);
        });
        i129fData.forEach((d) => {
          const cur = byDate.get(d.date) || { i130: 0, i129f: 0 };
          cur.i129f = d.approvals;
          byDate.set(d.date, cur);
        });

        const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        let cumI130 = 0;
        let cumI129f = 0;
        const result: CumulativePoint[] = sorted.map(([date, counts]) => {
          cumI130 += counts.i130;
          cumI129f += counts.i129f;
          return {
            date,
            dateLabel: format(new Date(date), "MMM d"),
            i130: counts.i130,
            i129f: counts.i129f,
            total: counts.i130 + counts.i129f,
            cumulativeI130: cumI130,
            cumulativeI129f: cumI129f,
            cumulative: cumI130 + cumI129f,
          };
        });
        setData(result);
      } catch (error) {
        console.error("Error loading cumulative approvals:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--uscis-green)] flex items-center justify-center shadow-lg flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Cumulative Approvals Over Time
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Running total of cases approved—see the pace of the system and when your batch might come.
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
                  ? "bg-emerald-600 text-white"
                  : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="uscis-card p-4 sm:p-6">
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-[var(--text-tertiary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-primary)]">No data yet</p>
            <p className="text-xs text-[var(--text-secondary)]">Cumulative approvals will appear once data is available.</p>
          </div>
        ) : (
          <div className="w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="i130CumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="i129fCumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                <XAxis
                  dataKey="dateLabel"
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
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value) => [((value as number) ?? 0).toLocaleString(), ""]}
                  labelFormatter={(label) => `Total: ${label}`}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 8 }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{value}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#cumulativeGradient)"
                  name="Total cases"
                  isAnimationActive
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-3">
              <span>
                <strong className="text-[var(--text-primary)]">{data[data.length - 1]?.cumulative ?? 0}</strong> total approvals in period
              </span>
              <span>
                <strong className="text-[var(--text-primary)]">{data[data.length - 1]?.cumulativeI130 ?? 0}</strong> I-130
              </span>
              <span>
                <strong className="text-[var(--text-primary)]">{data[data.length - 1]?.cumulativeI129f ?? 0}</strong> I-129F
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
