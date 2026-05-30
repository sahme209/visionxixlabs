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

  const counts = {
    pending:  items.filter((i) => i.status === "pending").length,
    snoozed:  items.filter((i) => i.status === "snoozed").length,
    approved: items.filter((i) => i.status === "approved" || i.status === "applied").length,
    rejected: items.filter((i) => i.status === "rejected").length,
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
          {/* Status counts */}
          <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] grid grid-cols-4 overflow-hidden">
            <CountTile label="pending"  count={counts.pending}  tone={counts.pending > 0 ? "text-amber-300" : "text-zinc-600"} />
            <CountTile label="snoozed"  count={counts.snoozed}  tone="text-zinc-400" />
            <CountTile label="approved" count={counts.approved} tone={counts.approved > 0 ? "text-emerald-300" : "text-zinc-600"} />
            <CountTile label="rejected" count={counts.rejected} tone="text-zinc-500" />
          </section>

          {/* Approval rows */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">queue</p>
            <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
              {items.map((item) => (
                <li key={item.id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
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
                    </div>
                    {item.status === "pending" && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <ApproveButton itemId={item.id} action="approve" />
                        <ApproveButton itemId={item.id} action="reject" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
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
