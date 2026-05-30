/**
 * /dashboard/workforce/department/[dept] — every engineer in one
 * department, aggregated.
 *
 * Folds the per-engineer 30-day attempt counts into one department-
 * level view so operators can see "what's my whole Security org doing
 * this month" without clicking into each engineer.
 *
 * No mocks: empty departments render honest zero counts. Departments
 * with no engineers in the client product layer return notFound — the
 * URL space exposes only client-facing departments.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type AgentEngineer,
  type WorkforceDepartment,
} from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";

const DEPARTMENT_SET = new Set<WorkforceDepartment>([
  "perception", "reasoning", "planning", "safety", "verification",
  "memory", "workflow", "devops", "database", "security", "finops",
  "observability", "incident_response", "marketing", "sales",
]);

function clampDept(input: string): WorkforceDepartment | null {
  return DEPARTMENT_SET.has(input as WorkforceDepartment) ? (input as WorkforceDepartment) : null;
}

export default async function WorkforceDepartmentPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const { dept: deptRaw } = await params;
  const dept = clampDept(deptRaw);
  if (!dept) notFound();

  const engineers: readonly AgentEngineer[] = AGENT_WORKFORCE_REGISTRY.filter(
    (e) => e.productLayer === "client" && e.department === dept,
  );
  if (engineers.length === 0) notFound();

  const ctx = await currentContext();

  // Per-engineer 30-day attempt counts. We split by runtimeDecision
  // so the department roll-up tile shows allowed/approval/blocked
  // splits, not just a single total.
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const engineerIds = engineers.map((e) => e.id);
  type PerEngineer = { allowed: number; requires_approval: number; blocked: number; total: number };
  const counts = new Map<string, PerEngineer>();
  for (const id of engineerIds) counts.set(id, { allowed: 0, requires_approval: 0, blocked: 0, total: 0 });

  let migrationPending = false;
  const pendingByEngineer = new Map<string, number>();
  if (ctx.isAuthenticated && ctx.organizationId) {
    try {
      const rows = await prisma.agentEngineerActionAttempt.groupBy({
        by: ["engineerId", "runtimeDecision"],
        where: {
          organizationId: String(ctx.organizationId),
          engineerId: { in: engineerIds },
          createdAt: { gte: since30d },
        },
        _count: { _all: true },
      });
      for (const r of rows) {
        const row = counts.get(r.engineerId);
        if (!row) continue;
        if (r.runtimeDecision === "allowed")           row.allowed += r._count._all;
        else if (r.runtimeDecision === "requires_approval") row.requires_approval += r._count._all;
        else if (r.runtimeDecision === "blocked")      row.blocked += r._count._all;
        row.total = row.allowed + row.requires_approval + row.blocked;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
        migrationPending = true;
      } else {
        throw err;
      }
    }
    try {
      const pendingRows = await prisma.engineerApprovalSnapshot.groupBy({
        by: ["engineerId"],
        where: {
          organizationId: String(ctx.organizationId),
          engineerId: { in: engineerIds },
          status: "pending",
        },
        _count: { _all: true },
      });
      for (const r of pendingRows) pendingByEngineer.set(r.engineerId, r._count._all);
    } catch {
      // empty map fallback — engineers render '0 pending' honestly.
    }
  }
  const totalPending = Array.from(pendingByEngineer.values()).reduce((a, b) => a + b, 0);

  // Department-level rollup.
  const rollup = engineers.reduce(
    (acc, e) => {
      const c = counts.get(e.id) ?? { allowed: 0, requires_approval: 0, blocked: 0, total: 0 };
      acc.allowed += c.allowed;
      acc.requires_approval += c.requires_approval;
      acc.blocked += c.blocked;
      acc.total += c.total;
      return acc;
    },
    { allowed: 0, requires_approval: 0, blocked: 0, total: 0 },
  );

  const totalMissingPieces = engineers.reduce((acc, e) => acc + e.missingPieces.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">department · {dept.replace(/_/g, " ")}</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          The {dept.replace(/_/g, " ")} engineers.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          {engineers.length} engineer{engineers.length === 1 ? "" : "s"} in this department.
          Rollup is the sum of every engineer&apos;s gated attempts in the
          last 30 days, scoped to your workspace.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            AgentEngineerActionAttempt table not migrated. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {/* Department rollup */}
      <section className="mb-4 grid grid-cols-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
        <RollupTile label="total"             count={rollup.total}             tone="text-white" />
        <RollupTile label="allowed"           count={rollup.allowed}           tone={rollup.allowed > 0 ? "text-emerald-300" : "text-zinc-600"} />
        <RollupTile label="requires approval" count={rollup.requires_approval} tone={rollup.requires_approval > 0 ? "text-amber-300" : "text-zinc-600"} />
        <RollupTile label="blocked"           count={rollup.blocked}           tone={rollup.blocked > 0 ? "text-rose-300" : "text-zinc-600"} />
      </section>

      {/* Department-wide pending approvals — separate from the
          attempts rollup because pending count is a 'now' signal,
          not a 30-day cumulative one. */}
      {totalPending > 0 && (
        <div className="mb-10 rounded-2xl border border-amber-500/15 bg-amber-500/[0.03] px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-amber-100/85">
            <span className="font-semibold text-amber-200 tabular-nums">{totalPending}</span> approval{totalPending === 1 ? "" : "s"} waiting on a workspace decision across this department.
          </p>
          <Link href="/dashboard/workforce/approvals" className="text-[11px] font-mono text-amber-200 hover:text-white whitespace-nowrap">
            review queue →
          </Link>
        </div>
      )}
      {totalPending === 0 && (
        <div className="mb-10" aria-hidden />
      )}

      {/* Engineer rows */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">engineers</p>
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {engineers.map((e) => {
            const c = counts.get(e.id) ?? { allowed: 0, requires_approval: 0, blocked: 0, total: 0 };
            const pending = pendingByEngineer.get(e.id) ?? 0;
            return (
              <li key={e.id}>
                <Link
                  href={`/dashboard/workforce/${e.id}`}
                  className="group flex items-start justify-between gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      <span className="text-zinc-300">{e.displayName}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500">{e.id}</span>
                    </div>
                    <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 line-clamp-2">{e.role}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
                      <span className={c.total > 0 ? "text-zinc-300" : "text-zinc-600"}>
                        <span className="tabular-nums">{c.total}</span> attempt{c.total === 1 ? "" : "s"} · 30d
                      </span>
                      {c.allowed > 0 &&           <span className="text-emerald-300">· {c.allowed} allowed</span>}
                      {c.requires_approval > 0 && <span className="text-amber-300">· {c.requires_approval} approval</span>}
                      {c.blocked > 0 &&           <span className="text-rose-300">· {c.blocked} blocked</span>}
                      {pending > 0 &&              <span className="text-amber-300">· {pending} pending</span>}
                    </div>
                    {e.missingPieces.length > 0 && (
                      <p className="text-[11px] text-amber-300/80 mt-2 inline-flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-3 w-3" />
                        {e.missingPieces.length} missing piece{e.missingPieces.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        {totalMissingPieces > 0
          ? `${totalMissingPieces} setup piece${totalMissingPieces === 1 ? "" : "s"} still missing across this department.`
          : "Every engineer in this department reports a complete setup posture."}
      </p>
    </div>
  );
}

function RollupTile({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className={`text-[22px] font-semibold tabular-nums ${tone}`}>{count}</p>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
