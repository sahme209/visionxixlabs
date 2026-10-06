/**
 * /dashboard/cron-health — Phase 673.
 *
 * Per-cron health snapshot from the in-memory tracker. Shows success
 * rate, tick/error counts, streak, last-tick timestamp. Highlights
 * crons where consecutive failures >= 3 (self-heal is skipping).
 *
 * Ships the missing page called out by Phase 670's fs guard.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { readCronHealth } from "@/lib/autonomy/cronHealthTracker";
import { CRON_CATALOG } from "@/lib/autonomy/cronHealthCatalog";

export const dynamic = "force-dynamic";

export default async function CronHealthPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/cron-health");
  }
  const snapshots = CRON_CATALOG.map((spec) => ({
    ...spec,
    health: readCronHealth({ cronName: spec.id }),
  }));
  const skipping = snapshots.filter((s) => s.health.consecutiveFailures >= 3).length;

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">cron-health</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">{snapshots.length} crons</span>
          {skipping > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-rose-300">{skipping} self-heal skipping</span>
            </>
          )}
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ClockIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Cron health
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-2xl">
          Per-cron tick outcome tracker — in-memory, per-process (ephemeral). Long-term audit lives in
          <span className="font-mono text-zinc-300"> OutboundNotificationRecord</span>. Vercel Cron
          config is the source of truth for schedule.
        </p>
      </header>

      <ul className="grid sm:grid-cols-2 gap-3">
        {snapshots.map((s) => {
          const failing = s.health.consecutiveFailures >= 3;
          const rate = Math.round(s.health.successRate * 100);
          const rateTone = failing ? "text-rose-300" : rate >= 95 ? "text-emerald-300" : rate >= 80 ? "text-zinc-300" : "text-rose-300";
          return (
            <li key={s.id} className={`rounded-md border ${failing ? "border-rose-500/30 bg-rose-500/[0.04]" : "border-white/[0.06] bg-white/[0.012]"} p-4`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[13.5px] font-medium text-white">{s.label}</p>
                <span className={`text-[11px] font-mono tabular-nums ${rateTone}`}>{s.health.total === 0 ? "no ticks yet" : `${rate}%`}</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mb-2">{s.id} · {s.schedule}</p>
              <p className="text-[12px] text-zinc-400 leading-relaxed mb-3">{s.description}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase text-zinc-500">Ticks</p>
                  <p className="text-[13px] font-semibold tabular-nums text-zinc-200">{s.health.total}</p>
                </div>
                <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase text-zinc-500">Errors</p>
                  <p className={`text-[13px] font-semibold tabular-nums ${s.health.failureCount > 0 ? "text-rose-300" : "text-zinc-200"}`}>{s.health.failureCount}</p>
                </div>
                <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                  <p className="text-[9px] font-mono uppercase text-zinc-500">Streak</p>
                  <p className={`text-[13px] font-semibold tabular-nums ${failing ? "text-rose-300" : "text-zinc-200"}`}>{s.health.consecutiveFailures}</p>
                </div>
              </div>
              {s.health.lastAt && (
                <p className="text-[10.5px] text-zinc-500 mt-2 font-mono">last tick :: {s.health.lastAt.slice(0, 19).replace("T", " ")}</p>
              )}
              {failing && (
                <p className="text-[11px] text-rose-200/80 mt-2 font-mono inline-flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  self-heal is skipping this cron
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
