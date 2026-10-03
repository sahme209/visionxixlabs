"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface DataSourceState {
  available: boolean;
  reason?: string;
}

interface PlaybookData {
  id: string;
  validation: {
    planCount: number | DataSourceState;
    resultsCount: number | DataSourceState;
    status: string;
  };
}

export default function ReleaseValidationDetailPage() {
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
      <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
        {error || "Release not found"}
      </div>
    );
  }

  const validation = data.validation;
  const planCountNum = typeof validation.planCount === 'number' ? validation.planCount : 0;
  const resultsCountNum = typeof validation.resultsCount === 'number' ? validation.resultsCount : 0;
  const progress = planCountNum > 0 ? Math.round((resultsCountNum / planCountNum) * 100) : 0;

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
        <h1 className="text-[24px] font-bold text-white mb-6">Validation Results</h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Test Coverage
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-xl border p-4 ${
                typeof validation.planCount === 'number'
                  ? 'border-white/[0.08] bg-white/[0.025]'
                  : 'border-zinc-500/[0.25] bg-zinc-500/[0.05]'
              }`}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Plans
                </p>
                {typeof validation.planCount === 'number' ? (
                  <p className="text-[28px] font-bold text-white">{validation.planCount}</p>
                ) : (
                  <>
                    <p className="text-[14px] font-semibold text-zinc-300 mb-1">Preview</p>
                    <p className="text-[12px] text-zinc-400">{validation.planCount.reason}</p>
                  </>
                )}
              </div>
              <div className={`rounded-xl border p-4 ${
                typeof validation.resultsCount === 'number'
                  ? 'border-white/[0.08] bg-white/[0.025]'
                  : 'border-zinc-500/[0.25] bg-zinc-500/[0.05]'
              }`}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Results
                </p>
                {typeof validation.resultsCount === 'number' ? (
                  <p className="text-[28px] font-bold text-white">{validation.resultsCount}</p>
                ) : (
                  <>
                    <p className="text-[14px] font-semibold text-zinc-300 mb-1">Preview</p>
                    <p className="text-[12px] text-zinc-400">{validation.resultsCount.reason}</p>
                  </>
                )}
              </div>
            </div>
          </section>

          {planCountNum > 0 && (
            <section>
              <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
                Completion
              </h2>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-white">
                    {resultsCountNum} of {planCountNum} complete
                  </span>
                  <span className="text-[13px] font-bold text-white">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Status
            </h2>
            {validation.status === "not_run" ? (
              <div className="rounded-2xl border border-zinc-500/[0.15] bg-zinc-500/[0.04] p-4">
                <p className="text-[12px] text-zinc-200">
                  No validation plans created yet. Create test plans after approval.
                </p>
              </div>
            ) : typeof validation.planCount !== "number" || typeof validation.resultsCount !== "number" ? (
              <div className="rounded-2xl border border-zinc-500/[0.15] bg-zinc-500/[0.04] p-4">
                <p className="text-[12px] text-zinc-200">
                  Validation status is not yet available for this release.
                </p>
              </div>
            ) : resultsCountNum === planCountNum ? (
              <div className="rounded-2xl border border-emerald-500/[0.15] bg-emerald-500/[0.04] p-4">
                <p className="text-[12px] text-emerald-200">
                  ✓ All validation checks completed successfully.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-500/[0.15] bg-amber-500/[0.04] p-4">
                <p className="text-[12px] text-amber-200">
                  ⏳ Validation in progress. {planCountNum - resultsCountNum} checks remaining.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
