"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { getProcessingTimeHistogramBuckets } from "@/lib/statsService";
import type { ProcessingTimeHistogramBucket } from "@/lib/statsService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { differenceInDays } from "date-fns";

export default function ProcessingTimeHistogramSection() {
  const { profile } = useProfile();
  const [data, setData] = useState<ProcessingTimeHistogramBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [formType, setFormType] = useState<"I-130" | "I-129F">("I-130");

  const userCaseAge = profile?.priorityDate
    ? Math.floor(differenceInDays(new Date(), new Date(profile.priorityDate)))
    : null;

  const effectiveFormType = formType;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const buckets = await getProcessingTimeHistogramBuckets(effectiveFormType);
        setData(buckets);
      } catch (error) {
        console.error("Error loading histogram:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [effectiveFormType]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getBarColor = (entry: ProcessingTimeHistogramBucket) => {
    if (!userCaseAge) return "var(--uscis-blue)";
    const [low, high] = entry.range.split("-").map(Number);
    if (userCaseAge >= low && userCaseAge < high) return "#DC2626";
    return "var(--uscis-blue)";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Where Do Most Approvals Fall?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Distribution of processing times. See the full spread—most cases cluster in certain ranges.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFormType("I-130")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              formType === "I-130"
                ? "bg-blue-600 text-white"
                : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            I-130
          </button>
          <button
            onClick={() => setFormType("I-129F")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              formType === "I-129F"
                ? "bg-purple-600 text-white"
                : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            I-129F
          </button>
        </div>
      </div>

      <div className="uscis-card p-4 sm:p-6">
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-[var(--text-tertiary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-primary)]">No data yet</p>
            <p className="text-xs text-[var(--text-secondary)]">Distribution will appear once we have enough approvals.</p>
          </div>
        ) : (
          <div className="w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                  label={{
                    value: "Days to Approval",
                    position: "insideBottom",
                    offset: -4,
                    style: { fontSize: 11, fill: "var(--text-secondary)" },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  width={42}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                  label={{
                    value: "Cases",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "var(--text-secondary)" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value) => [value ?? 0, "cases"]}
                  labelFormatter={(label) => `${label} days`}
                />
                <Bar
                  dataKey="count"
                  name="Cases"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={600}
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry)} />
                  ))}
                </Bar>
                {userCaseAge != null && (
                  <ReferenceLine
                    x={data.find((d) => {
                      const [low, high] = d.range.split("-").map(Number);
                      return userCaseAge >= low && userCaseAge < high;
                    })?.range}
                    stroke="#DC2626"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    label={{
                      value: `You: ${userCaseAge}d`,
                      position: "top",
                      fill: "#DC2626",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
            {userCaseAge != null && (
              <p className="mt-2 text-xs text-[var(--text-secondary)] text-center">
                Red bar marks your case age ({userCaseAge} days)—you are in the {data.find((d) => {
                  const [low, high] = d.range.split("-").map(Number);
                  return userCaseAge >= low && userCaseAge < high;
                })?.range ?? "—"} day range
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
