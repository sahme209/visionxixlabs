"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";

interface DataSourceState {
  available: boolean;
  reason?: string;
}

interface PlaybookData {
  id: string;
  releaseTag: string | null;
  approval: {
    required: number | DataSourceState;
    granted: number;
    status: string;
  };
  lifecycle: {
    approvalGrantedAt: string | null;
  } | undefined;
}

function requiredCount(value: number | DataSourceState): number | null {
  return typeof value === "number" ? value : null;
}

export default function ReleaseApprovalDetailPage() {
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

  const approval = data.approval;
  const required = requiredCount(approval.required);
  const notYetEvaluated = required === null;
  const isApproved = required !== null && approval.granted >= required && required > 0;
  const isPending = required !== null && approval.granted < required;
  const progress = required !== null && required > 0 ? Math.round((approval.granted / required) * 100) : 0;

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
        <h1 className="text-[24px] font-bold text-white mb-6">Approval Status</h1>

        <div className="space-y-6">
          {/* Approval Progress */}
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-4">
              Approval Progress
            </h2>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[28px] font-bold text-white">
                    {approval.granted}
                    <span className="text-[14px] font-normal text-zinc-400 ml-2">
                      / {notYetEvaluated ? "—" : required}
                    </span>
                  </p>
                  <p className="text-[12px] text-zinc-400 mt-1">approvals collected</p>
                </div>
                <div
                  className={`text-[32px] ${
                    isApproved
                      ? "text-emerald-400"
                      : isPending
                        ? "text-amber-400"
                        : "text-zinc-400"
                  }`}
                >
                  {isApproved ? <CheckCircleIcon className="h-8 w-8" /> : <ClockIcon className="h-8 w-8" />}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isApproved
                      ? "bg-emerald-500"
                      : isPending
                        ? "bg-amber-500"
                        : "bg-zinc-700"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </section>

          {/* Status */}
          <section>
            <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
              Current Status
            </h2>
            {notYetEvaluated ? (
              <div className="rounded-xl border border-zinc-500/[0.25] bg-zinc-500/[0.04] px-4 py-3 inline-block">
                <span className="text-[13px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Not Yet Evaluated
                </span>
              </div>
            ) : isApproved ? (
              <div className="rounded-xl border border-emerald-500/[0.25] bg-emerald-500/[0.04] px-4 py-3 inline-block">
                <span className="text-[13px] font-semibold text-emerald-300 uppercase tracking-wider">
                  ✓ Approved
                </span>
              </div>
            ) : isPending ? (
              <div className="rounded-xl border border-amber-500/[0.25] bg-amber-500/[0.04] px-4 py-3 inline-block">
                <span className="text-[13px] font-semibold text-amber-300 uppercase tracking-wider">
                  ⏳ Pending
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-500/[0.25] bg-zinc-500/[0.04] px-4 py-3 inline-block">
                <span className="text-[13px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Not Required
                </span>
              </div>
            )}
          </section>

          {/* Approval Timeline */}
          {data.lifecycle?.approvalGrantedAt && (
            <section>
              <h2 className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3">
                Approved At
              </h2>
              <p className="text-[13px] text-white">
                {new Date(data.lifecycle.approvalGrantedAt).toLocaleString()}
              </p>
            </section>
          )}

          {/* Guidance */}
          <section className="rounded-2xl border border-cyan-500/[0.15] bg-cyan-500/[0.04] p-4">
            <p className="text-[12px] text-cyan-200">
              {notYetEvaluated ? (
                "💡 No approval chain has been created for this release yet. Run readiness or policy evaluation to determine how many approvals are required."
              ) : (
                <>
                  💡 This release requires {required} approval{required !== 1 ? "s" : ""}.
                  {isPending && ` ${(required as number) - approval.granted} more needed to proceed.`}
                  {isApproved && " All required approvals have been collected."}
                </>
              )}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
