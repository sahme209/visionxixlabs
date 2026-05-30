/**
 * /dashboard/findings/[id] — single-finding deep dive.
 *
 * Drilldown from /dashboard/findings. Verifies the finding belongs
 * to the caller's org via its run, then shows the full description,
 * every affected resource, and the recommendations + approval items
 * the scanner produced for this finding.
 *
 * The chain top-to-bottom:
 *   finding header → description + affected resources →
 *   recommendations (with rationale) → approval queue items linked
 *   to those recommendations, with current status.
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

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/findings");
  }
  const { id } = await params;

  const finding = await prisma.axiomFinding.findUnique({
    where: { id },
    select: {
      id: true,
      severity: true,
      category: true,
      title: true,
      description: true,
      provider: true,
      region: true,
      affectedResources: true,
      confidence: true,
      createdAt: true,
      data: true,
      run: {
        select: {
          id: true,
          organizationId: true,
          completedAt: true,
          cloudAccount: { select: { provider: true, externalAccountId: true } },
        },
      },
      recommendations: {
        select: {
          id: true,
          title: true,
          rationale: true,
          disposition: true,
          dispositionReason: true,
          riskLevel: true,
          actionable: true,
          monthlyHigh: true,
        },
      },
    },
  });

  if (!finding || finding.run.organizationId !== ctx.organizationId) {
    notFound();
  }

  // Approval items don't carry findingId directly, so we resolve via
  // the recommendations linked to this finding.
  const recIds = finding.recommendations.map((r) => r.id);
  const approvals = recIds.length > 0
    ? await prisma.axiomApprovalItem.findMany({
        where: {
          organizationId: ctx.organizationId,
          planItemId: { in: recIds },
        },
        select: { id: true, planItemId: true, title: true, status: true, riskLevel: true },
      })
    : [];
  const approvalsByRec = new Map<string, typeof approvals[number]>();
  for (const a of approvals) approvalsByRec.set(a.planItemId, a);

  const resources = Array.isArray(finding.affectedResources) ? finding.affectedResources : [];
  const severityTone = SEVERITY_TONE[finding.severity as Severity];

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/findings" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Findings
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-[0.18em] mb-3">
          <span className={severityTone}>{finding.severity}</span>
          <span className="text-zinc-500">· {finding.category}</span>
          <span className="text-zinc-600">· {finding.provider} / {finding.region}</span>
          <span className="text-zinc-600">· confidence {finding.confidence}</span>
        </div>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-4">
          {finding.title}
        </h1>
        <p className="text-[14px] text-zinc-300 leading-relaxed whitespace-pre-line">{finding.description}</p>
      </header>

      {/* Affected resources */}
      {resources.length > 0 && (
        <section className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">affected resources · {resources.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {resources.map((r, i) => (
              <li key={`${String(r)}_${i}`} className="px-6 py-3">
                <p className="text-[12px] font-mono text-zinc-300 break-all">{String(r)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommendations */}
      {finding.recommendations.length > 0 && (
        <section className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recommendations</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {finding.recommendations.map((r) => {
              const approval = approvalsByRec.get(r.id);
              return (
                <li key={r.id} className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider mb-1">
                    <span className="text-zinc-300">{r.disposition.replace(/_/g, " ")}</span>
                    {r.riskLevel && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{r.riskLevel} risk</span>
                      </>
                    )}
                    {approval && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className={APPROVAL_TONE[approval.status as ApprovalStatus]}>{approval.status}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[14px] font-medium text-white">{r.title}</p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 whitespace-pre-line">{r.rationale}</p>
                  {r.monthlyHigh > 0 && (
                    <p className="text-[11px] text-emerald-300/80 mt-1">~${r.monthlyHigh.toFixed(0)}/mo if applied</p>
                  )}
                  {approval && (approval.status === "approved" || approval.status === "applied") && (
                    <a
                      href={`/api/approvals/${approval.id}/plan`}
                      download
                      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-medium border border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50 transition-colors"
                    >
                      Download .tf
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Provenance footer */}
      <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">provenance</p>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          From scan <Link href={`/dashboard/scans/${finding.run.id}`} className="text-zinc-300 hover:text-white underline">{finding.run.id}</Link> on {finding.run.cloudAccount.provider}/{finding.run.cloudAccount.externalAccountId}.
          Recorded {finding.createdAt.toISOString()}.
        </p>
      </section>
    </div>
  );
}
