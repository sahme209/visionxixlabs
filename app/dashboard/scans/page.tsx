/**
 * /dashboard/scans — scan history grouped by run.
 *
 * Each AxiomAgentRun is a single scan execution: the broker
 * AssumeRole'd, read EC2/S3/RDS/VPC, found N findings, and stamped
 * a run row. This page shows those runs in reverse-chronological
 * order so operators can see the platform's heartbeat — manual scans
 * + scheduled cron + any drift triggers — alongside a per-run
 * summary they can click into for the actual findings.
 *
 * Empty state invites the first scan. Migration-pending degrades
 * the same way the other live pages do.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { RunScanButton } from "../RunScanButton";

export const dynamic = "force-dynamic";

type Status = "pending" | "running" | "completed" | "failed" | "partially_completed";
type Trigger = "manual" | "scheduled" | "drift" | "onboarding" | "webhook";

const STATUS_TONE: Record<Status, string> = {
  completed:           "text-emerald-300",
  partially_completed: "text-amber-300",
  running:             "text-zinc-300",
  pending:             "text-zinc-400",
  failed:              "text-rose-300",
};

const TRIGGER_TONE: Record<Trigger, string> = {
  manual:     "text-zinc-200",
  scheduled:  "text-zinc-400",
  drift:      "text-amber-300",
  onboarding: "text-zinc-400",
  webhook:    "text-zinc-400",
};

function timeAgo(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function duration(start: Date | null, end: Date | null): string | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function ScansPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/scans");
  }

  let runs: Array<{
    id: string;
    trigger: string;
    status: string;
    summary: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    cloudAccount: { provider: string; externalAccountId: string; alias: string | null };
    _count: { findings: number };
  }> = [];
  let migrationPending = false;
  try {
    runs = await prisma.axiomAgentRun.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        trigger: true,
        status: true,
        summary: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        cloudAccount: {
          select: { provider: true, externalAccountId: true, alias: true },
        },
        _count: { select: { findings: true } },
      },
    }) as typeof runs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">scans</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Every scan that ran.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl mb-6">
          Manual triggers, scheduled cron, drift detections — every scan
          execution lands here with its account, finding count, and duration.
        </p>
        {!migrationPending && (
          <RunScanButton label={runs.length === 0 ? "Run your first scan" : "Run scan now"} />
        )}
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            The agent run table hasn&apos;t been migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code> to populate this history.
          </p>
        </div>
      )}

      {!migrationPending && runs.length === 0 && (
        <div className="surface-glass rounded-2xl px-7 py-12 text-center">
          <p className="text-[15px] font-semibold text-white mb-1">No scans yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto">
            Click Run scan above to kick off the first one. After that the cron
            re-runs it daily and every successful run shows up here.
          </p>
        </div>
      )}

      {runs.length > 0 && (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">history · latest 50</p>
          <ul className="surface-glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
            {runs.map((r) => {
              const status = r.status as Status;
              const trigger = r.trigger as Trigger;
              const dur = duration(r.startedAt, r.completedAt);
              return (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/scans/${r.id}`}
                    className="group flex items-start gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider mb-1">
                        <span className={STATUS_TONE[status] ?? "text-zinc-400"}>{r.status}</span>
                        <span className="text-zinc-500">·</span>
                        <span className={TRIGGER_TONE[trigger] ?? "text-zinc-400"}>{r.trigger}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-500">{r.cloudAccount.provider}/{r.cloudAccount.externalAccountId}</span>
                      </div>
                      <p className="text-[13px] text-white">
                        {r._count.findings} finding{r._count.findings === 1 ? "" : "s"}
                        {dur && <span className="text-zinc-500"> · {dur}</span>}
                      </p>
                      {r.summary && (
                        <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">{r.summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-600">{timeAgo(r.completedAt ?? r.createdAt)}</span>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
