/**
 * /dashboard/approvals — the live approval queue.
 *
 * Reads AxiomApprovalItem scoped by org. These rows are written by
 * persistScanRun whenever a scanner-classified 'security_remediation'
 * or 'iam_modification' or 'drift_correction' recommendation lands.
 * Until a real executor is wired (next phase), 'Approve' simply
 * transitions the item's status — no mutation hits AWS.
 *
 * Empty state explains the contract: 'this fills when a scan finds
 * something that needs a human gate.' Migration-pending degrades
 * honestly so the page renders during the deploy → migration window.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { BulkProvider, BulkRowCheckbox, BulkActionBar, BulkSelectAll } from "./BulkActions";

export const dynamic = "force-dynamic";

type Status = "pending" | "approved" | "rejected" | "snoozed" | "applied" | "failed" | "expired";
type Risk = "low" | "medium" | "high";

const STATUS_TONE: Record<Status, string> = {
  pending:  "text-amber-300",
  snoozed:  "text-zinc-400",
  approved: "text-emerald-300",
  applied:  "text-emerald-400",
  rejected: "text-zinc-500",
  failed:   "text-rose-400",
  expired:  "text-rose-300",
};

const RISK_TONE: Record<Risk, string> = {
  high:   "text-rose-300",
  medium: "text-amber-300",
  low:    "text-zinc-400",
};

export default async function ApprovalsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/approvals");
  }

  let items: Array<{
    id: string;
    title: string;
    provider: string;
    region: string;
    status: Status;
    riskLevel: Risk;
    dispositionReason: string;
    monthlyLow: number;
    monthlyHigh: number;
    createdAt: Date;
    planItemId: string;
  }> = [];
  let migrationPending = false;
  try {
    items = await prisma.axiomApprovalItem.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      take: 100,
      select: {
        id: true,
        title: true,
        provider: true,
        region: true,
        status: true,
        riskLevel: true,
        dispositionReason: true,
        monthlyLow: true,
        monthlyHigh: true,
        createdAt: true,
        planItemId: true,
      },
    }) as typeof items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  // Resolve approval → source finding via planItemId → recommendationId
  // → findingId. One bulk join keeps the cost flat regardless of the
  // 100-row page size. AxiomExecutionPlanItem.recommendationId is
  // nullable (some plans skip the recommendation gateway), so the
  // Map covers only the rows where the trace lands cleanly.
  const planItemIds = items.map((i) => i.planItemId);
  const sourceByApprovalId = new Map<string, { findingId: string; recId: string }>();
  if (planItemIds.length > 0) {
    try {
      const planItems = await prisma.axiomExecutionPlanItem.findMany({
        where: { id: { in: planItemIds } },
        select: {
          id: true,
          recommendation: { select: { id: true, findingId: true } },
        },
      });
      const recByPlan = new Map<string, { id: string; findingId: string }>();
      for (const pi of planItems) {
        if (pi.recommendation) recByPlan.set(pi.id, pi.recommendation);
      }
      for (const it of items) {
        const rec = recByPlan.get(it.planItemId);
        if (rec) sourceByApprovalId.set(it.id, { findingId: rec.findingId, recId: rec.id });
      }
    } catch {
      // empty map fallback — rows just won't show the source link.
    }
  }

  const counts = {
    pending:  items.filter((i) => i.status === "pending").length,
    snoozed:  items.filter((i) => i.status === "snoozed").length,
    approved: items.filter((i) => i.status === "approved" || i.status === "applied").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    expired:  items.filter((i) => i.status === "expired").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">approvals</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          What needs your call.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Every row here came from a real recommendation a scanner produced.
          Approving moves the item; no AWS mutation runs until an executor is
          registered for the action class.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            The approval items table hasn&apos;t been migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code> to start populating this queue.
          </p>
        </div>
      )}

      {!migrationPending && items.length === 0 && (
        <Link
          href="/dashboard/findings"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-12 text-center"
        >
          <p className="text-[15px] font-semibold text-white mb-1">Nothing to approve yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
            This queue fills when a scan finds something that needs a human gate
            — IAM policy changes, security-group adjustments, IaC drift.
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
            See findings
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {items.length > 0 && (
        <>
          {/* Status counts. 'expired' tile only renders when there's at
              least one — the hourly /api/cron/expire-approvals worker
              flips items pending for 7+ days to expired so the queue
              top stays honest. */}
          <section className={`mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] grid ${counts.expired > 0 ? "grid-cols-5" : "grid-cols-4"} overflow-hidden`}>
            <CountTile label="pending"  count={counts.pending}  tone={counts.pending > 0 ? "text-amber-300" : "text-zinc-600"} />
            <CountTile label="snoozed"  count={counts.snoozed}  tone="text-zinc-400" />
            <CountTile label="approved" count={counts.approved} tone={counts.approved > 0 ? "text-emerald-300" : "text-zinc-600"} />
            <CountTile label="rejected" count={counts.rejected} tone="text-zinc-500" />
            {counts.expired > 0 && (
              <CountTile label="expired" count={counts.expired} tone="text-rose-300" />
            )}
          </section>

          {/* Approval rows */}
          <BulkProvider>
            <BulkActionBar />
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">queue</p>
                <div className="flex items-center gap-4">
                  <a
                    href="/api/approvals/export.csv"
                    download
                    className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
                    title="Download up to 5000 approval items as CSV"
                  >
                    download .csv
                  </a>
                  <BulkSelectAll allPendingIds={items.filter((i) => i.status === "pending").map((i) => i.id)} />
                </div>
              </div>
              <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
                {items.map((item) => (
                  <li key={item.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      {item.status === "pending" && <BulkRowCheckbox itemId={item.id} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_TONE[item.status]}`}>{item.status}</span>
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${RISK_TONE[item.riskLevel]}`}>· {item.riskLevel} risk</span>
                          <span className="text-[10px] font-mono text-zinc-600">· {item.provider} / {item.region}</span>
                        </div>
                        <p className="text-[14px] font-medium text-white mb-1">{item.title}</p>
                        <p className="text-[12px] text-zinc-500 leading-relaxed">{item.dispositionReason}</p>
                        {item.monthlyLow > 0 && (
                          <p className="text-[11px] text-emerald-300/80 mt-1">
                            ~${item.monthlyLow.toFixed(0)}/mo savings if applied
                          </p>
                        )}
                        {(() => {
                          const src = sourceByApprovalId.get(item.id);
                          if (!src) return null;
                          return (
                            <Link
                              href={`/dashboard/findings/${src.findingId}`}
                              className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                            >
                              source finding →
                            </Link>
                          );
                        })()}
                      </div>
                      {item.status === "pending" && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <ApproveButton itemId={item.id} action="approve" />
                          <ApproveButton itemId={item.id} action="reject" />
                          <SnoozeMenu itemId={item.id} />
                        </div>
                      )}
                      {(item.status === "approved" || item.status === "applied") && (
                        <a
                          href={`/api/approvals/${item.id}/plan`}
                          download
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50 transition-colors"
                        >
                          Download .tf
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </BulkProvider>
        </>
      )}
    </div>
  );
}

function CountTile({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className={`text-[22px] font-semibold tabular-nums ${tone}`}>{count}</p>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

// Form-style POST so the page can be a server component. The action
// route lives at /api/approvals/decide.
function ApproveButton({ itemId, action }: { itemId: string; action: "approve" | "reject" }) {
  return (
    <form action="/api/approvals/decide" method="POST">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
          action === "approve"
            ? "border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50"
            : "border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.18]"
        }`}
      >
        {action === "approve" ? "Approve" : "Reject"}
      </button>
    </form>
  );
}

/** Quiet two-button snooze: 1 day or 7 days. Reactivated by the hourly cron. */
function SnoozeMenu({ itemId }: { itemId: string }) {
  return (
    <div className="flex items-center gap-1">
      {([
        { days: "1", label: "1d" },
        { days: "7", label: "7d" },
      ] as const).map((opt) => (
        <form key={opt.days} action="/api/approvals/snooze" method="POST">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="days" value={opt.days} />
          <button
            type="submit"
            className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 transition-colors"
            title={`Snooze for ${opt.days} day${opt.days === "1" ? "" : "s"}`}
          >
            snooze {opt.label}
          </button>
        </form>
      ))}
    </div>
  );
}
