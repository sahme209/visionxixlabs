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

      <EvidencePackButton releaseId={releaseId} repositoryId={repositoryId} />
      <PolicyEvaluateButton releaseId={releaseId} />
      <ReadinessEvaluateButton releaseId={releaseId} branchSummary={data?.summary ?? null} />

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

/* ──────────────────────────────────────────────────────────────────
   Phase 475 — Evidence pack generator button.
   ────────────────────────────────────────────────────────────── */

type EvidenceOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; contentHash: string; prCount: number; cherryPickCount: number; linkedTicketCount: number }
  | { kind: "error"; message: string };

function EvidencePackButton({ releaseId, repositoryId }: { releaseId: string; repositoryId: string }) {
  const [outcome, setOutcome] = useState<EvidenceOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/release-evidence-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, ...(repositoryId ? { repositoryId } : {}) }),
      });
      const j = await res.json();
      if (j.ok) {
        setOutcome({
          kind: "ok",
          contentHash: j.data.contentHash,
          prCount: j.data.summary.prCount,
          cherryPickCount: j.data.summary.cherryPickCount,
          linkedTicketCount: j.data.summary.linkedTicketCount,
        });
      } else {
        setOutcome({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = outcome.kind === "running";
  const exportUrl = (fmt: "json" | "markdown") =>
    `/api/dashboard/release-evidence-export/${encodeURIComponent(releaseId)}?format=${fmt}`;
  return (
    <div className="mb-6 rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.03] p-4 flex items-center gap-3 flex-wrap text-[12px]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300/70">Evidence pack</span>
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "Generating…" : "Generate / refresh pack"}
      </button>
      <a
        href={exportUrl("markdown")}
        className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] font-mono text-[11px] text-zinc-200 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
        download
      >
        Download .md
      </a>
      <a
        href={exportUrl("json")}
        className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] font-mono text-[11px] text-zinc-200 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
        download
      >
        Download .json
      </a>
      {outcome.kind === "ok" && (
        <span className="font-mono text-emerald-300 text-[11.5px]">
          ✓ sealed · {outcome.prCount} PRs · {outcome.cherryPickCount} cherry-picks · {outcome.linkedTicketCount} tickets · sha {outcome.contentHash.slice(0, 12)}…
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="font-mono text-rose-300 text-[11.5px]">✗ {outcome.message}</span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Phase 478 — Re-evaluate policy button.
   ────────────────────────────────────────────────────────────── */

type PolicyOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; verdict: "clean" | "warnings_only" | "blocked"; opened: number; refreshed: number; resolved: number; environmentTier: string }
  | { kind: "error"; message: string };

function PolicyEvaluateButton({ releaseId }: { releaseId: string }) {
  const [outcome, setOutcome] = useState<PolicyOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/release-policy-evaluate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId }),
      });
      const j = await res.json();
      if (j.ok) {
        setOutcome({
          kind: "ok",
          verdict: j.data.verdict,
          opened: j.data.opened,
          refreshed: j.data.refreshed,
          resolved: j.data.resolved,
          environmentTier: j.data.environmentTier,
        });
      } else {
        setOutcome({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const verdictTone = (v: "clean" | "warnings_only" | "blocked") =>
    v === "clean" ? "text-emerald-300" : v === "warnings_only" ? "text-amber-300" : "text-rose-300";

  const busy = outcome.kind === "running";
  return (
    <div className="mb-6 rounded-2xl border border-cyan-500/[0.18] bg-cyan-500/[0.03] p-4 flex items-center gap-3 flex-wrap text-[12px]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/70">Policy</span>
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/[0.12] font-semibold text-cyan-100 hover:bg-cyan-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "Evaluating…" : "Re-evaluate policy"}
      </button>
      <a
        href="/dashboard/policy-violations"
        className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] font-mono text-[11px] text-zinc-200 hover:border-cyan-500/30 hover:text-cyan-200 transition-colors"
      >
        Open inbox
      </a>
      {outcome.kind === "ok" && (
        <span className="font-mono text-[11.5px]">
          <span className={verdictTone(outcome.verdict)}>{outcome.verdict.replace("_", " ")}</span>
          <span className="text-zinc-500"> · {outcome.environmentTier} · +{outcome.opened} opened · {outcome.refreshed} refreshed · {outcome.resolved} resolved</span>
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="font-mono text-rose-300 text-[11.5px]">✗ {outcome.message}</span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Phase 480 — Re-evaluate readiness button.
   ────────────────────────────────────────────────────────────── */

type ReadinessOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; overallScore: number; riskLevel: string; blockerCount: number; topBlocker: { category: string; severity: string; message: string } | null }
  | { kind: "error"; message: string };

function ReadinessEvaluateButton({
  releaseId,
  branchSummary,
}: {
  releaseId: string;
  branchSummary: DetailData["summary"] | null;
}) {
  const [outcome, setOutcome] = useState<ReadinessOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/release-readiness-evaluate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId,
          ...(branchSummary
            ? {
                branchValidation: {
                  total: branchSummary.total,
                  passing: branchSummary.passing,
                  failing: branchSummary.failing,
                  notApplicable: branchSummary.notApplicable,
                  unknown: branchSummary.unknown,
                },
              }
            : {}),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setOutcome({
          kind: "ok",
          overallScore: j.data.overallScore,
          riskLevel: j.data.riskLevel,
          blockerCount: j.data.blockerCount,
          topBlocker: j.data.topBlocker,
        });
      } else {
        setOutcome({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const riskTone = (r: string) =>
    r === "low" ? "text-emerald-300" : r === "medium" ? "text-amber-300" : r === "high" ? "text-orange-300" : "text-rose-300";

  const busy = outcome.kind === "running";
  return (
    <div className="mb-6 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-4 flex items-center gap-3 flex-wrap text-[12px]">
      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300/70">Readiness</span>
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.12] font-semibold text-amber-100 hover:bg-amber-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "Scoring…" : "Re-evaluate readiness"}
      </button>
      {outcome.kind === "ok" && (
        <span className="font-mono text-[11.5px]">
          <span className={riskTone(outcome.riskLevel)}>{outcome.overallScore}/100 · {outcome.riskLevel}</span>
          <span className="text-zinc-500"> · {outcome.blockerCount} blocker{outcome.blockerCount === 1 ? "" : "s"}</span>
          {outcome.topBlocker && (
            <span className="text-zinc-400"> · top: {outcome.topBlocker.message}</span>
          )}
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="font-mono text-rose-300 text-[11.5px]">✗ {outcome.message}</span>
      )}
    </div>
  );
}
