/**
 * /dashboard/workforce/timeline — Phase 615.
 *
 * Cross-engineer activity timeline. Answers "what did the workforce
 * do in the last 24 hours / 7 days?" without making the operator
 * visit each engineer's detail page in turn.
 *
 * Pure projection — reads AiRationaleEnrichment rows whose targetKind
 * matches one of the domain-engineer registry entries (so the
 * specialty-rationale rows and other unrelated kinds don't pollute
 * the view), groups by time bucket, and renders.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ENGINEER_DOMAIN_IMPLEMENTATIONS } from "@/lib/workforce/domains";
import { readTickSummary, type TickReadback } from "@/lib/workforce/domains/tickLog";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-amber-300",
  error: "text-rose-300",
};

interface ActivityRow {
  targetKind: string;
  targetId: string;
  narrative: string;
  outcome: string;
  modelHint: string | null;
  updatedAt: Date;
  engineerLabel: string;
  permalinkHref: string;
}

function bucketLabel(d: Date, now: number): string {
  const diffMs = now - d.getTime();
  const h = 60 * 60 * 1000;
  if (diffMs < h) return "last hour";
  if (diffMs < 6 * h) return "last 6 hours";
  if (diffMs < 24 * h) return "last 24 hours";
  if (diffMs < 7 * 24 * h) return "last 7 days";
  return "older";
}

export default async function WorkforceTimelinePage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/timeline");
  }

  // Domain kinds we care about — the registry is the source of truth.
  // Any new domain engineer registered automatically appears here.
  const domainKindSet = new Set(ENGINEER_DOMAIN_IMPLEMENTATIONS.map((d) => d.reportTargetKind));
  const tickSummary = await readTickSummary(String(ctx.organizationId));
  const labelByKind = new Map(ENGINEER_DOMAIN_IMPLEMENTATIONS.map((d) => [d.reportTargetKind, d.reportLabel]));
  const homeByKind = new Map(ENGINEER_DOMAIN_IMPLEMENTATIONS.map((d) => [d.reportTargetKind, d.reportHomeRoute]));

  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  let rows: Array<{
    targetKind: string;
    targetId: string;
    narrative: string;
    outcome: string;
    modelHint: string | null;
    updatedAt: Date;
  }> = [];
  try {
    rows = await prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: String(ctx.organizationId),
        targetKind: { in: Array.from(domainKindSet) },
        updatedAt: { gte: since14d },
      },
      select: {
        targetKind: true,
        targetId: true,
        narrative: true,
        outcome: true,
        modelHint: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  } catch {
    rows = [];
  }

  const now = Date.now();
  const decoded: ActivityRow[] = rows.map((r) => ({
    targetKind: r.targetKind,
    targetId: r.targetId,
    narrative: r.narrative,
    outcome: r.outcome,
    modelHint: r.modelHint,
    updatedAt: r.updatedAt,
    engineerLabel: labelByKind.get(r.targetKind) ?? r.targetKind,
    permalinkHref: `/dashboard/agi-memory/${encodeURIComponent(`${r.targetKind}:${r.targetId}`)}`,
  }));

  // Group by bucket label.
  const buckets = new Map<string, ActivityRow[]>();
  for (const row of decoded) {
    const label = bucketLabel(row.updatedAt, now);
    const arr = buckets.get(label) ?? [];
    arr.push(row);
    buckets.set(label, arr);
  }
  const orderedLabels = ["last hour", "last 6 hours", "last 24 hours", "last 7 days", "older"];

  // Outcome counts (last 24h) for the strip.
  const last24h = decoded.filter((r) => now - r.updatedAt.getTime() < 24 * 60 * 60 * 1000);
  const last24Stats = {
    total: last24h.length,
    ai_generated: last24h.filter((r) => r.outcome === "ai_generated").length,
    fallback_rules: last24h.filter((r) => r.outcome === "fallback_rules").length,
    error: last24h.filter((r) => r.outcome === "error").length,
    distinctEngineers: new Set(last24h.map((r) => r.targetKind)).size,
  };

  // Distinct engineers in 7d for the "engineer coverage" tile.
  const last7d = decoded.filter((r) => now - r.updatedAt.getTime() < 7 * 24 * 60 * 60 * 1000);
  const coverageEngineers = new Set(last7d.map((r) => r.targetKind));
  const coveragePct = domainKindSet.size > 0 ? Math.round((coverageEngineers.size / domainKindSet.size) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">activity · domain engineers</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ClockIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Workforce activity timeline
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Every domain engineer report your workspace produced in the last 14 days, newest first.
          Cron sweeps land at :30 each hour; this page is how you see what the workforce did since.
        </p>
      </header>

      {/* Sweep health: prefers the persisted tick summary (Phase 622)
          as the source of truth. Falls back to freshness inference
          when no tick summary exists yet (first run). */}
      <SweepHealth tick={tickSummary} fallbackUpdatedAt={decoded[0]?.updatedAt ?? null} />


      {/* 24h KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Reports · 24h" value={last24Stats.total} tone="text-white" />
        <Stat label="AI-generated · 24h" value={last24Stats.ai_generated} tone="text-emerald-300" />
        <Stat label="Fallback rules · 24h" value={last24Stats.fallback_rules} tone="text-amber-300" />
        <Stat label="Errors · 24h" value={last24Stats.error} tone="text-rose-300" />
      </section>

      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">engineer coverage · 7d</p>
        <p className="text-[14px] text-zinc-200 leading-relaxed">
          <span className="text-white font-semibold">{coverageEngineers.size}</span> of {domainKindSet.size} domain engineers
          ({coveragePct}%) have at least one fresh report in the last 7 days.
        </p>
        <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
          Engineers without coverage either have no triggering signal in your workspace, or the cron sweep hasn't reached them yet.
          Click <span className="text-zinc-300">sweep domains now</span> on the workforce page to force-refresh.
        </p>
      </section>

      {/* Bucketed activity feed */}
      {decoded.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No domain engineer activity in the last 14 days.</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Domain engineers fire on the hourly cron sweep — wait for the next tick or use the manual sweep button.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {orderedLabels.map((label) => {
            const items = buckets.get(label);
            if (!items || items.length === 0) return null;
            return (
              <section key={label}>
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">{label} · {items.length}</p>
                <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
                  {items.map((row) => (
                    <li key={`${row.targetKind}:${row.targetId}:${row.updatedAt.getTime()}`}>
                      <Link href={row.permalinkHref} className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                          <span className="text-zinc-300">{row.engineerLabel}</span>
                          <span className="text-zinc-500">·</span>
                          <span className={OUTCOME_TONE[row.outcome] ?? "text-zinc-400"}>{row.outcome.replace(/_/g, " ")}</span>
                          {row.modelHint && (<><span className="text-zinc-500">·</span><span className="text-zinc-400">{row.modelHint}</span></>)}
                          <span className="text-zinc-500 ml-auto">{row.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                        </div>
                        <p className="text-[12.5px] text-zinc-300 leading-relaxed line-clamp-2">{row.narrative}</p>
                        {homeByKind.get(row.targetKind) && (
                          <p className="text-[10px] font-mono text-zinc-600 mt-1">{homeByKind.get(row.targetKind)}</p>
                        )}
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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">{label}</p>
      <p className={`text-[22px] font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

function SweepHealth({ tick, fallbackUpdatedAt }: { tick: TickReadback | null; fallbackUpdatedAt: Date | null }) {
  // Prefer the persisted tick summary when available — it's the
  // authoritative source for "did the cron actually run?". Falls
  // back to row-freshness inference on cold start.
  const updatedAt = tick?.updatedAt ?? fallbackUpdatedAt;
  if (updatedAt === null) {
    return (
      <section className="mb-8 rounded-2xl border border-zinc-500/20 bg-zinc-500/[0.04] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">sweep health</p>
        <p className="text-[13.5px] text-zinc-200 leading-relaxed">
          No domain engineer activity recorded yet. Either the cron hasn&apos;t reached your workspace
          or no engineer has triggering signal to act on. Use <span className="text-emerald-300">sweep domains now</span> to force a first run.
        </p>
      </section>
    );
  }
  const ageMs = Date.now() - updatedAt.getTime();
  const ageMin = Math.round(ageMs / 60_000);
  const minutesFmt = ageMin < 60 ? `${ageMin}m` : ageMin < 24 * 60 ? `${Math.round(ageMin / 60)}h` : `${Math.round(ageMin / (24 * 60))}d`;
  let tone = "border-emerald-500/20 bg-emerald-500/[0.04]";
  let badge = "text-emerald-300";
  let label = "healthy";
  let note = "Last sweep landed within the expected hourly window.";
  if (ageMs > 3 * 60 * 60 * 1000) {
    tone = "border-rose-500/30 bg-rose-500/[0.06]";
    badge = "text-rose-300";
    label = "degraded";
    note = "No tick recorded in over 3 hours — the hourly cron may be sick. Try the manual sweep button.";
  } else if (ageMs > 2 * 60 * 60 * 1000) {
    tone = "border-amber-500/30 bg-amber-500/[0.06]";
    badge = "text-amber-300";
    label = "stale";
    note = "Last tick landed >2 hours ago — usually fine if the workspace is quiet, but worth a manual sweep if you expect activity.";
  }
  // When tick summary is present, use its narrative — it's first-class
  // ("4 engineers · 3 ai_generated · 1 fallback · 0 errors").
  return (
    <section className={`mb-8 rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap text-[10px] font-mono uppercase tracking-wider">
        <span className="text-zinc-500">sweep health</span>
        {tick && <span className="text-zinc-500">·</span>}
        {tick && <span className="text-zinc-400">{tick.trigger} trigger</span>}
        <span className={`${badge} ml-auto`}>{label}</span>
      </div>
      {tick ? (
        <>
          <p className="text-[14px] text-zinc-100 leading-relaxed">{tick.narrative}</p>
          <p className="text-[12px] text-zinc-400 leading-snug mt-1">
            <span className="font-semibold">{minutesFmt} ago</span> · {updatedAt.toISOString().slice(0, 19).replace("T", " ")}
          </p>
          <p className="text-[12px] text-zinc-400 leading-snug mt-1">{note}</p>
        </>
      ) : (
        <>
          <p className="text-[14px] text-zinc-100 leading-relaxed">
            Last domain engineer report landed <span className="font-semibold">{minutesFmt} ago</span> (at {updatedAt.toISOString().slice(0, 19).replace("T", " ")}).
          </p>
          <p className="text-[12px] text-zinc-400 leading-snug mt-1">{note}</p>
        </>
      )}
    </section>
  );
}
