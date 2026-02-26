"use client";

import React, { useEffect, useState } from "react";
import { VisaPauseService, PauseStatus, RecoveryMetrics } from "@/lib/services/visaPauseService";

interface PauseStatusTrackerProps {
  country: string;
}

export default function PauseStatusTracker({ country }: PauseStatusTrackerProps) {
  const [pauseStatus, setPauseStatus] = useState<PauseStatus | null>(null);
  const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [status, metrics] = await Promise.all([
          VisaPauseService.getPauseStatus(),
          VisaPauseService.getRecoveryMetrics(),
        ]);
        setPauseStatus(status);
        setRecoveryMetrics(metrics);
      } catch (error) {
        console.error("Error loading pause status:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-[var(--bg-surface-alt)] rounded mb-4"></div>
          <div className="h-4 w-full bg-[var(--bg-surface-alt)] rounded mb-2"></div>
          <div className="h-4 w-3/4 bg-[var(--bg-surface-alt)] rounded"></div>
        </div>
      </div>
    );
  }

  if (!pauseStatus || !recoveryMetrics) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resumed":
        return "bg-[var(--uscis-blue)]/10 text-[var(--text-primary)] border-[var(--uscis-blue)]/20";
      case "recovering":
        return "bg-[var(--uscis-blue)]/10 text-[var(--text-primary)] border-[var(--uscis-blue)]/20";
      case "active":
        return "bg-[var(--uscis-blue)]/10 text-[var(--text-primary)] border-[var(--uscis-blue)]/20";
      default:
        return "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-color)]";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "resumed":
        return "Resumed";
      case "recovering":
        return "Recovering";
      case "active":
        return "Active";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Pause Status</h3>
      </div>

      <div className="space-y-4">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${getStatusColor(pauseStatus.status)}`}>
          <div className="h-2 w-2 rounded-full bg-[var(--uscis-blue)]"></div>
          <span className="text-sm font-semibold">{getStatusLabel(pauseStatus.status)}</span>
        </div>

        {/* Recovery Rate - enhanced bar */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Recovery Rate</span>
            <span className="text-xl font-bold text-[var(--text-primary)]">
              {recoveryMetrics.recoveryRate}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
            <div
              className="h-full bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, recoveryMetrics.recoveryRate)}%` }}
            ></div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            {recoveryMetrics.recoveryRate >= 90
              ? "System nearly back to pre-pause speed."
              : recoveryMetrics.recoveryRate >= 60
              ? "Recovery progressing; approvals accelerating."
              : "Recovery ongoing; timelines may shift as data improves."}
          </p>
        </div>

        {/* Key Metrics - richer grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-[var(--bg-surface-alt)] p-3 border border-[var(--border-color)]">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Started</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {pauseStatus.startedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-surface-alt)] p-3 border border-[var(--border-color)]">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Days since pause</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{recoveryMetrics.daysSincePause}</div>
          </div>
          {recoveryMetrics.estimatedFullRecovery && (
            <div className="rounded-lg bg-[var(--bg-surface-alt)] p-3 border border-[var(--border-color)]">
              <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Est. Full Recovery</div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                {recoveryMetrics.estimatedFullRecovery.toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          )}
          <div className="rounded-lg bg-[var(--bg-surface-alt)] p-3 border border-[var(--border-color)]">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Processing velocity</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              ~{recoveryMetrics.processingVelocity}/day
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)]">vs pre-pause ~{recoveryMetrics.prePauseVelocity}/day</div>
          </div>
        </div>

        {/* Weekly Change */}
        {recoveryMetrics.weeklyChange !== 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface-alt)] px-3 py-2">
            <svg
              className="h-4 w-4 text-[var(--text-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  recoveryMetrics.weeklyChange > 0
                    ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                }
              />
            </svg>
            <span className="text-sm text-[var(--text-secondary)]">
              {recoveryMetrics.weeklyChange > 0 ? "+" : ""}
              {recoveryMetrics.weeklyChange}% this week
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
