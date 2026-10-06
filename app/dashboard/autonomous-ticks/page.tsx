/**
 * /dashboard/autonomous-ticks — Phase 541.
 *
 * Surfaces AutonomousTickLog rows (written by the Phase 513 cron
 * /api/cron/releaseops-autonomous-tick). Operators get visibility
 * into what the AGI did on its own without scrolling past unrelated
 * cards on the autonomy cockpit.
 *
 * 50 most-recent ticks for the workspace, each row showing the
 * total/ok/error/skipped counts and a JSON-collapsed report. Honest
 * empty state when the cron hasn't fired yet — no fabricated rows.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TickRow {
  id: string;
  totalRuns: number;
  okRuns: number;
  errorRuns: number;
  skippedRuns: number;
  generatedAt: Date;
  reportJson: unknown;
}

export default async function AutonomousTicksPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/autonomous-ticks");
  }

  let ticks: TickRow[] = [];
  let migrationPending = false;
  try {
    ticks = await prisma.autonomousTickLog.findMany({
      where: { organizationId: String(ctx.organizationId) },
      orderBy: { generatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        totalRuns: true,
        okRuns: true,
        errorRuns: true,
        skippedRuns: true,
        generatedAt: true,
        reportJson: true,
      },
    }) as typeof ticks;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  // Aggregate counts for a header strip — operators see "how much has
  // the AGI been doing on its own this window" at a glance.
  const totals = ticks.reduce(
    (acc, t) => {
      acc.runs += t.totalRuns;
      acc.ok += t.okRuns;
      acc.errors += t.errorRuns;
      acc.skipped += t.skippedRuns;
      return acc;
    },
    { runs: 0, ok: 0, errors: 0, skipped: 0 },
  );

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">autonomous ticks</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          What the AGI did on its own.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Each row is one autonomous cron tick — the AGI evaluated its
          memory, decided what to run, and reported the outcome without
          a human asking. Tick logs are append-only; operators see the
          trajectory, not just the latest cycle.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            AutonomousTickLog table not migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {/* Aggregate strip */}
      {ticks.length > 0 && (
        <section className="mb-10 grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
          <Tile label="runs"    count={totals.runs}    tone="text-white" />
          <Tile label="ok"      count={totals.ok}      tone={totals.ok > 0 ? "text-emerald-300" : "text-zinc-600"} />
          <Tile label="errors"  count={totals.errors}  tone={totals.errors > 0 ? "text-rose-300" : "text-zinc-600"} />
          <Tile label="skipped" count={totals.skipped} tone={totals.skipped > 0 ? "text-zinc-300" : "text-zinc-600"} />
        </section>
      )}

      {!migrationPending && ticks.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-12 text-center">
          <CpuChipIcon className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-white mb-1">The AGI hasn&apos;t ticked here yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto">
            The hourly <code className="font-mono">releaseops-autonomous-tick</code> cron will start logging once the AGI has at least one engine to evaluate.
          </p>
        </div>
      )}

      {/* Tick feed */}
      {ticks.length > 0 && (
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">recent ticks · {ticks.length}</p>
          <a
            href="/api/dashboard/autonomous-ticks/export.csv"
            download
            className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
            title="Download up to 5000 tick logs as CSV"
          >
            download .csv
          </a>
        </div>
      )}
      {ticks.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {ticks.map((t) => (
            <li key={t.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-zinc-300">{t.totalRuns} run{t.totalRuns === 1 ? "" : "s"}</span>
                    {t.okRuns > 0 &&     <><span className="text-zinc-500">·</span><span className="text-emerald-300">{t.okRuns} ok</span></>}
                    {t.errorRuns > 0 &&  <><span className="text-zinc-500">·</span><span className="text-rose-300">{t.errorRuns} error</span></>}
                    {t.skippedRuns > 0 && <><span className="text-zinc-500">·</span><span className="text-zinc-300">{t.skippedRuns} skipped</span></>}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">tick · {t.id}</p>
                </div>
                <p className="text-[10px] font-mono text-zinc-600 shrink-0 text-right">
                  {t.generatedAt.toISOString()}
                </p>
              </div>
              {/* Collapsible report — <details> keeps the row scannable
                  while still letting operators inspect the JSON. */}
              <details className="mt-3">
                <summary className="text-[11px] font-mono text-zinc-500 cursor-pointer hover:text-white transition-colors select-none">
                  report
                </summary>
                <pre className="mt-2 text-[10.5px] font-mono text-zinc-300 leading-relaxed bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(t.reportJson, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-[11px] text-zinc-600 leading-relaxed">
        Tick logs ship via the hourly <Link href="/dashboard/agi-cockpit" className="text-zinc-400 hover:text-white underline">AGI cockpit</Link> cron.
        See <Link href="/dashboard/autonomy" className="text-zinc-400 hover:text-white underline">autonomy</Link> for the live 9-stage loop view.
      </p>
    </div>
  );
}

function Tile({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className={`text-[22px] font-semibold tabular-nums ${tone}`}>{count}</p>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
