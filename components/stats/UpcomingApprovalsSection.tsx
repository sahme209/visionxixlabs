"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getUpcomingApprovalsByCountry, UpcomingApprovalByCountry } from "@/lib/statsService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useProfile } from "@/hooks/useProfile";
import { format } from "date-fns";

export default function UpcomingApprovalsSection() {
  const { profile } = useProfile();
  const [data, setData] = useState<UpcomingApprovalByCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formType, setFormType] = useState<string>("I-130");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const userProfile = profile
          ? {
              country: profile.country,
              priorityDate: profile.priorityDate,
              formType: profile.formType,
            }
          : undefined;
        const predictions = await getUpcomingApprovalsByCountry(formType, 30, userProfile);
        setData(predictions);
      } catch (error) {
        console.error("Error loading upcoming approvals:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [formType, profile]);

  // Normalize and de-duplicate countries (e.g., "India" vs "India 🇮🇳") for cleaner Top Countries view
  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const normalizeKey = (country: string) =>
      country
        .replace(/[^\p{L}\p{N}\s]/gu, "") // strip emoji and symbols
        .trim()
        .toLowerCase();

    const map = new Map<
      string,
      UpcomingApprovalByCountry & { country: string }
    >();

    for (const item of data) {
      const key = normalizeKey(item.country);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { ...item, country: item.country });
      } else {
        // Aggregate predicted approvals and average processing days
        const combinedPredicted =
          existing.predictedApprovals + item.predictedApprovals;
        const combinedAvgDays = Math.round(
          (existing.averageProcessingDays + item.averageProcessingDays) / 2
        );

        map.set(key, {
          ...existing,
          // Prefer label that includes a flag if present
          country:
            /[\p{Extended_Pictographic}]/u.test(item.country) &&
            !/[\p{Extended_Pictographic}]/u.test(existing.country)
              ? item.country
              : existing.country,
          predictedApprovals: combinedPredicted,
          averageProcessingDays: combinedAvgDays,
          // Preserve userPosition info if any version has it
          userPosition: existing.userPosition || item.userPosition,
        });
      }
    }

    // Sort by predicted approvals desc, then by avg days asc
    return Array.from(map.values()).sort((a, b) => {
      if (b.predictedApprovals !== a.predictedApprovals) {
        return b.predictedApprovals - a.predictedApprovals;
      }
      return a.averageProcessingDays - b.averageProcessingDays;
    });
  }, [data]);

  const topCountries = aggregatedData.slice(0, 10);
  const totalPredicted = aggregatedData.reduce(
    (sum, item) => sum + item.predictedApprovals,
    0
  );
  const avgProcessingDays =
    aggregatedData.length > 0
      ? Math.round(
          aggregatedData.reduce(
            (sum, item) => sum + item.averageProcessingDays,
            0
          ) / aggregatedData.length
        )
      : 0;
  const topCountry = topCountries[0];
  const userCountryEntry = aggregatedData.find((item) => item.userPosition);

  if (loading) {
    return (
      <div className="uscis-card">
        <div className="p-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
            <p className="text-sm text-[var(--text-secondary)]">Calculating predictions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="uscis-card">
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-secondary)]">No prediction data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-start gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center shadow-md flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
              <span className="hidden sm:inline">Upcoming Approvals by Country</span>
              <span className="sm:hidden">Upcoming Approvals</span>
            </h3>
            <p className="text-[10px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed mb-2 sm:mb-3">
              <span className="hidden sm:inline">Predicted approvals in next 30 days</span>
              <span className="sm:hidden">Next 30 days</span>
            </p>
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={() => setFormType("I-130")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  formType === "I-130"
                    ? "bg-[var(--uscis-blue)] text-white"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }`}
              >
                I-130
              </button>
              <button
                onClick={() => setFormType("I-129F")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  formType === "I-129F"
                    ? "bg-[var(--uscis-blue)] text-white"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }`}
              >
                I-129F
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
          <div className="p-2 sm:p-3 md:p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">{totalPredicted}</p>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-[var(--text-secondary)]">
              <span className="hidden sm:inline">Total Predicted</span>
              <span className="sm:hidden">Predicted</span>
            </p>
          </div>
          <div className="p-2 sm:p-3 md:p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">{avgProcessingDays}</p>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-[var(--text-secondary)]">
              <span className="hidden sm:inline">Avg Processing Days</span>
              <span className="sm:hidden">Avg Days</span>
            </p>
          </div>
        </div>

        {/* Country Mix & Top Movers - Plain language summary */}
        {topCountry && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            {/* Global top mover */}
            <div className="p-3 sm:p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]">
              <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Top mover in the next 30 days
              </p>
              <p className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)]">
                {topCountry.country}
              </p>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-1">
                We expect about{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {topCountry.predictedApprovals} approvals
                </span>{" "}
                here, with an average of{" "}
                <span className="font-semibold">{topCountry.averageProcessingDays} days</span>{" "}
                from filing to approval.
              </p>
            </div>

            {/* User's country, if available */}
            <div className="p-3 sm:p-4 bg-[var(--bg-surface)] rounded-lg border border-dashed border-[var(--border-color)]">
              <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Where your country stands
              </p>
              {userCountryEntry ? (
                <>
                  <p className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)]">
                    {userCountryEntry.country}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-1">
                    Your country is currently{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      #{userCountryEntry.userPosition?.rank ?? "–"}
                    </span>{" "}
                    out of all countries for predicted approvals this month.
                  </p>
                  <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-1">
                    We’re expecting around{" "}
                    <span className="font-semibold">
                      {userCountryEntry.predictedApprovals} approvals
                    </span>{" "}
                    with an average of{" "}
                    <span className="font-semibold">
                      {userCountryEntry.averageProcessingDays} days
                    </span>{" "}
                    from filing to approval.
                  </p>
                  {userCountryEntry.userPosition?.estimatedUserApprovalDate && (
                    <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-1">
                      For you personally, we estimate around{" "}
                      <span className="font-semibold">
                        {format(userCountryEntry.userPosition.estimatedUserApprovalDate, "MMM d")}
                      </span>{" "}
                      based on similar cases.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[11px] sm:text-xs text-[var(--text-secondary)]">
                  Once you add your country and case details to your profile, we’ll show exactly
                  where your country sits in the rankings and what that means for you.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bar Chart */}
        <div>
          <h4 className="text-[10px] sm:text-xs md:text-sm font-semibold text-[var(--text-secondary)] mb-2 sm:mb-3">
            <span className="hidden sm:inline">Top Countries by Predicted Approvals</span>
            <span className="sm:hidden">Top Countries</span>
          </h4>
          <div style={{ height: "200px" }} className="sm:h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCountries} margin={{ top: 5, right: 10, left: 10, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                <XAxis
                  dataKey="country"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 9, fill: "var(--text-primary)" }}
                />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-primary)" }} />
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
                <Bar dataKey="predictedApprovals" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Country Details List - Simple Bullet List */}
        <div className="mt-4 sm:mt-5">
          <h4 className="text-[11px] sm:text-xs md:text-sm font-semibold text-[var(--text-secondary)] mb-3 sm:mb-4">
            Top Countries
          </h4>
          <ul className="space-y-2.5 sm:space-y-3">
            {topCountries.slice(0, 8).map((item, index) => (
              <li
                key={index}
                className="flex flex-col gap-1.5 sm:gap-2 px-1.5 sm:px-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] sm:text-xs font-bold text-[var(--text-primary)]">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
                        {item.country}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {item.averageProcessingDays}d avg
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight">
                      {item.predictedApprovals}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)] leading-tight">
                      pred
                    </p>
                  </div>
                </div>
                {item.userPosition && (
                  <div className="pl-8 sm:pl-9 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span className="text-green-600 dark:text-green-400">
                      👤 You: #{item.userPosition.rank}
                    </span>
                    {item.userPosition.estimatedUserApprovalDate && (
                      <span>
                        {format(item.userPosition.estimatedUserApprovalDate, "MMM d")}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
