"use client";

import React, { useEffect, useState } from "react";
import { RecoveryAnalysisService, RecoveryPrediction } from "@/lib/services/recoveryAnalysisService";

interface RecoveryPredictionsProps {
  priorityDate: Date;
  estimatedApprovalDate: Date;
  country: string;
}

export default function RecoveryPredictions({
  priorityDate,
  estimatedApprovalDate,
  country,
}: RecoveryPredictionsProps) {
  const [prediction, setPrediction] = useState<RecoveryPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPredictions() {
      try {
        const result = await RecoveryAnalysisService.predictRecoveryTimeline(
          priorityDate,
          estimatedApprovalDate,
          country
        );
        setPrediction(result);
      } catch (error) {
        console.error("Error loading recovery predictions:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPredictions();
  }, [priorityDate, estimatedApprovalDate, country]);

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

  if (!prediction) {
    return null;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getConfidenceColor = (confidence: string) => {
    return "text-[var(--text-primary)] bg-[var(--uscis-blue)]/10 border-[var(--uscis-blue)]/20";
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Recovery outlook</h3>
      </div>

      <div className="space-y-4">
        {/* Confidence Badge */}
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${getConfidenceColor(prediction.confidence)}`}>
          <span className="text-xs font-semibold capitalize">Confidence: {prediction.confidence}</span>
        </div>

        {/* Recovery Rate at Processing */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
          <div className="text-xs text-[var(--text-secondary)] mb-1">
            Recovery Rate When Your Case Processes
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {prediction.recoveryRateAtProcessing}%
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            Timeline Scenarios
          </div>
          
          <div className="rounded-lg border border-[var(--uscis-blue)]/20 bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Optimistic</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {formatDate(prediction.optimistic)}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Recovery accelerates faster than expected
            </div>
          </div>

          <div className="rounded-lg border border-[var(--uscis-blue)]/30 bg-[var(--uscis-blue)]/10 p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Realistic</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {formatDate(prediction.realistic)}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Current recovery trend continues
            </div>
          </div>

          <div className="rounded-lg border border-[var(--uscis-blue)]/20 bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Pessimistic</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {formatDate(prediction.pessimistic)}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Recovery slows down
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
