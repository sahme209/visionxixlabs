/**
 * /dashboard/scheduled-scans — manage the platform's auto-schedules.
 *
 * Reads AxiomScheduledRun for the tenant. Each row shows the
 * connected cloud account, frequency, when the next run is due,
 * the most recent run's link, consecutive-failure count, and an
 * enabled toggle. The cron worker at
 * /api/cron/scheduled-scan-tick polls these every 15 minutes and
 * skips disabled rows.
 *
 * After 3 consecutive failures the cron auto-disables the row;
 * operators see exactly why on this page and can re-enable once
 * they've fixed the upstream connection.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

const FREQUENCY_LABEL: Record<string, string> = {
  hourly:  "Hourly",
  daily:   "Daily",
  weekly:  "Weekly",
  monthly: "Monthly",
};

function timeUntil(d: Date | null): string {
  if (!d) return "—";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "due now";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const day = Math.floor(hr / 24);
  return `in ${day}d`;
}

export default async function ScheduledScansPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/scheduled-scans");
  }

  let schedules: Array<{
    id: string;
    enabled: boolean;
    frequency: string;
    nextRunAt: Date;
    lastRunId: string | null;
    lastDiffSummary: string | null;
    consecutiveFailures: number;
    cloudAccount: { provider: string; externalAccountId: string };
  }> = [];
  let migrationPending = false;
  try {
    schedules = await prisma.axiomScheduledRun.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [
        { enabled: "desc" },
        { nextRunAt: "asc" },
      ],
      select: {
        id: true,
        enabled: true,
        frequency: true,
        nextRunAt: true,
        lastRunId: true,
        lastDiffSummary: true,
        consecutiveFailures: true,
        cloudAccount: { select: { provider: true, externalAccountId: true } },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">scheduled scans</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Auto-scheduled runs.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Polled every 15 minutes by the cron worker. Disabled rows are
          skipped; three consecutive failures auto-disables a row until you
          re-enable it.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            AxiomScheduledRun table not migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {!migrationPending && schedules.length === 0 && (
        <Link
          href="/dashboard"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-10 text-center"
        >
          <p className="text-[15px] font-semibold text-white mb-1">No schedules yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
            The platform auto-creates a daily schedule the first time you run a
            scan manually. Click Run scan on the dashboard to set up the first.
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
            Open dashboard
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {schedules.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {schedules.map((s) => {
            const failureTone = s.consecutiveFailures >= 2 ? "text-zinc-300" : s.consecutiveFailures > 0 ? "text-zinc-400" : "text-zinc-600";
            return (
              <li key={s.id} className="px-6 py-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider mb-1">
                      <span className={s.enabled ? "text-emerald-300" : "text-zinc-500"}>
                        {s.enabled ? "enabled" : "disabled"}
                      </span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{FREQUENCY_LABEL[s.frequency] ?? s.frequency}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500">{s.cloudAccount.provider}/{s.cloudAccount.externalAccountId}</span>
                    </div>
                    <p className="text-[14px] text-white">
                      {s.enabled
                        ? <>Next run {timeUntil(s.nextRunAt)} <span className="text-zinc-500 font-mono text-[11px]">· {s.nextRunAt.toISOString()}</span></>
                        : <>Paused {s.lastDiffSummary ? <span className="text-zinc-500 text-[12px]">— {s.lastDiffSummary}</span> : null}</>}
                    </p>
                    {s.lastRunId && (
                      <Link
                        href={`/dashboard/scans/${s.lastRunId}`}
                        className="inline-flex items-center gap-1 mt-2 text-[11px] text-zinc-400 hover:text-white transition-colors"
                      >
                        See last run
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    )}
                    {s.consecutiveFailures > 0 && (
                      <p className={`text-[11px] font-mono mt-1 ${failureTone}`}>
                        {s.consecutiveFailures} consecutive failure{s.consecutiveFailures === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <form action="/api/scheduled-scans/toggle" method="POST" className="shrink-0">
                    <input type="hidden" name="scheduleId" value={s.id} />
                    <input type="hidden" name="enabled" value={s.enabled ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-colors ${
                        s.enabled
                          ? "border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.18]"
                          : "border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50"
                      }`}
                    >
                      {s.enabled ? "Pause" : "Resume"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
