/**
 * /dashboard/recommendations — what the scanner thinks you should do.
 *
 * Reads AxiomRecommendation joined via run.organizationId. Groups
 * by disposition so the operator can scan three buckets:
 *   - approval_required: needs a human call. Linked to the approval queue.
 *   - auto_fix_candidate: safe by class (cost / scaling). Could be
 *     auto-applied once an executor exists, today still surfaced for
 *     transparency.
 *   - informational: nothing to apply, but worth knowing.
 *
 * Sums savings per bucket so the user can see the total $/mo the
 * platform has found for them. The approvals queue is the next click
 * for any row that hasn't been decided yet.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

// Mirrors the Prisma ActionDisposition enum so reads pass straight through.
type Disposition = "auto_fix_candidate" | "approval_required" | "report_only" | "blocked";
type Risk = "low" | "medium" | "high";

const DISPOSITION_LABEL: Record<Disposition, string> = {
  auto_fix_candidate: "Auto-fix candidates",
  approval_required:  "Need a human call",
  report_only:        "For your awareness",
  blocked:            "Blocked by policy",
};

const DISPOSITION_HINT: Record<Disposition, string> = {
  auto_fix_candidate: "Safe by class (cost / scaling). An executor could apply these without approval once one is registered.",
  approval_required:  "Security / IAM / drift fixes. Each one enters the approval queue.",
  report_only:        "No action proposed, surfaced for context.",
  blocked:            "Recommendation generated but the platform won't execute it — usually a policy guard fired.",
};

const RISK_TONE: Record<Risk, string> = {
  high:   "text-rose-300",
  medium: "text-amber-300",
  low:    "text-zinc-400",
};

export default async function RecommendationsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/recommendations");
  }

  let recs: Array<{
    id: string;
    title: string;
    rationale: string;
    disposition: Disposition;
    riskLevel: Risk | null;
    monthlyHigh: number;
    actionable: boolean;
    findingId: string;
    createdAt: Date;
  }> = [];
  let migrationPending = false;
  try {
    recs = await prisma.axiomRecommendation.findMany({
      where: { run: { organizationId: ctx.organizationId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        rationale: true,
        disposition: true,
        riskLevel: true,
        monthlyHigh: true,
        actionable: true,
        findingId: true,
        createdAt: true,
      },
    }) as typeof recs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  const buckets: Record<Disposition, typeof recs> = {
    auto_fix_candidate: [],
    approval_required:  [],
    report_only:        [],
    blocked:            [],
  };
  for (const r of recs) {
    if (r.disposition in buckets) buckets[r.disposition].push(r);
  }

  const sumSavings = (rows: typeof recs) =>
    rows.reduce((acc, r) => acc + (r.monthlyHigh || 0), 0);

  const totals = {
    auto_fix_candidate: sumSavings(buckets.auto_fix_candidate),
    approval_required:  sumSavings(buckets.approval_required),
    report_only:        sumSavings(buckets.report_only),
    blocked:            sumSavings(buckets.blocked),
  };
  const grandTotal = totals.auto_fix_candidate + totals.approval_required + totals.report_only + totals.blocked;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recommendations</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          {recs.length === 0
            ? "What the scanner thinks you should do."
            : <>~${Math.round(grandTotal).toLocaleString()}<span className="text-zinc-500"> per month if applied.</span></>}
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Every recommendation traces back to a finding the scanner produced.
          Approval-required rows flow into the approval queue; the rest stay
          here for context.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            The recommendations table hasn&apos;t been migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code> to populate this view.
          </p>
        </div>
      )}

      {!migrationPending && recs.length === 0 && (
        <Link
          href="/dashboard/connect-cloud"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-12 text-center"
        >
          <p className="text-[15px] font-semibold text-white mb-1">No recommendations yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
            Connect a cloud and run a scan — the scanner produces recommendations
            alongside findings within seconds.
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
            Connect a cloud
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {recs.length > 0 && (
        <div className="space-y-10">
          {(["approval_required", "auto_fix_candidate", "report_only", "blocked"] as Disposition[]).map((d) => {
            const rows = buckets[d];
            if (rows.length === 0) return null;
            return (
              <section key={d}>
                <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-0.5">{DISPOSITION_LABEL[d]}</p>
                    <p className="text-[11px] text-zinc-600">{DISPOSITION_HINT[d]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-semibold text-white tabular-nums">
                      {totals[d] > 0 ? `$${Math.round(totals[d]).toLocaleString()}/mo` : "—"}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500">{rows.length} item{rows.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <ul className="surface-glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/dashboard/findings/${r.findingId}`}
                        className="group flex items-start gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                            {r.riskLevel && (
                              <span className={RISK_TONE[r.riskLevel]}>{r.riskLevel} risk</span>
                            )}
                          </div>
                          <p className="text-[14px] font-medium text-white">{r.title}</p>
                          <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 line-clamp-2">{r.rationale}</p>
                          {r.monthlyHigh > 0 && (
                            <p className="text-[11px] text-emerald-300/80 mt-1">~${r.monthlyHigh.toFixed(0)}/mo if applied</p>
                          )}
                        </div>
                        <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-2 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
