"use client";

import React, { useEffect, useState } from "react";
import { NeighborCaseService, NeighborCaseSummary } from "@/lib/services/neighborCaseService";

interface NeighborCaseTrackingProps {
  priorityDate: Date;
  country: string;
}

export default function NeighborCaseTracking({
  priorityDate,
  country,
}: NeighborCaseTrackingProps) {
  const [summary, setSummary] = useState<NeighborCaseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNeighborCases() {
      try {
        const result = await NeighborCaseService.getNeighborCases(
          priorityDate,
          country,
          5
        );
        setSummary(result);
      } catch (error) {
        console.error("Error loading neighbor cases:", error);
      } finally {
        setLoading(false);
      }
    }
    loadNeighborCases();
  }, [priorityDate, country]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-[var(--bg-surface-alt)] rounded mb-4"></div>
          <div className="h-4 w-full bg-[var(--bg-surface-alt)] rounded mb-2"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    // No neighbor approvals yet for this country / PD window – explain instead of mocking data
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Cases Like Yours</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          We don&apos;t have enough recent approvals that match your country and priority date window yet.
          As more similar cases get approved, this section will automatically start showing live neighbor data.
        </p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "accelerating":
        return (
          <svg className="h-4 w-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case "decelerating":
        return (
          <svg className="h-4 w-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Cases Like Yours</h3>
      </div>

      <div className="space-y-4">
        {/* Weekly Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">This Week</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {summary.thisWeek}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">approvals</div>
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Last Week</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {summary.lastWeek}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">approvals</div>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface-alt)] px-3 py-2">
          {getTrendIcon(summary.trend)}
          <span className="text-sm font-semibold text-[var(--text-primary)] capitalize">
            {summary.trend}
          </span>
        </div>

        {/* Recent Approvals */}
        {summary.recentApprovals.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
              Recent Approvals
            </div>
            <div className="space-y-2">
              {summary.recentApprovals.map((approval, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] px-3 py-2"
                >
                  <div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      PD: {formatDate(approval.priorityDate)}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Approved {approval.daysAgo} days ago
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">✓ Approved</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {approval.processingDays} days
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Position */}
        {summary.userPosition && (
          <div className="rounded-lg border border-[var(--uscis-blue)]/30 bg-[var(--uscis-blue)]/10 px-3 py-2">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Your Approximate Position</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              ~#{summary.userPosition.toLocaleString()} in queue
            </div>
          </div>
        )}

        {summary.isEstimated && (
          <p className="text-[11px] text-[var(--text-tertiary)] italic">
            Estimates based on typical approval patterns for {country}. Live data will replace these as more cases are processed.
          </p>
        )}
      </div>
    </div>
  );
}
