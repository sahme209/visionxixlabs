/**
 * /dashboard/workforce/health — Phase 577.
 *
 * One surface answers "is my AGI workforce healthy right now?" without
 * forcing the operator to triangulate across the workforce list, the
 * compare view, the ai-call-log, and the engineer-specialty memory
 * feed.
 *
 * Five tiles + two ranked lists. Every number is read from the
 * canonical tables — AgentEngineerActionAttempt, AiRationaleEnrichment,
 * AiCallLog. Empty workspace renders honest zeros, never fabricated.
 *
 *   1. Workforce rationale freshness — how many engineers have a
 *      current specialty rationale (≤7d), how many are stale, how
 *      many have never been run.
 *   2. Last-30d gated attempts — workspace-wide attempt rollup with
 *      the allowed / approval / blocked split.
 *   3. AI provider health — outcome-bucket counts across every AGI
 *      engine in the last 24 hours.
 *   4. Workforce synthesis activity — total synthesized sweeps + the
 *      most-recent synthesis date.
 *   5. Workforce Q&A activity — total operator-prompted questions
 *      in the last 7 days.
 *
 * Plus: top engineers by attempt count, top engineers by block rate
 * (operators see what to focus on without scrolling the workforce
 * list).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { rollupAiCallCost, formatCents } from "@/lib/billing/aiCallCostAttribution";

export const dynamic = "force-dynamic";

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export default async function WorkforceHealthPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/health");
  }
  const org = String(ctx.organizationId);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const clientEngineers = AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client");
  const totalEngineers = clientEngineers.length;

  // Parallel queries — five canonical reads.
  const [
    specialtyRows,
    attemptRows,
    aiCallRows,
    synthRows,
    qaCount,
  ] = await Promise.all([
    prisma.aiRationaleEnrichment.findMany({
      where: { organizationId: org, targetKind: "engineer_specialty" },
      select: { targetId: true, updatedAt: true, outcome: true },
    }).catch(() => [] as Array<{ targetId: string; updatedAt: Date; outcome: string }>),
    prisma.agentEngineerActionAttempt.groupBy({
      by: ["engineerId", "runtimeDecision"],
      where: { organizationId: org, createdAt: { gte: since30d } },
      _count: { _all: true },
    }).catch(() => [] as Array<{ engineerId: string; runtimeDecision: string; _count: { _all: number } }>),
    prisma.aiCallLog.groupBy({
      by: ["outcome"],
      where: { organizationId: org, startedAt: { gte: since24h } },
      _count: { _all: true },
    }).catch(() => [] as Array<{ outcome: string; _count: { _all: number } }>),
    prisma.aiRationaleEnrichment.findMany({
      where: { organizationId: org, targetKind: "workforce_synthesis" },
      orderBy: { generatedAt: "desc" },
      select: { targetId: true, generatedAt: true },
    }).catch(() => [] as Array<{ targetId: string; generatedAt: Date }>),
    prisma.aiRationaleEnrichment.count({
      where: {
        organizationId: org,
        targetKind: "engineer_qa",
        generatedAt: { gte: since7d },
      },
    }).catch(() => 0),
  ]);

  // Workspace-wide AI provider cost — Phase 580. Sample the same
  // 24h window the provider-health tile uses so the two numbers
  // (calls + dollars) line up on the page.
  const costSampleRows = await prisma.aiCallLog.findMany({
    where: { organizationId: org, startedAt: { gte: since24h } },
    select: { model: true, promptTokens: true, completionTokens: true },
    take: 5000,
  }).catch(() => [] as Array<{ model: string | null; promptTokens: number | null; completionTokens: number | null }>);
  const costRollup = await rollupAiCallCost(costSampleRows);

  // Specialty freshness.
  const now = Date.now();
  let fresh = 0;
  let stale = 0;
  for (const r of specialtyRows) {
    if (now - r.updatedAt.getTime() < STALE_THRESHOLD_MS) fresh++; else stale++;
  }
  const missing = Math.max(0, totalEngineers - specialtyRows.length);

  // Attempt rollup + per-engineer aggregation.
  type EngineerAttempts = { allowed: number; requires_approval: number; blocked: number; total: number };
  const perEngineer = new Map<string, EngineerAttempts>();
  const totals = { allowed: 0, requires_approval: 0, blocked: 0, total: 0 };
  for (const row of attemptRows) {
    const bucket = perEngineer.get(row.engineerId) ?? { allowed: 0, requires_approval: 0, blocked: 0, total: 0 };
    if (row.runtimeDecision === "allowed")           bucket.allowed += row._count._all;
    else if (row.runtimeDecision === "requires_approval") bucket.requires_approval += row._count._all;
    else if (row.runtimeDecision === "blocked")      bucket.blocked += row._count._all;
    bucket.total = bucket.allowed + bucket.requires_approval + bucket.blocked;
    perEngineer.set(row.engineerId, bucket);

    if (row.runtimeDecision === "allowed")           totals.allowed += row._count._all;
    else if (row.runtimeDecision === "requires_approval") totals.requires_approval += row._count._all;
    else if (row.runtimeDecision === "blocked")      totals.blocked += row._count._all;
    totals.total += row._count._all;
  }

  // Top engineers by activity + by block-rate.
  const engineerLookup = new Map(clientEngineers.map((e) => [e.id, e]));
  const ranked = Array.from(perEngineer.entries())
    .map(([id, b]) => {
      const e = engineerLookup.get(id);
      const blockRate = b.total === 0 ? 0 : b.blocked / b.total;
      return { id, displayName: e?.displayName ?? id, department: e?.department ?? "?", attempts: b, blockRate };
    })
    .filter((r) => r.attempts.total > 0);
  const topByActivity = [...ranked].sort((a, b) => b.attempts.total - a.attempts.total).slice(0, 5);
  const topByBlockRate = ranked
    .filter((r) => r.attempts.total >= 5 && r.blockRate > 0)
    .sort((a, b) => b.blockRate - a.blockRate)
    .slice(0, 5);

  // AI provider 24h health.
  const aiHealth = { ok: 0, error: 0, timeout: 0, short_circuit: 0 };
  for (const row of aiCallRows) {
    if (row.outcome in aiHealth) {
      aiHealth[row.outcome as keyof typeof aiHealth] = row._count._all;
    }
  }
  const aiTotal = aiHealth.ok + aiHealth.error + aiHealth.timeout + aiHealth.short_circuit;
  const aiSuccessPct = aiHealth.ok + aiHealth.error + aiHealth.timeout > 0
    ? Math.round((aiHealth.ok / (aiHealth.ok + aiHealth.error + aiHealth.timeout)) * 100)
    : null;

  const latestSynth = synthRows[0]?.generatedAt ?? null;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">workforce · health</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-7 w-7 text-violet-300 self-center" />
          Is my AGI workforce healthy?
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-2xl">
          Every number on this page is read from canonical tables — no
          projections, no mock data. Empty workspaces see honest zeros.
        </p>
      </header>

      {/* Tile row 1 — rationale freshness */}
      <section className="mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">specialty rationale · {totalEngineers} engineers</p>
        <div className="grid grid-cols-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
          <Tile label="fresh · ≤7d" count={fresh}    tone={fresh > 0 ? "text-emerald-300" : "text-zinc-600"} />
          <Tile label="stale · >7d" count={stale}    tone={stale > 0 ? "text-amber-300" : "text-zinc-600"} />
          <Tile label="missing"     count={missing}  tone={missing > 0 ? "text-rose-300" : "text-zinc-600"} />
        </div>
      </section>

      {/* Tile row 2 — 30d attempt rollup */}
      <section className="mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">gated attempts · 30d</p>
        <div className="grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
          <Tile label="total"             count={totals.total}             tone="text-white" />
          <Tile label="allowed"           count={totals.allowed}           tone={totals.allowed > 0 ? "text-emerald-300" : "text-zinc-600"} />
          <Tile label="requires approval" count={totals.requires_approval} tone={totals.requires_approval > 0 ? "text-amber-300" : "text-zinc-600"} />
          <Tile label="blocked"           count={totals.blocked}           tone={totals.blocked > 0 ? "text-rose-300" : "text-zinc-600"} />
        </div>
      </section>

      {/* Tile row 3 — AI provider health */}
      <section className="mb-4">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">AI provider · 24h</p>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
            {aiTotal} call{aiTotal === 1 ? "" : "s"}
            {aiSuccessPct !== null && <> · {aiSuccessPct}% success</>}
            {costRollup.totalCents > 0 && <> · {formatCents(costRollup.totalCents)} provider cost</>}
          </span>
        </div>
        <div className="grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
          <Tile label="ok"            count={aiHealth.ok}            tone={aiHealth.ok > 0 ? "text-emerald-300" : "text-zinc-600"} />
          <Tile label="error"         count={aiHealth.error}         tone={aiHealth.error > 0 ? "text-rose-300" : "text-zinc-600"} />
          <Tile label="timeout"       count={aiHealth.timeout}       tone={aiHealth.timeout > 0 ? "text-amber-300" : "text-zinc-600"} />
          <Tile label="short circuit" count={aiHealth.short_circuit} tone={aiHealth.short_circuit > 0 ? "text-violet-300" : "text-zinc-600"} />
        </div>
        {/* Cost breakdown — per-model strip. Renders only when there's
            attributed cost so empty workspaces stay tight. */}
        {costRollup.perModel.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">cost by model:</span>
            {costRollup.perModel.map((m) => (
              <span key={`${m.provider}_${m.modelId}`} className="text-[10.5px] font-mono text-zinc-300 bg-white/[0.025] border border-white/[0.06] rounded-full px-2 py-0.5">
                {m.provider}/{m.modelId} · {formatCents(m.cents)}
              </span>
            ))}
          </div>
        )}
        {costRollup.unattributedCallCount > 0 && (
          <p className="text-[10.5px] text-amber-300/80 mt-2 leading-relaxed">
            {costRollup.unattributedCallCount} call{costRollup.unattributedCallCount === 1 ? "" : "s"} not billed — no AIProviderRate row for the model. Seed via <code className="font-mono">lib/billing/providerRateSeeds.ts</code>.
          </p>
        )}
      </section>

      {/* Tile row 4 — synthesis + Q&A */}
      <section className="mb-10 grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">workforce synthesis</p>
          <p className="text-[24px] font-semibold text-white tabular-nums">{synthRows.length}</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {latestSynth
              ? <>Latest {latestSynth.toISOString().slice(0, 10)}.</>
              : <>No syntheses yet. Hit ask-all + synthesize-all to backfill.</>}
          </p>
          <Link href="/dashboard/workforce/ask-all" className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-white">
            ask-all surface <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">operator Q&A · 7d</p>
          <p className="text-[24px] font-semibold text-white tabular-nums">{qaCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {qaCount > 0
              ? "Questions operators asked engineers in the last week (includes ask-all rows)."
              : "Nobody's asked an engineer anything this week."}
          </p>
        </div>
      </section>

      {/* Rank lists */}
      <section className="grid lg:grid-cols-2 gap-3 mb-10">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">most active engineers · 30d</p>
          {topByActivity.length === 0 ? (
            <p className="text-[12px] text-zinc-500">No gated attempts in window.</p>
          ) : (
            <ul className="space-y-1">
              {topByActivity.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/workforce/${r.id}`} className="group flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <span className="text-[12.5px] text-zinc-200 truncate">{r.displayName}</span>
                    <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">{r.attempts.total}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-300 mb-3">highest block rate · 30d</p>
          {topByBlockRate.length === 0 ? (
            <p className="text-[12px] text-zinc-500">No engineers crossing the noise floor (≥5 attempts, block-rate &gt; 0).</p>
          ) : (
            <ul className="space-y-1">
              {topByBlockRate.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/workforce/${r.id}`} className="group flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <span className="text-[12.5px] text-zinc-200 truncate">{r.displayName}</span>
                    </div>
                    <span className="text-[11px] font-mono text-rose-300 tabular-nums shrink-0">{Math.round(r.blockRate * 100)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Every count here scopes to your organization. Per-engineer detail lives at <Link href="/dashboard/workforce" className="text-zinc-400 hover:text-white underline">workforce</Link>; AI provider drill-down at <Link href="/dashboard/ai-call-log" className="text-zinc-400 hover:text-white underline">ai-call-log</Link>.
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
