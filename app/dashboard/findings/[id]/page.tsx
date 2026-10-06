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
import { controlsForRuleCode } from "@/lib/compliance/controls";

export const dynamic = "force-dynamic";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type ApprovalStatus = "pending" | "approved" | "rejected" | "snoozed" | "applied" | "failed" | "expired";

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-rose-300",
  medium:   "text-zinc-300",
  low:      "text-zinc-400",
  info:     "text-zinc-500",
};

const APPROVAL_TONE: Record<ApprovalStatus, string> = {
  pending:  "text-zinc-300",
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

  // AGI rationale enrichment for any recommendation tied to this
  // finding. Phase 520 wired remediation rationale to recommendation
  // ids — surface them here so the AGI's reasoning lives one section
  // away from the finding it explains.
  const rationales = recIds.length > 0
    ? await prisma.aiRationaleEnrichment.findMany({
        where: {
          organizationId: ctx.organizationId,
          targetKind: "remediation",
          targetId: { in: recIds },
        },
        select: {
          targetId: true,
          narrative: true,
          riskFactorsJson: true,
          nextActionsJson: true,
          outcome: true,
          modelHint: true,
          generatedAt: true,
        },
      }).catch(() => [] as Array<{
        targetId: string;
        narrative: string;
        riskFactorsJson: unknown;
        nextActionsJson: unknown;
        outcome: string;
        modelHint: string | null;
        generatedAt: Date;
      }>)
    : [];
  const rationaleByRec = new Map(rationales.map((r) => [r.targetId, r] as const));

  const resources = Array.isArray(finding.affectedResources) ? finding.affectedResources : [];
  const severityTone = SEVERITY_TONE[finding.severity as Severity];

  // Compliance attribution. The finding's data.ruleCode (when present)
  // is the key the compliance catalog matches against. We resolve to
  // the list of controls this finding counts against so operators
  // see the audit impact, not just the finding text.
  const data = (finding.data ?? {}) as Record<string, unknown>;
  const ruleCode = typeof data.ruleCode === "string" ? data.ruleCode : null;
  const violatedControls = ruleCode ? controlsForRuleCode(ruleCode) : [];

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
          <ul className="surface-glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
            {resources.map((r, i) => (
              <li key={`${String(r)}_${i}`} className="px-6 py-3">
                <p className="text-[12px] font-mono text-zinc-300 break-all">{String(r)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Compliance attribution — which controls this finding counts
          against. Renders only when the finding's data.ruleCode
          matches at least one matcher in the catalog. */}
      {violatedControls.length > 0 && (
        <section className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
            counts against · {violatedControls.length} control{violatedControls.length === 1 ? "" : "s"}
          </p>
          <ul className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] divide-y divide-white/[0.04] overflow-hidden">
            {violatedControls.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/compliance`}
                  className="group flex items-start justify-between gap-3 px-5 py-3 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      <span className="text-rose-300">failing</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{c.framework}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500">{c.id}</span>
                    </div>
                    <p className="text-[13px] font-medium text-white">{c.title}</p>
                    <p className="text-[11.5px] text-zinc-500 leading-snug mt-0.5">{c.description}</p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">→</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
            Matched by ruleCode <code className="font-mono text-zinc-400">{ruleCode}</code>.
            Operators can manage the catalog in <code className="font-mono text-zinc-400">lib/compliance/controls.ts</code>.
          </p>
        </section>
      )}

      {/* Recommendations */}
      {finding.recommendations.length > 0 && (
        <section className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recommendations</p>
          <ul className="surface-glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
            {finding.recommendations.map((r) => {
              const approval = approvalsByRec.get(r.id);
              const rationale = rationaleByRec.get(r.id);
              const aiRiskFactors = rationale && Array.isArray(rationale.riskFactorsJson)
                ? (rationale.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string")
                : [];
              const aiNextActions = rationale && Array.isArray(rationale.nextActionsJson)
                ? (rationale.nextActionsJson as unknown[]).filter((x): x is string => typeof x === "string")
                : [];
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
                    {rationale && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-violet-300">AGI {rationale.outcome.replace(/_/g, " ")}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[14px] font-medium text-white">{r.title}</p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 whitespace-pre-line">{r.rationale}</p>
                  {r.monthlyHigh > 0 && (
                    <p className="text-[11px] text-emerald-300/80 mt-1">~${r.monthlyHigh.toFixed(0)}/mo if applied</p>
                  )}

                  {rationale && (
                    <div className="mt-3 rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-violet-300">AGI rationale</p>
                        {rationale.modelHint && (
                          <span className="text-[10px] font-mono text-zinc-500">· {rationale.modelHint}</span>
                        )}
                        <Link
                          href={`/dashboard/agi-memory/${encodeURIComponent(`remediation:${r.id}`)}`}
                          className="ml-auto text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                        >
                          permalink →
                        </Link>
                      </div>
                      <p className="text-[12px] text-zinc-200 leading-relaxed whitespace-pre-line">{rationale.narrative}</p>
                      {aiRiskFactors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">risk factors</p>
                          <ul className="space-y-0.5">
                            {aiRiskFactors.map((f, i) => (
                              <li key={`${i}_${f.slice(0, 24)}`} className="text-[11.5px] text-zinc-300 flex gap-1.5">
                                <span className="text-rose-400">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiNextActions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">next actions</p>
                          <ul className="space-y-0.5">
                            {aiNextActions.map((a, i) => (
                              <li key={`${i}_${a.slice(0, 24)}`} className="text-[11.5px] text-zinc-300 flex gap-1.5">
                                <span className="text-emerald-400">→</span>
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
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
      <section className="surface-glass mb-10 rounded-2xl px-6 py-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">provenance</p>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          From scan <Link href={`/dashboard/scans/${finding.run.id}`} className="text-zinc-300 hover:text-white underline">{finding.run.id}</Link> on {finding.run.cloudAccount.provider}/{finding.run.cloudAccount.externalAccountId}.
          Recorded {finding.createdAt.toISOString()}.
        </p>
      </section>
    </div>
  );
}
