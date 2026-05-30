/**
 * /dashboard/workforce/activity — workspace-wide engineer activity feed.
 *
 * Unifies AgentEngineerActionAttempt (every gated attempt) with the
 * EngineerApprovalSnapshot (terminal status if the attempt minted one)
 * so an operator sees the complete loop: who tried what, what the gate
 * said, and if it staged, where it ended up.
 *
 * The approvals queue is "pending-first"; this view is "everything,
 * newest first". Filterable by engineer and runtime decision.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ClockIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type AgentEngineer,
} from "@/lib/workforce/agentWorkforceRegistry";

export const metadata: Metadata = {
  title: "Workforce activity · Axiom",
  description: "Every engineer action attempt with runtime decision + final approval outcome.",
};

export const dynamic = "force-dynamic";

const ENGINEER_LOOKUP: Map<string, AgentEngineer> = new Map(
  AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client").map((e) => [e.id, e] as const),
);

const DECISION_FILTERS = ["all", "allowed", "requires_approval", "blocked"] as const;
type DecisionFilter = (typeof DECISION_FILTERS)[number];

function parseDecisionFilter(raw: string | string[] | undefined): DecisionFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return DECISION_FILTERS.includes(v as DecisionFilter) ? (v as DecisionFilter) : "all";
}
function parseEngineerFilter(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  return ENGINEER_LOOKUP.has(v) ? v : null;
}

export default async function WorkforceActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string | string[]; engineer?: string | string[] }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);
  const sp = await searchParams;
  const decisionFilter = parseDecisionFilter(sp.decision);
  const engineerFilter = parseEngineerFilter(sp.engineer);

  // Recent attempts — capped at 100 to keep the page snappy.
  const attempts = await prisma.agentEngineerActionAttempt.findMany({
    where: {
      organizationId: orgId,
      ...(decisionFilter !== "all" ? { runtimeDecision: decisionFilter } : {}),
      ...(engineerFilter ? { engineerId: engineerFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  }).catch(() => [] as Array<never>);

  // Pull the snapshot status for any attempt that minted an approval id.
  const approvalIds = attempts
    .map((a) => a.approvalRequestId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const snapshots = approvalIds.length > 0
    ? await prisma.engineerApprovalSnapshot.findMany({
        where: { approvalRequestId: { in: approvalIds } },
        select: { approvalRequestId: true, status: true, requiredApprovers: true, decidedAt: true },
      }).catch(() => [] as Array<never>)
    : [];
  const snapshotByApprovalId = new Map(
    snapshots.map((s) => [s.approvalRequestId, s] as const),
  );

  // Unfiltered status counts for the pill row + stats.
  const decisionGroups = await prisma.agentEngineerActionAttempt.groupBy({
    by: ["runtimeDecision"],
    where: { organizationId: orgId },
    _count: { _all: true },
  }).catch(() => [] as Array<{ runtimeDecision: string; _count: { _all: number } }>);
  const countByDecision = new Map(decisionGroups.map((g) => [g.runtimeDecision, g._count._all] as const));
  const allowedCount  = countByDecision.get("allowed")           ?? 0;
  const requiresCount = countByDecision.get("requires_approval") ?? 0;
  const blockedCount  = countByDecision.get("blocked")           ?? 0;
  const totalCount    = allowedCount + requiresCount + blockedCount;

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/dashboard/workforce" className="text-[11px] text-zinc-300 hover:text-white inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Workforce
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ClockIcon className="h-4 w-4 text-zinc-500" />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Workforce activity</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Every gated attempt. <span className="text-gradient">In one timeline.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Allowed, requires-approval, blocked — every engineer action attempt that hit the runtime gate. When the attempt minted an approval snapshot, its terminal status threads back into the same row.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Stat label="Allowed" value={allowedCount} icon={CheckCircleIcon} tone="text-emerald-300" />
        <Stat label="Requires approval" value={requiresCount} icon={ShieldCheckIcon} tone="text-amber-300" />
        <Stat label="Blocked" value={blockedCount} icon={ExclamationTriangleIcon} tone="text-rose-300" />
      </section>

      <section className="flex items-center gap-1.5 flex-wrap mb-6">
        <FilterPill href={buildHref(null, engineerFilter)}            active={decisionFilter === "all"}               label={`all · ${totalCount}`} />
        <FilterPill href={buildHref("allowed", engineerFilter)}       active={decisionFilter === "allowed"}           label={`allowed · ${allowedCount}`}  tone="emerald" />
        <FilterPill href={buildHref("requires_approval", engineerFilter)} active={decisionFilter === "requires_approval"} label={`requires approval · ${requiresCount}`} tone="amber" />
        <FilterPill href={buildHref("blocked", engineerFilter)}       active={decisionFilter === "blocked"}           label={`blocked · ${blockedCount}`}  tone="rose" />
        {engineerFilter && (
          <FilterPill
            href={buildHref(decisionFilter === "all" ? null : decisionFilter, null)}
            active
            tone="violet"
            label={`engineer · ${ENGINEER_LOOKUP.get(engineerFilter)?.displayName ?? engineerFilter} ✕`}
          />
        )}
      </section>

      {attempts.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <CpuChipIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">
            {decisionFilter === "all" && !engineerFilter ? "No activity yet." : "No attempts match this filter."}
          </p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            {decisionFilter === "all" && !engineerFilter
              ? "When AGI runs a gated tool, the runtime decision + audit row will appear here."
              : "Try removing the filter or pick a different decision."}
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {attempts.map((a) => {
            const engineer = ENGINEER_LOOKUP.get(a.engineerId);
            const snap = a.approvalRequestId ? snapshotByApprovalId.get(a.approvalRequestId) : null;
            return (
              <ActivityRow
                key={a.id}
                action={a.action}
                engineerId={a.engineerId}
                engineerName={engineer?.displayName ?? a.engineerId}
                runtimeDecision={a.runtimeDecision}
                riskLevel={a.riskLevel}
                effectiveRule={a.effectiveRule}
                requestedBy={a.requestedBy}
                createdAt={a.createdAt}
                correlationId={a.correlationId}
                approvalRequestId={a.approvalRequestId}
                snapshotStatus={snap?.status ?? null}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function buildHref(decision: DecisionFilter | null, engineerId: string | null): string {
  const params = new URLSearchParams();
  if (decision && decision !== "all") params.set("decision", decision);
  if (engineerId) params.set("engineer", engineerId);
  const q = params.toString();
  return q ? `/dashboard/workforce/activity?${q}` : "/dashboard/workforce/activity";
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ShieldCheckIcon; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <Icon className={`h-4 w-4 ${tone} mb-2`} />
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

function FilterPill({
  href, active, label, tone = "zinc",
}: { href: string; active: boolean; label: string; tone?: "zinc" | "amber" | "emerald" | "rose" | "violet" }) {
  const toneClass = {
    zinc:    active ? "bg-white/[0.08] text-white border-white/[0.12]"           : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-zinc-200",
    amber:   active ? "bg-amber-500/15 text-amber-200 border-amber-500/40"       : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-amber-200",
    emerald: active ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40" : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-emerald-200",
    rose:    active ? "bg-rose-500/15 text-rose-200 border-rose-500/40"          : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-rose-200",
    violet:  active ? "bg-violet-500/15 text-white border-violet-500/40"    : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white",
  }[tone];
  return (
    <Link href={href} className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2.5 py-1 transition ${toneClass}`}>
      {label}
    </Link>
  );
}

function ActivityRow(props: {
  action: string;
  engineerId: string;
  engineerName: string;
  runtimeDecision: string;
  riskLevel: string;
  effectiveRule: string;
  requestedBy: string;
  createdAt: Date;
  correlationId: string;
  approvalRequestId: string | null;
  snapshotStatus: string | null;
}) {
  const decisionTone =
    props.runtimeDecision === "allowed"           ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
    props.runtimeDecision === "requires_approval" ? "text-amber-300 bg-amber-500/10 border-amber-500/30"       :
                                                    "text-rose-300 bg-rose-500/10 border-rose-500/30";

  const snapTone =
    props.snapshotStatus === "approved" ? "text-emerald-300" :
    props.snapshotStatus === "rejected" ? "text-rose-300"    :
    props.snapshotStatus === "expired"  ? "text-zinc-400"    :
    props.snapshotStatus === "pending"  ? "text-amber-300"   :
                                          "text-zinc-500";

  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <header className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <CpuChipIcon className="h-4 w-4 text-violet-300 shrink-0" />
          <Link href={`/dashboard/workforce/${props.engineerId}`} className="text-[12px] font-semibold text-white hover:text-white truncate">
            {props.engineerName}
          </Link>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${decisionTone}`}>
          {props.runtimeDecision.replace(/_/g, " ")}
        </span>
      </header>

      <p className="text-[11.5px] font-mono text-zinc-200 mb-1 truncate">{props.action}</p>

      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-500 mb-1">
        <span>risk · {props.riskLevel}</span>
        <span>rule · {props.effectiveRule}</span>
        <span>by · {props.requestedBy}</span>
        {props.snapshotStatus && (
          <span className={snapTone}>snapshot · {props.snapshotStatus}</span>
        )}
        <span className="ml-auto">{props.createdAt.toISOString()}</span>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-600 truncate">correlation · {props.correlationId}</span>
        {props.approvalRequestId && (
          <Link
            href={`/dashboard/workforce/approvals/${props.approvalRequestId}`}
            className="text-[10px] font-mono text-zinc-300 hover:text-white"
          >
            approval · {props.approvalRequestId} →
          </Link>
        )}
      </div>
    </article>
  );
}
