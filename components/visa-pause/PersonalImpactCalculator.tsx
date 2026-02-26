"use client";

import React, { useEffect, useState } from "react";
import { PersonalImpactService, PersonalImpact } from "@/lib/services/personalImpactService";

interface PersonalImpactCalculatorProps {
  formType: string;
  priorityDate: Date;
  country: string;
}

export default function PersonalImpactCalculator({
  formType,
  priorityDate,
  country,
}: PersonalImpactCalculatorProps) {
  const [impact, setImpact] = useState<PersonalImpact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImpact() {
      try {
        const result = await PersonalImpactService.calculatePersonalImpact(
          formType,
          priorityDate,
          country
        );
        setImpact(result);
      } catch (error) {
        console.error("Error calculating personal impact:", error);
      } finally {
        setLoading(false);
      }
    }
    loadImpact();
  }, [formType, priorityDate, country]);

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

  if (!impact) {
    return null;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Your Case Impact</h3>
      </div>

      <div className="space-y-4">
        {/* Original vs Current */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Original Estimate</div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              {formatDate(impact.originalEstimate)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Current Estimate</div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              {formatDate(impact.currentEstimate)}
            </div>
          </div>
        </div>

        {/* Delay - enhanced visual */}
        <div className="rounded-xl border-2 border-[var(--uscis-blue)]/40 bg-gradient-to-br from-[var(--uscis-blue)]/15 to-[var(--uscis-blue)]/5 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Pause-related delay</span>
            <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{impact.delayDays} days</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--uscis-blue)]/20 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] rounded-full transition-all duration-500"
              style={{ width: impact.delayDays > 0 ? `${Math.min(100, Math.max(8, (impact.delayDays / 90) * 100))}%` : "0%" }}
            />
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            Added to your original estimate due to the January 2026 visa pause.
          </p>
        </div>

        <div>
          <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
            Recovery-adjusted timeline
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface-alt)] px-3 py-2">
              <span className="text-xs text-[var(--text-secondary)]">Optimistic</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {formatDate(impact.recoveryPredictions.optimistic)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface-alt)] px-3 py-2 border border-[var(--uscis-blue)]/30">
              <span className="text-xs text-[var(--text-secondary)]">Realistic</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {formatDate(impact.recoveryPredictions.realistic)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--bg-surface-alt)] px-3 py-2">
              <span className="text-xs text-[var(--text-secondary)]">Pessimistic</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {formatDate(impact.recoveryPredictions.pessimistic)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
