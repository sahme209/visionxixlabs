"use client";

/**
 * /dashboard/cherry-picks — Phase 461.
 * Inbox of cherry-pick exception requests: status, rationale,
 * approved/excluded PR counts, requester, decision.
 */

import { useEffect, useState } from "react";
import {
  ScissorsIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Status = "requested" | "approved" | "denied" | "superseded" | "unknown";

interface Row {
  id: string;
  releaseId: string;
  releaseTag: string | null;
  applicationId: string | null;
  repositoryId: string;
  repositoryDisplayName: string | null;
  status: Status;
  rationale: string;
  approvedCount: number;
  excludedCount: number;
  hasFinalCommitValidation: boolean;
  requestedByUserId: string;
  requestedAtIso: string;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
}

interface DigestData {
  generatedAt: string;
  exceptions: Row[];
  summary: { total: number; byStatus: Record<Status, number> };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  requested:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  approved:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  denied:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  superseded: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  unknown:    "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

export default function CherryPicksPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/cherry-pick-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · cherry-pick exceptions${data ? ` · ${data.summary.total} on file` : ""}`}
        title={<>Out-of-train fixes. <span className="text-zinc-500">With paperwork.</span></>}
        description="When a release ships commits that aren't in the next-prod baseline, the operator must request an exception. Approvers see exactly which PRs were cherry-picked and why."
        helps="Open exceptions show pending approver work. Approved rows feed evidence packs."
        connectFirst="Cherry-pick exceptions are created from the release readiness pane when a non-FF diff is detected."
        engineers={["Release Captain", "Release Approvers", "Security"]}
        requiresApproval="Approving a cherry-pick is a 2-person rule: requester and approver must be different operators."
        actions={[
          { label: "Releases",   href: "/dashboard/releases" },
          { label: "Activity",   href: "/dashboard/activity" },
        ]}
        safetyNote="Read-only · per-org isolation · approved exceptions land in audit log + evidence pack"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading cherry-pick exceptions…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={ClockIcon}              label="Requested"  value={String(data.summary.byStatus.requested)} tone={data.summary.byStatus.requested > 0 ? "amber" : "zinc"} />
            <Stat icon={CheckCircleIcon}        label="Approved"   value={String(data.summary.byStatus.approved)}  tone={data.summary.byStatus.approved > 0 ? "emerald" : "zinc"} />
            <Stat icon={XCircleIcon}            label="Denied"     value={String(data.summary.byStatus.denied)}    tone={data.summary.byStatus.denied > 0 ? "rose" : "zinc"} />
            <Stat icon={ScissorsIcon}           label="Total"      value={String(data.summary.total)}              tone="zinc" />
          </div>

          {data.exceptions.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No cherry-pick exceptions on file. Clean release trains are the goal.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.exceptions.map((e) => (
                <div key={e.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[e.status]}`}>
                        {e.status}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">
                        {e.releaseTag ?? "(untagged)"} <span className="text-zinc-500">·</span> {e.repositoryDisplayName ?? "(unknown repo)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {e.approvedCount} approved
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {e.excludedCount} excluded
                      </span>
                      {e.hasFinalCommitValidation && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          final commits ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-2 whitespace-pre-wrap">{e.rationale}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                    <span>requested by {e.requestedByUserId} · {new Date(e.requestedAtIso).toLocaleString()}</span>
                    {e.decidedAtIso && (
                      <span>· decided by {e.decidedByUserId} · {new Date(e.decidedAtIso).toLocaleString()}</span>
                    )}
                  </div>
                  {e.decisionReason && (
                    <p className="text-[11.5px] text-zinc-400 mt-2 italic">"{e.decisionReason}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ScissorsIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
