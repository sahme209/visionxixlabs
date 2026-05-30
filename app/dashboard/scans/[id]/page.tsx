/**
 * /dashboard/scans/[id] — what this specific scan produced.
 *
 * Drilldown from /dashboard/scans. Verifies the run belongs to the
 * caller's org, then shows: run header (status, trigger, account,
 * duration, summary), findings produced by this run, and the
 * approval items those findings generated.
 *
 * The chain on this page is the same one persistScanRun writes:
 *   AxiomAgentRun → AxiomFinding → AxiomRecommendation → AxiomApprovalItem
 * so the page makes the platform's data flow visible to operators
 * who want to verify a single scan end-to-end.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type ApprovalStatus = "pending" | "approved" | "rejected" | "snoozed" | "applied" | "failed" | "expired";

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-rose-300",
  medium:   "text-amber-300",
  low:      "text-zinc-400",
  info:     "text-zinc-500",
};

const APPROVAL_TONE: Record<ApprovalStatus, string> = {
  pending:  "text-amber-300",
  snoozed:  "text-zinc-400",
  approved: "text-emerald-300",
  applied:  "text-emerald-400",
  rejected: "text-zinc-500",
  failed:   "text-rose-400",
  expired:  "text-rose-300",
};

function duration(start: Date | null, end: Date | null): string | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/scans");
  }
  const { id } = await params;

  const run = await prisma.axiomAgentRun.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      trigger: true,
      status: true,
      summary: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      cloudAccount: { select: { provider: true, externalAccountId: true, alias: true } },
      findings: {
        select: {
          id: true,
          severity: true,
          category: true,
          title: true,
          description: true,
          region: true,
          affectedResources: true,
        },
        orderBy: { severity: "asc" },
      },
    },
  });

  if (!run || run.organizationId !== ctx.organizationId) {
    notFound();
  }

  const approvalItems = await prisma.axiomApprovalItem.findMany({
    where: { runId: run.id, organizationId: ctx.organizationId },
    select: {
      id: true,
      title: true,
      status: true,
      riskLevel: true,
      dispositionReason: true,
      monthlyHigh: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Previous completed scan of the same cloud account, for the diff.
  const previousRun = await prisma.axiomAgentRun.findFirst({
    where: {
      organizationId: ctx.organizationId,
      cloudAccount: {
        provider: run.cloudAccount.provider,
        externalAccountId: run.cloudAccount.externalAccountId,
      },
      status: "completed",
      createdAt: { lt: run.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      completedAt: true,
      findings: { select: { title: true } },
    },
  });

  // Diff = title-based set difference, modulo identical-title duplicates.
  // Good enough for the 'what's new since last scan' chip without
  // fingerprinting every resource id.
  const currentTitles = new Set(run.findings.map((f) => f.title));
  const previousTitles = new Set((previousRun?.findings ?? []).map((f) => f.title));
  const newSinceLast = previousRun ? [...currentTitles].filter((t) => !previousTitles.has(t)).length : 0;
  const resolvedSinceLast = previousRun ? [...previousTitles].filter((t) => !currentTitles.has(t)).length : 0;

  const dur = duration(run.startedAt, run.completedAt);

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/scans" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Scans
      </Link>

      <header className="mb-12">
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-[0.18em] mb-3">
          <span className="text-emerald-300">{run.status}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300">{run.trigger}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">{run.cloudAccount.provider}/{run.cloudAccount.externalAccountId}</span>
          {dur && (
            <>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500">{dur}</span>
            </>
          )}
        </div>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3">
          {run.findings.length} finding{run.findings.length === 1 ? "" : "s"}
          {approvalItems.length > 0 && (
            <span className="text-zinc-500"> · {approvalItems.length} needing review</span>
          )}
        </h1>
        {run.summary && (
          <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">{run.summary}</p>
        )}
        {previousRun && (newSinceLast > 0 || resolvedSinceLast > 0) && (
          <p className="text-[12px] mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-zinc-500">vs previous scan:</span>
            {newSinceLast > 0 && <span className="text-amber-300 font-mono">+{newSinceLast} new</span>}
            {resolvedSinceLast > 0 && <span className="text-emerald-300 font-mono">−{resolvedSinceLast} resolved</span>}
            <Link
              href={`/dashboard/scans/${previousRun.id}`}
              className="text-zinc-500 hover:text-white underline-offset-2 hover:underline transition-colors"
            >
              see previous
            </Link>
          </p>
        )}
        <p className="text-[11px] font-mono text-zinc-600 mt-3">
          Run {run.id} · started {run.startedAt?.toISOString() ?? "—"}
        </p>
      </header>

      {/* Findings produced by this run */}
      {run.findings.length > 0 && (
        <section className="mb-12">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">findings from this run</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {run.findings.map((f) => {
              const sev = f.severity as Severity;
              const resources = Array.isArray(f.affectedResources) ? f.affectedResources : [];
              const firstRef = resources[0] != null ? String(resources[0]) : null;
              return (
                <li key={f.id} className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider mb-1">
                    <span className={SEVERITY_TONE[sev]}>{f.severity}</span>
                    <span className="text-zinc-500">· {f.category}</span>
                    <span className="text-zinc-600">· {f.region}</span>
                  </div>
                  <p className="text-[14px] font-medium text-white">{f.title}</p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 line-clamp-2">{f.description}</p>
                  {firstRef && (
                    <p className="text-[11px] font-mono text-zinc-600 mt-1.5 truncate">{firstRef}{resources.length > 1 ? ` · +${resources.length - 1}` : ""}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Approval items this scan produced */}
      {approvalItems.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">approval queue</p>
            <Link href="/dashboard/approvals" className="text-[11px] text-zinc-500 hover:text-white transition-colors">Open queue</Link>
          </div>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {approvalItems.map((a) => (
              <li key={a.id} className="px-6 py-4">
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider mb-1">
                  <span className={APPROVAL_TONE[a.status as ApprovalStatus]}>{a.status}</span>
                  <span className="text-zinc-500">· {a.riskLevel} risk</span>
                </div>
                <p className="text-[14px] font-medium text-white">{a.title}</p>
                <p className="text-[12px] text-zinc-500 leading-relaxed mt-1">{a.dispositionReason}</p>
                {a.monthlyHigh > 0 && (
                  <p className="text-[11px] text-emerald-300/80 mt-1">~${a.monthlyHigh.toFixed(0)}/mo if applied</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {run.findings.length === 0 && approvalItems.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-12 text-center">
          <p className="text-[15px] font-semibold text-white mb-1">Clean scan</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto">
            No findings, no recommendations. Either the broker has nothing to
            critique yet, or your environment is already in good shape.
          </p>
        </div>
      )}
    </div>
  );
}
