"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface PlaybookData {
  id: string;
  releaseTag: string | null;
  readiness: {
    overallScore: number;
    riskLevel: string;
    blockerCount: number;
    evaluatedAt: string | null;
  };
}

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-300",
  medium: "text-zinc-300",
  high: "text-orange-300",
  critical: "text-rose-300",
  unscored: "text-zinc-400",
};

const RISK_BG: Record<string, string> = {
  low: "bg-emerald-500/10",
  medium: "bg-white/10",
  high: "bg-orange-500/10",
  critical: "bg-rose-500/10",
  unscored: "bg-zinc-500/10",
};

export default function ReleaseReadinessDetailPage() {
  const params = useParams();
  const releaseId = String(params.id);
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/release-playbook/${encodeURIComponent(releaseId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: PlaybookData; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Failed to load release");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setLoading(false));
  }, [releaseId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] text-zinc-400">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
        {error || "Release not found"}
      </div>
    );
  }

  const readiness = data.readiness;
  const hasBeenEvaluated = readiness.evaluatedAt !== null;
  const scorePercentage = Math.round((readiness.overallScore / 100) * 100);

  return (
    <div className="relative">
      <Link
        href={`/dashboard/releases/${releaseId}/playbook`}
        className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to playbook
      </Link>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h1 className="text-[24px] font-bold text-white mb-6">Readiness Assessment</h1>

        <div className="space-y-6">
          {/* Overall Score */}
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-4">
              Overall Readiness Score
            </h2>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
              {hasBeenEvaluated ? (
                <>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-[48px] font-bold text-white">{readiness.overallScore}</span>
                    <span className="text-[14px] text-zinc-400">/100</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all"
                      style={{ width: `${scorePercentage}%` }}
                    />
                  </div>

                  <p className="text-[12px] text-zinc-400">
                    {scorePercentage < 40
                      ? "High risk — critical issues must be resolved"
                      : scorePercentage < 70
                        ? "Medium risk — issues should be addressed"
                        : scorePercentage < 85
                          ? "Good — ready for controlled deployment"
                          : "Excellent — ready for deployment"}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-zinc-400">No readiness snapshot has been recorded for this release yet. A score will appear here once an evaluation runs.</p>
              )}
            </div>
          </section>

          {/* Risk Level */}
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Risk Assessment
            </h2>
            <div className={`rounded-xl px-4 py-3 inline-block ${RISK_BG[readiness.riskLevel]}`}>
              <span className={`text-[13px] font-semibold uppercase tracking-wider ${RISK_COLORS[readiness.riskLevel]}`}>
                {readiness.riskLevel}
              </span>
            </div>
          </section>

          {/* Blockers */}
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Readiness Blockers
            </h2>
            {!hasBeenEvaluated ? (
              <div className="rounded-2xl border border-zinc-500/[0.25] bg-zinc-500/[0.04] p-4">
                <p className="text-[13px] text-zinc-300">Not yet evaluated — blockers cannot be determined until a readiness snapshot runs.</p>
              </div>
            ) : readiness.blockerCount > 0 ? (
              <div className="rounded-2xl border border-rose-500/[0.25] bg-rose-500/[0.04] p-4">
                <p className="text-[13px] text-white">
                  <span className="font-bold text-rose-300">{readiness.blockerCount}</span>{" "}
                  {readiness.blockerCount === 1 ? "blocker" : "blockers"} preventing deployment
                </p>
                <p className="text-[12px] text-zinc-400 mt-2">
                  Address all blockers before proceeding to approval phase.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/[0.25] bg-emerald-500/[0.04] p-4">
                <p className="text-[13px] text-emerald-300">✓ No blockers detected</p>
              </div>
            )}
          </section>

          {/* Evaluation Timestamp */}
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Last Evaluated
            </h2>
            <p className="text-[13px] text-white">
              {readiness.evaluatedAt
                ? new Date(readiness.evaluatedAt).toLocaleString()
                : "Not yet evaluated"}
            </p>
          </section>

          {/* Guidance */}
          <section className="rounded-2xl border border-cyan-500/[0.15] bg-cyan-500/[0.04] p-4">
            <p className="text-[12px] text-cyan-200">
              💡 Readiness assessment evaluates branch governance, change compliance, artifact traceability,
              secret handling, rollback readiness, communication, drift risk, and manual reconciliation needs.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
