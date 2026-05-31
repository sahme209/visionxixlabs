/**
 * /dashboard/workforce/compare — side-by-side engineer view.
 *
 * Operator picks 2–4 engineer ids via ?ids=a,b,c,d. Each becomes a
 * column with the same metric set the detail page surfaces:
 *   · 30-day attempt rollup (allowed / approval / blocked)
 *   · pending approval count
 *   · median decision latency
 *   · executed vs failed all-time
 *   · missing setup pieces count
 *   · highest-risk action label
 *
 * Empty / bad ?ids picks the first 3 client engineers as a default so
 * the URL is bookmarkable without flags. Bogus ids get skipped, not
 * 404'd — the operator just sees the valid ones.
 */

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type AgentEngineer,
} from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";

interface ColumnData {
  engineer: AgentEngineer;
  attempts30d: { allowed: number; requires_approval: number; blocked: number; total: number };
  pending: number;
  medianLatencyMs: number | null;
  executed: number;
  failed: number;
  agi: { total: number; ai_generated: number };
  specialty: { hasRow: boolean; outcome: string | null; updatedAt: Date | null };
  qaCount: number;
}

// Mirror of agiKindsForDepartment elsewhere — keeps the comparison
// column aligned with the engineer detail's AGI panel.
function agiKindsForDepartment(dept: string): string[] {
  if (dept === "safety" || dept === "planning" || dept === "reasoning") return ["council"];
  if (dept === "incident_response" || dept === "security" || dept === "devops" || dept === "finops" || dept === "observability") return ["triage", "remediation"];
  return ["council", "triage", "remediation"];
}

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

function formatMs(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default async function CompareEngineersPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const params = await searchParams;
  const requested = parseIds(params.ids);

  // Resolve requested ids, skip unknowns. If empty, default to the
  // first 3 client engineers so the URL is bookmarkable bare.
  const clientEngineers = AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client");
  const lookup = new Map(clientEngineers.map((e) => [e.id, e] as const));
  let engineers: AgentEngineer[] = requested
    .map((id) => lookup.get(id))
    .filter((e): e is AgentEngineer => e != null);
  if (engineers.length === 0) {
    engineers = clientEngineers.slice(0, 3);
  }

  const ctx = await currentContext();

  // Pull all the metrics in parallel — one query per metric, scoped
  // by engineerId IN […]. Cheaper than N queries per engineer.
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const engineerIds = engineers.map((e) => e.id);

  let attemptRows: Array<{ engineerId: string; runtimeDecision: string; _count: { _all: number } }> = [];
  let pendingRows: Array<{ engineerId: string; _count: { _all: number } }> = [];
  let execRows: Array<{ engineerId: string; executionStatus: string; _count: { _all: number } }> = [];
  let latencyRows: Array<{ engineerId: string; createdAt: Date; decidedAt: Date | null }> = [];
  let agiRows: Array<{ targetKind: string; outcome: string; _count: { _all: number } }> = [];
  let specialtyRows: Array<{ targetId: string; outcome: string; updatedAt: Date }> = [];
  let qaRows: Array<{ targetId: string }> = [];

  if (ctx.isAuthenticated && ctx.organizationId) {
    const org = String(ctx.organizationId);
    [attemptRows, pendingRows, execRows, latencyRows, agiRows, specialtyRows, qaRows] = await Promise.all([
      prisma.agentEngineerActionAttempt.groupBy({
        by: ["engineerId", "runtimeDecision"],
        where: { organizationId: org, engineerId: { in: engineerIds }, createdAt: { gte: since30d } },
        _count: { _all: true },
      }).catch(() => []) as Promise<typeof attemptRows>,
      prisma.engineerApprovalSnapshot.groupBy({
        by: ["engineerId"],
        where: { organizationId: org, engineerId: { in: engineerIds }, status: "pending" },
        _count: { _all: true },
      }).catch(() => []) as Promise<typeof pendingRows>,
      prisma.engineerApprovalSnapshot.groupBy({
        by: ["engineerId", "executionStatus"],
        where: { organizationId: org, engineerId: { in: engineerIds } },
        _count: { _all: true },
      }).catch(() => []) as Promise<typeof execRows>,
      prisma.engineerApprovalSnapshot.findMany({
        where: { organizationId: org, engineerId: { in: engineerIds }, decidedAt: { not: null } },
        orderBy: { decidedAt: "desc" },
        take: 50 * engineers.length, // ~50 per engineer; sufficient for median
        select: { engineerId: true, createdAt: true, decidedAt: true },
      }).catch(() => []) as Promise<typeof latencyRows>,
      prisma.aiRationaleEnrichment.groupBy({
        by: ["targetKind", "outcome"],
        where: { organizationId: org },
        _count: { _all: true },
      }).catch(() => []) as Promise<typeof agiRows>,
      prisma.aiRationaleEnrichment.findMany({
        where: {
          organizationId: org,
          targetKind: "engineer_specialty",
          targetId: { in: engineerIds },
        },
        select: { targetId: true, outcome: true, updatedAt: true },
      }).catch(() => []) as Promise<typeof specialtyRows>,
      prisma.aiRationaleEnrichment.findMany({
        where: {
          organizationId: org,
          targetKind: "engineer_qa",
          OR: engineerIds.map((id) => ({ targetId: { startsWith: `${id}:` } })),
        },
        select: { targetId: true },
      }).catch(() => []) as Promise<typeof qaRows>,
    ]);
  }

  // Per-engineer Q&A count derived in-app from the targetId prefix.
  const qaCountByEngineer = new Map<string, number>();
  for (const row of qaRows) {
    const colon = row.targetId.indexOf(":");
    if (colon === -1) continue;
    const eid = row.targetId.slice(0, colon);
    qaCountByEngineer.set(eid, (qaCountByEngineer.get(eid) ?? 0) + 1);
  }

  const columns: ColumnData[] = engineers.map((e) => {
    const attempts = { allowed: 0, requires_approval: 0, blocked: 0, total: 0 };
    for (const r of attemptRows) {
      if (r.engineerId !== e.id) continue;
      if (r.runtimeDecision === "allowed") attempts.allowed += r._count._all;
      else if (r.runtimeDecision === "requires_approval") attempts.requires_approval += r._count._all;
      else if (r.runtimeDecision === "blocked") attempts.blocked += r._count._all;
    }
    attempts.total = attempts.allowed + attempts.requires_approval + attempts.blocked;

    const pending = pendingRows.find((r) => r.engineerId === e.id)?._count._all ?? 0;

    let executed = 0;
    let failed = 0;
    for (const r of execRows) {
      if (r.engineerId !== e.id) continue;
      if (r.executionStatus === "executed") executed += r._count._all;
      else if (r.executionStatus === "failed") failed += r._count._all;
    }

    const latencies = latencyRows
      .filter((r) => r.engineerId === e.id && r.decidedAt)
      .map((r) => r.decidedAt!.getTime() - r.createdAt.getTime())
      .filter((ms) => ms > 0)
      .sort((a, b) => a - b);
    const medianLatencyMs = latencies.length === 0 ? null : latencies[Math.floor(latencies.length / 2)];

    // AGI activity for this engineer's department. We reduce the
    // workspace-wide groupBy already loaded — no extra query.
    const kinds = new Set(agiKindsForDepartment(e.department));
    const agi = { total: 0, ai_generated: 0 };
    for (const r of agiRows) {
      if (!kinds.has(r.targetKind)) continue;
      agi.total += r._count._all;
      if (r.outcome === "ai_generated") agi.ai_generated += r._count._all;
    }

    const specialtyRow = specialtyRows.find((r) => r.targetId === e.id);
    const specialty = {
      hasRow: specialtyRow != null,
      outcome: specialtyRow?.outcome ?? null,
      updatedAt: specialtyRow?.updatedAt ?? null,
    };

    const qaCount = qaCountByEngineer.get(e.id) ?? 0;

    return { engineer: e, attempts30d: attempts, pending, medianLatencyMs, executed, failed, agi, specialty, qaCount };
  });

  return (
    <div className="max-w-6xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">compare</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Side-by-side.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Up to four engineers compared on the same row of metrics.
          Add or swap with <span className="font-mono text-zinc-300">?ids=a,b,c</span> in the URL.
        </p>
      </header>

      {/* Engineer picker — quick swap to any client engineer via a
          link list. Selecting one toggles it in/out of the current
          comparison via URL math. */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">add / swap</p>
        <div className="flex flex-wrap gap-1.5">
          {clientEngineers.map((e) => {
            const isSelected = columns.some((c) => c.engineer.id === e.id);
            const nextIds = isSelected
              ? columns.filter((c) => c.engineer.id !== e.id).map((c) => c.engineer.id)
              : [...columns.map((c) => c.engineer.id), e.id].slice(0, 4);
            return (
              <Link
                key={e.id}
                href={`/dashboard/workforce/compare?ids=${nextIds.join(",")}`}
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full border transition-colors ${
                  isSelected
                    ? "text-white border-white/[0.18] bg-white/[0.04]"
                    : "text-zinc-500 border-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
                }`}
              >
                {e.id}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Comparison grid */}
      <section className={`grid gap-3 ${columns.length === 1 ? "grid-cols-1" : columns.length === 2 ? "grid-cols-2" : columns.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {columns.map((c) => (
          <article key={c.engineer.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 flex flex-col">
            <header className="mb-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">{c.engineer.department}</p>
              <Link href={`/dashboard/workforce/${c.engineer.id}`} className="text-[14px] font-semibold text-white hover:text-zinc-300 transition-colors">
                {c.engineer.displayName}
              </Link>
              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{c.engineer.id}</p>
            </header>

            <MetricRow label="attempts · 30d"   value={String(c.attempts30d.total)} />
            <MetricRow label="· allowed"        value={String(c.attempts30d.allowed)}            tone={c.attempts30d.allowed > 0 ? "text-emerald-300" : "text-zinc-600"} />
            <MetricRow label="· needs approval" value={String(c.attempts30d.requires_approval)} tone={c.attempts30d.requires_approval > 0 ? "text-amber-300" : "text-zinc-600"} />
            <MetricRow label="· blocked"        value={String(c.attempts30d.blocked)}            tone={c.attempts30d.blocked > 0 ? "text-rose-300" : "text-zinc-600"} />

            <Divider />

            <MetricRow label="pending"        value={String(c.pending)}                                   tone={c.pending > 0 ? "text-amber-300" : "text-zinc-600"} />
            <MetricRow label="median latency" value={c.medianLatencyMs !== null ? formatMs(c.medianLatencyMs) : "—"} tone={c.medianLatencyMs !== null ? "text-white" : "text-zinc-600"} />
            <MetricRow label="executed"       value={String(c.executed)}                                  tone={c.executed > 0 ? "text-emerald-300" : "text-zinc-600"} />
            <MetricRow label="failed"         value={String(c.failed)}                                    tone={c.failed > 0 ? "text-rose-300" : "text-zinc-600"} />

            <Divider />

            <MetricRow label="missing setup" value={String(c.engineer.missingPieces.length)} tone={c.engineer.missingPieces.length > 0 ? "text-amber-300" : "text-emerald-300"} />
            <MetricRow label="approval rule" value={c.engineer.approvalRule.replace(/_/g, " ")} mono />
            <MetricRow label="highest risk"  value={c.engineer.highestRiskAction}                                                              mono />

            <Divider />

            <MetricRow label="AGI rationale"   value={String(c.agi.total)}        tone={c.agi.total > 0        ? "text-violet-300"  : "text-zinc-600"} />
            <MetricRow label="· ai generated"  value={String(c.agi.ai_generated)} tone={c.agi.ai_generated > 0 ? "text-emerald-300" : "text-zinc-600"} />
            <MetricRow
              label="own AGI"
              value={c.specialty.hasRow ? (c.specialty.outcome ?? "—").replace(/_/g, " ") : "not yet"}
              tone={
                c.specialty.outcome === "ai_generated" ? "text-emerald-300" :
                c.specialty.outcome === "fallback_rules" ? "text-amber-300" :
                c.specialty.outcome === "error" ? "text-rose-300" :
                "text-zinc-600"
              }
              mono
            />
            {c.specialty.updatedAt && (
              <MetricRow label="· updated" value={c.specialty.updatedAt.toISOString().slice(0, 10)} mono tone="text-zinc-300" />
            )}
            <MetricRow label="Q&A asked" value={String(c.qaCount)} tone={c.qaCount > 0 ? "text-violet-300" : "text-zinc-600"} />
          </article>
        ))}
      </section>
    </div>
  );
}

function MetricRow({ label, value, tone, mono }: { label: string; value: string; tone?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className={`text-[12px] tabular-nums shrink-0 text-right ${tone ?? "text-zinc-200"} ${mono ? "font-mono" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-white/[0.04]" />;
}
