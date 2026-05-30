/**
 * /dashboard/cloud-accounts/[id] — per-account command surface.
 *
 * One place an operator can see: the account header, the scheduled
 * scan that owns it (if any), the recent scan runs, the current
 * finding count by severity, and the pending approvals tied to runs
 * on this account.
 *
 * Org guard: every Prisma read scopes through organizationId. A user
 * passing some other tenant's account id gets a notFound, not a
 * cross-tenant data leak.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

type Severity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-rose-300",
  medium:   "text-amber-300",
  low:      "text-zinc-400",
  info:     "text-zinc-500",
};

export default async function CloudAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/cloud-accounts");
  }
  const { id } = await params;

  const account = await prisma.cloudAccount.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      externalAccountId: true,
      alias: true,
      regions: true,
      autopilotMode: true,
      enabled: true,
      lastScannedAt: true,
      connectedAt: true,
    },
  });
  if (!account || account.organizationId !== ctx.organizationId) {
    notFound();
  }

  const [runs, schedule, findingGroups] = await Promise.all([
    prisma.axiomAgentRun.findMany({
      where: { cloudAccountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        trigger: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
      },
    }),
    prisma.axiomScheduledRun.findFirst({
      where: { cloudAccountId: account.id },
      select: {
        id: true,
        frequency: true,
        nextRunAt: true,
        enabled: true,
        consecutiveFailures: true,
        lastDiffSummary: true,
      },
    }),
    prisma.axiomFinding.groupBy({
      by: ["severity"],
      where: { run: { cloudAccountId: account.id } },
      _count: { _all: true },
    }),
  ]);

  // AxiomApprovalItem has no `run` relation in the Prisma schema —
  // resolve via the recent runs we already loaded above (covers the
  // last 10 scans; older approvals are unlikely to still be pending).
  const runIds = runs.map((r) => r.id);
  const pendingApprovalCount = runIds.length > 0
    ? await prisma.axiomApprovalItem.count({
        where: {
          organizationId: ctx.organizationId,
          status: "pending",
          runId: { in: runIds },
        },
      }).catch(() => 0)
    : 0;

  const countsBySeverity: Record<Severity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  };
  for (const g of findingGroups) {
    const s = g.severity as Severity;
    if (s in countsBySeverity) countsBySeverity[s] = g._count._all;
  }
  const totalFindings = Object.values(countsBySeverity).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/cloud-accounts" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Cloud accounts
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-[0.18em] mb-3">
          <span className={account.enabled ? "text-emerald-300" : "text-zinc-500"}>{account.enabled ? "enabled" : "disabled"}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300">{account.provider}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">autopilot · {account.autopilotMode}</span>
        </div>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-2">
          {account.alias ?? account.externalAccountId}
        </h1>
        <p className="text-[12px] font-mono text-zinc-500">{account.externalAccountId}</p>
        <p className="text-[12px] text-zinc-500 mt-1">
          Connected {account.connectedAt.toLocaleDateString()}
          {account.lastScannedAt && (
            <>{" · "}last scanned {account.lastScannedAt.toLocaleString()}</>
          )}
        </p>
      </header>

      {/* Severity counts strip */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">findings · {totalFindings}</p>
          {totalFindings > 0 && (
            <Link href={`/dashboard/findings`} className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors">
              view all
            </Link>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] grid grid-cols-5 overflow-hidden">
          {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
            <div key={s} className="px-4 py-4 text-center">
              <p className={`text-[22px] font-semibold tabular-nums ${countsBySeverity[s] > 0 ? SEVERITY_TONE[s] : "text-zinc-600"}`}>
                {countsBySeverity[s]}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Schedule + approvals row */}
      <section className="mb-10 grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">scheduled scan</p>
          {schedule ? (
            <>
              <p className="text-[14px] font-medium text-white capitalize">{schedule.frequency.replace(/_/g, " ")}</p>
              <p className="text-[12px] text-zinc-500 mt-1">
                {schedule.enabled ? `Next run ${schedule.nextRunAt.toLocaleString()}` : "Paused"}
              </p>
              {schedule.consecutiveFailures > 0 && (
                <p className="text-[11px] text-rose-300/80 mt-2">
                  {schedule.consecutiveFailures} consecutive failure{schedule.consecutiveFailures === 1 ? "" : "s"}
                </p>
              )}
              <Link href="/dashboard/scheduled-scans" className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-white mt-3">
                manage <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="text-[12px] text-zinc-500">No schedule registered for this account.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">pending approvals</p>
          <p className="text-[24px] font-semibold text-white tabular-nums">{pendingApprovalCount}</p>
          {pendingApprovalCount > 0 ? (
            <Link href="/dashboard/approvals" className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 hover:text-amber-200 mt-2">
              review queue <ArrowRightIcon className="h-3 w-3" />
            </Link>
          ) : (
            <p className="text-[11px] text-zinc-500 mt-2">Nothing waiting on your call.</p>
          )}
        </div>
      </section>

      {/* Recent runs */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recent runs · {runs.length}</p>
        {runs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-8 text-center">
            <p className="text-[13px] text-zinc-400">No scan runs recorded for this account yet.</p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/scans/${r.id}`}
                  className="group flex items-start justify-between gap-4 px-6 py-3.5 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      <span className={r.status === "completed" ? "text-emerald-300" : r.status === "failed" ? "text-rose-300" : "text-zinc-400"}>{r.status}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500">{r.trigger}</span>
                    </div>
                    <p className="text-[12px] text-zinc-300 font-mono truncate">{r.id}</p>
                    {r.errorMessage && (
                      <p className="text-[11px] text-rose-300/80 mt-1 truncate">{r.errorMessage}</p>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600 shrink-0 text-right">
                    {r.createdAt.toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
