"use client";

/**
 * /dashboard/releases/[id]/branch — Phase 460.
 *
 * Renders the 18-check branch-validation result for a release.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, ChevronRightIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface ViewRow {
  key: string;
  label: string;
  state: "pass" | "fail" | "not_applicable" | "unknown";
  detail: string;
}

interface DetailData {
  generatedAt: string;
  releaseId: string;
  repositoryDisplayName: string;
  releaseTag: string | null;
  headPrNumber: number | null;
  checks: ViewRow[];
  summary: { total: number; passing: number; failing: number; notApplicable: number; unknown: number };
  diffSummary: { newlyIncludedPrCount: number; droppedPrCount: number } | null;
  lastWorkflowRun: { name: string; status: string; conclusion: string | null } | null;
}

type RespBody =
  | { ok: true; data: DetailData }
  | { ok: false; error: string; hint?: string };

const STATE_ICON: Record<ViewRow["state"], typeof CheckCircleIcon> = {
  pass: CheckCircleIcon,
  fail: XCircleIcon,
  not_applicable: ChevronRightIcon,
  unknown: QuestionMarkCircleIcon,
};

const STATE_TONE: Record<ViewRow["state"], string> = {
  pass: "text-emerald-300",
  fail: "text-rose-300",
  not_applicable: "text-zinc-500",
  unknown: "text-amber-300",
};

export default function BranchDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const releaseId = String(params.id);
  const repositoryId = search.get("repositoryId") ?? "";

  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    if (!repositoryId) {
      setLoading(false);
      setNetworkError("repositoryId query param required.");
      return;
    }
    let cancelled = false;
    fetch(`/api/dashboard/release-branch-detail/${releaseId}?repositoryId=${encodeURIComponent(repositoryId)}&prod=true`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [releaseId, repositoryId]);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <div className="mb-4">
        <Link href="/dashboard/releases" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          All releases
        </Link>
      </div>

      <PageIntro
        kicker={`Release · ${releaseId.slice(0, 8)} · branch validation`}
        title={<>18 checks. <span className="text-zinc-500">All accounted for.</span></>}
        description="The 18 branch-validation checks the Phase 445 kernel evaluates. Each check shows pass / fail / n-a / unknown with the underlying reason."
        helps="See exactly which check is blocking promotion to production."
        connectFirst="Already wired — checks read from the Phase 451 discovery rows."
        engineers={["Release Captain", "DevOps", "Security"]}
        requiresApproval="Exception waivers require an approver per the Phase 445 kernel."
        actions={[
          { label: "Releases", href: "/dashboard/releases" },
          { label: "ReleaseOps", href: "/dashboard/releaseops" },
        ]}
        safetyNote="Read-only · per-check audit trail · exception kernel-gated"
      />

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading branch validation…</div>}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">{errorBody.error}</p>
          </div>
          {errorBody.hint && <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>}
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[12px] text-zinc-400">
              <span className="font-mono">{data.repositoryDisplayName}</span>
              {data.releaseTag && <span> · tag <span className="font-mono">{data.releaseTag}</span></span>}
              {data.headPrNumber && <span> · PR #{data.headPrNumber}</span>}
              {data.diffSummary && (
                <span> · {data.diffSummary.newlyIncludedPrCount} new, {data.diffSummary.droppedPrCount} dropped vs previous</span>
              )}
              {data.lastWorkflowRun && (
                <span> · last workflow {data.lastWorkflowRun.name} ({data.lastWorkflowRun.conclusion ?? data.lastWorkflowRun.status})</span>
              )}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Passing"  value={String(data.summary.passing)}        tone="emerald" />
            <Stat label="Failing"  value={String(data.summary.failing)}        tone={data.summary.failing > 0 ? "rose" : "zinc"} />
            <Stat label="N/A"      value={String(data.summary.notApplicable)}  tone="zinc" />
            <Stat label="Unknown"  value={String(data.summary.unknown)}        tone={data.summary.unknown > 0 ? "amber" : "zinc"} />
          </div>

          <div className="space-y-2 mb-8">
            {data.checks.map((c) => {
              const Icon = STATE_ICON[c.state];
              return (
                <div key={c.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-start gap-3">
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${STATE_TONE[c.state]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white">{c.label}</p>
                    <p className="text-[11.5px] text-zinc-400 mt-0.5">{c.detail}</p>
                  </div>
                  <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${STATE_TONE[c.state]}`}>
                    {c.state.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}
