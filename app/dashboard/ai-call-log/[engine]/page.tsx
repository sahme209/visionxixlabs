/**
 * /dashboard/ai-call-log/[engine] — Phase 536.
 *
 * Per-engine drilldown for the AI provider call log. Resumes the
 * Phase 531 arc: the overview surface gave operators every engine in
 * one strip; this page lets them inspect a single engine — latency
 * histogram, outcome split, top error messages, recent calls.
 *
 * Server-rendered (no client state) and reads AiCallLog directly via
 * Prisma. ?scope=global flips off the org filter for the engineer
 * ops view; default scope is the caller's org.
 *
 * Empty engines (engine has no rows in the last 24h) render an
 * honest 'no calls in window' state — no fabricated latency.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { rollupAiCallCost, formatCents } from "@/lib/billing/aiCallCostAttribution";

export const dynamic = "force-dynamic";

const ENGINE_LABEL: Record<string, string> = {
  council_voter:         "Council voter",
  council_rationale:     "Council rationale",
  triage_rationale:      "Triage rationale",
  remediation_rationale: "Remediation rationale",
  memory_summary:        "Memory summary",
  memory_chat:           "Memory chat",
  proactive_suggestion:  "Proactive suggestion",
  ad_hoc:                "Ad-hoc",
};

const OUTCOME_TONE: Record<string, string> = {
  ok:            "text-emerald-300",
  error:         "text-rose-300",
  timeout:       "text-amber-300",
  short_circuit: "text-violet-300",
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export default async function AiCallLogEnginePage({
  params,
  searchParams,
}: {
  params: Promise<{ engine: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/ai-call-log");
  }

  const { engine: engineRaw } = await params;
  const engineName = decodeURIComponent(engineRaw);
  const sp = await searchParams;
  const scope: "org" | "global" = sp.scope === "global" ? "global" : "org";

  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  const orgFilter = scope === "org" ? { organizationId: String(ctx.organizationId) } : {};

  const [recentCalls, outcomeGroups, errorRows] = await Promise.all([
    prisma.aiCallLog.findMany({
      where: {
        engineName,
        startedAt: { gte: since },
        ...orgFilter,
      },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: {
        id: true,
        outcome: true,
        latencyMs: true,
        model: true,
        errorMessage: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        startedAt: true,
      },
    }).catch(() => [] as Array<{
      id: string;
      outcome: string;
      latencyMs: number;
      model: string | null;
      errorMessage: string | null;
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
      startedAt: Date;
    }>),
    prisma.aiCallLog.groupBy({
      by: ["outcome"],
      where: { engineName, startedAt: { gte: since }, ...orgFilter },
      _count: { _all: true },
    }).catch(() => [] as Array<{ outcome: string; _count: { _all: number } }>),
    prisma.aiCallLog.findMany({
      where: {
        engineName,
        startedAt: { gte: since },
        outcome: { in: ["error", "timeout"] },
        errorMessage: { not: null },
        ...orgFilter,
      },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: { errorMessage: true },
    }).catch(() => [] as Array<{ errorMessage: string | null }>),
  ]);

  // Outcome counts.
  const counts = { ok: 0, error: 0, timeout: 0, short_circuit: 0 };
  for (const g of outcomeGroups) {
    if (g.outcome in counts) counts[g.outcome as keyof typeof counts] = g._count._all;
  }
  const totalCalls = counts.ok + counts.error + counts.timeout + counts.short_circuit;
  const provider = counts.ok + counts.error + counts.timeout;
  const successPct = provider === 0 ? null : Math.round((counts.ok / provider) * 100);

  // Latency percentiles — derived in-app from the 200-row sample so we
  // don't need a SQL percentile function. short_circuit rows excluded
  // because they never actually hit the provider.
  const latencies = recentCalls
    .filter((c) => c.outcome !== "short_circuit")
    .map((c) => c.latencyMs)
    .sort((a, b) => a - b);
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);

  // Token totals from the same window.
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  for (const c of recentCalls) {
    totalPromptTokens += c.promptTokens ?? 0;
    totalCompletionTokens += c.completionTokens ?? 0;
  }

  // Cost rollup — bridges every call's (model, tokens) to the rate
  // card via lib/billing. Honest 'rate not configured' when the
  // model isn't in the rate table; never fabricates a $0 cost on
  // unbilled usage. Phase 580.
  const costRollup = await rollupAiCallCost(recentCalls);

  // Top error messages — folded by exact match. We trim to 120 chars
  // so a runaway stack trace doesn't blow up the bucket key.
  const errorBuckets = new Map<string, number>();
  for (const r of errorRows) {
    const key = (r.errorMessage ?? "").trim().slice(0, 120);
    if (!key) continue;
    errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1);
  }
  const topErrors = Array.from(errorBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const engineLabel = ENGINE_LABEL[engineName] ?? engineName;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <Link
        href={`/dashboard/ai-call-log${scope === "global" ? "?scope=global" : ""}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        AI call log
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">engine · {engineName}</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3">
          {engineLabel}
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Last 24 hours · {scope === "global" ? "every tenant" : "your workspace only"}.
          {totalCalls === 0
            ? <> No calls in window — this engine hasn&apos;t been invoked yet.</>
            : <> {totalCalls} call{totalCalls === 1 ? "" : "s"} across {provider} provider hit{provider === 1 ? "" : "s"}.</>}
        </p>
        {/* Scope toggle */}
        <div className="mt-4 flex items-center gap-2 text-[11px] font-mono">
          <Link
            href={`/dashboard/ai-call-log/${encodeURIComponent(engineName)}`}
            className={`px-2.5 py-1 rounded-full border transition-colors ${
              scope === "org"
                ? "text-white border-white/[0.18] bg-white/[0.04]"
                : "text-zinc-500 border-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
            }`}
          >
            org
          </Link>
          <Link
            href={`/dashboard/ai-call-log/${encodeURIComponent(engineName)}?scope=global`}
            className={`px-2.5 py-1 rounded-full border transition-colors ${
              scope === "global"
                ? "text-white border-white/[0.18] bg-white/[0.04]"
                : "text-zinc-500 border-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
            }`}
          >
            global
          </Link>
        </div>
      </header>

      {/* Outcome tiles */}
      <section className="mb-8 grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
        <Tile label="ok"            count={counts.ok}            tone={counts.ok > 0 ? "text-emerald-300" : "text-zinc-600"} />
        <Tile label="error"         count={counts.error}         tone={counts.error > 0 ? "text-rose-300" : "text-zinc-600"} />
        <Tile label="timeout"       count={counts.timeout}       tone={counts.timeout > 0 ? "text-amber-300" : "text-zinc-600"} />
        <Tile label="short circuit" count={counts.short_circuit} tone={counts.short_circuit > 0 ? "text-violet-300" : "text-zinc-600"} />
      </section>

      {/* Latency + tokens tiles */}
      <section className="mb-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="success rate"     value={successPct !== null ? `${successPct}%` : "—"} sub={`${provider} provider hits`} />
        <MetricCard label="latency p50"      value={p50 !== null ? `${p50}ms` : "—"} sub="50th percentile · provider only" />
        <MetricCard label="latency p95"      value={p95 !== null ? `${p95}ms` : "—"} sub="95th percentile" />
        <MetricCard label="latency p99"      value={p99 !== null ? `${p99}ms` : "—"} sub="99th percentile" />
        <MetricCard label="prompt tokens"    value={totalPromptTokens.toLocaleString()}     sub="window total · input" />
        <MetricCard label="completion tokens" value={totalCompletionTokens.toLocaleString()} sub="window total · output" />
        <MetricCard label="window total"     value={totalCalls.toLocaleString()}            sub="every outcome counted" />
        <MetricCard label="sample size"      value={latencies.length.toLocaleString()}      sub="rows used for percentiles" />
      </section>

      {/* Cost rollup tile — Phase 580. Always renders so the
          'rate not configured' state stays visible (operators see
          when a model is uncovered, not a misleading $0). */}
      <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">provider cost · 24h window</p>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
            {costRollup.attributedCallCount} attributed
            {costRollup.unattributedCallCount > 0 && <> · {costRollup.unattributedCallCount} unrated</>}
          </span>
        </div>
        <p className={`text-[24px] font-semibold tabular-nums ${costRollup.totalCents > 0 ? "text-emerald-200" : "text-zinc-600"}`}>
          {formatCents(costRollup.totalCents)}
        </p>
        {costRollup.perModel.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {costRollup.perModel.map((m) => (
              <span key={`${m.provider}_${m.modelId}`} className="text-[10.5px] font-mono text-zinc-400 bg-white/[0.025] border border-white/[0.06] rounded-full px-2 py-0.5">
                {m.provider}/{m.modelId} · {formatCents(m.cents)}
              </span>
            ))}
          </div>
        )}
        {costRollup.unattributedCallCount > 0 && costRollup.attributedCallCount === 0 && (
          <p className="text-[11px] text-amber-300/80 mt-2 leading-relaxed">
            No AIProviderRate row covers the models this engine hit. Seed a rate via lib/billing/providerRateSeeds.ts or insert a row in AIProviderRate.
          </p>
        )}
      </section>

      {/* Top error messages */}
      {topErrors.length > 0 && (
        <section className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">top errors · 24h</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {topErrors.map(([msg, n]) => (
              <li key={msg} className="px-5 py-3 flex items-start justify-between gap-3">
                <p className="text-[12px] font-mono text-rose-200/90 leading-relaxed min-w-0 break-words">{msg}</p>
                <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">{n}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent calls */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">recent calls · {recentCalls.length}</p>
          <a
            href={`/api/dashboard/ai-call-log/export.csv?${new URLSearchParams({
              engineName,
              ...(scope === "global" ? { scope: "global" } : {}),
            }).toString()}`}
            download
            className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
            title="Download up to 5000 rows in the last 24h as CSV"
          >
            download .csv
          </a>
        </div>
        {recentCalls.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
            <p className="text-[13px] text-zinc-400">No calls in the last 24 hours.</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Trigger this engine via the AGI cockpit or wait for the next autonomous tick.
            </p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {recentCalls.slice(0, 50).map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider min-w-0">
                    <span className={OUTCOME_TONE[c.outcome] ?? "text-zinc-400"}>{c.outcome}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-300 truncate">{c.model ?? "no model"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 shrink-0">
                    <span className="tabular-nums">{c.latencyMs}ms</span>
                    {(c.totalTokens ?? 0) > 0 && <span className="tabular-nums">{c.totalTokens}t</span>}
                    <span>{c.startedAt.toISOString().slice(11, 19)}</span>
                  </div>
                </div>
                {c.errorMessage && (
                  <p className="text-[11px] text-rose-300/80 mt-1 leading-snug line-clamp-2">{c.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Latency percentiles are derived from the most-recent 200 provider hits in window.
        short_circuit rows are excluded — they never touched the provider.
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

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <p className="text-[20px] font-semibold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{sub}</p>
    </div>
  );
}
