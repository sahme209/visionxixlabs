/**
 * /dashboard/workforce/[id] — engineer detail.
 *
 * Reads the canonical engineer + the workspace record + recent action
 * attempts. Renders profile, current approval rule (with workspace
 * override badge when in force), recent attempts, and a safe edit CTA.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ComputerDesktopIcon,
  PuzzlePieceIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type ApprovalRule,
} from "@/lib/workforce/agentWorkforceRegistry";

export const metadata: Metadata = {
  title: "Engineer detail · Axiom",
};

export const dynamic = "force-dynamic";

const APPROVAL_LABEL: Record<ApprovalRule, string> = {
  no_approval_needed:      "Auto-OK",
  single_approver:         "Single approval",
  two_step_approval:       "Two-step approval",
  incident_commander_only: "Incident commander only",
  blocked_always:          "Policy-blocked",
};

const APPROVAL_TONE: Record<ApprovalRule, string> = {
  no_approval_needed:      "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  single_approver:         "text-amber-300 bg-amber-500/10 border-amber-500/30",
  two_step_approval:       "text-rose-300 bg-rose-500/10 border-rose-500/30",
  incident_commander_only: "text-rose-300 bg-rose-500/15 border-rose-500/40",
  blocked_always:          "text-zinc-300 bg-zinc-500/10 border-zinc-500/30",
};

export default async function EngineerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") notFound();

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }

  // Read the per-workspace record (if it exists) and the most recent attempts.
  const record = await prisma.agentEngineerRecord.findUnique({
    where: { organizationId_engineerId: { organizationId: String(ctx.organizationId), engineerId: engineer.id } },
  }).catch(() => null);

  const attempts = await prisma.agentEngineerActionAttempt.findMany({
    where: { organizationId: String(ctx.organizationId), engineerId: engineer.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  }).catch(() => []);

  // 30-day rollup — the operator wants "how is this engineer doing"
  // in a glance, not the raw row dump. Honest zeros when the engineer
  // hasn't been used yet, no fabricated numbers.
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rollupGroups = await prisma.agentEngineerActionAttempt.groupBy({
    by: ["runtimeDecision"],
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
      createdAt: { gte: since30d },
    },
    _count: { _all: true },
  }).catch(() => [] as Array<{ runtimeDecision: string; _count: { _all: number } }>);
  const rollup = { allowed: 0, requires_approval: 0, blocked: 0 };
  for (const g of rollupGroups) {
    if (g.runtimeDecision === "allowed") rollup.allowed = g._count._all;
    else if (g.runtimeDecision === "requires_approval") rollup.requires_approval = g._count._all;
    else if (g.runtimeDecision === "blocked") rollup.blocked = g._count._all;
  }
  const totalAttempts30d = rollup.allowed + rollup.requires_approval + rollup.blocked;

  // Most-recent block reason — quick diagnosis of why this engineer is
  // being held back without scrolling to the recent-attempts list.
  const recentBlock = await prisma.agentEngineerActionAttempt.findFirst({
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
      runtimeDecision: "blocked",
    },
    orderBy: { createdAt: "desc" },
    select: { reason: true, createdAt: true, action: true },
  }).catch(() => null);

  // Top-actions breakdown — which actions does this engineer actually
  // attempt? Per-action outcome split lets the operator see "the
  // engineer wants to apply_terraform 40x but is blocked 38 of those".
  const topActionGroups = await prisma.agentEngineerActionAttempt.groupBy({
    by: ["action", "runtimeDecision"],
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
      createdAt: { gte: since30d },
    },
    _count: { _all: true },
  }).catch(() => [] as Array<{ action: string; runtimeDecision: string; _count: { _all: number } }>);

  type ActionRow = { action: string; allowed: number; requires_approval: number; blocked: number; total: number };
  const actionMap = new Map<string, ActionRow>();
  for (const g of topActionGroups) {
    const row = actionMap.get(g.action) ?? {
      action: g.action, allowed: 0, requires_approval: 0, blocked: 0, total: 0,
    };
    if (g.runtimeDecision === "allowed")           row.allowed += g._count._all;
    else if (g.runtimeDecision === "requires_approval") row.requires_approval += g._count._all;
    else if (g.runtimeDecision === "blocked")      row.blocked += g._count._all;
    row.total = row.allowed + row.requires_approval + row.blocked;
    actionMap.set(g.action, row);
  }
  const topActions = Array.from(actionMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Connector readiness — cloud (aws/azure/gcp) + github are the
  // most-load-bearing deps across the workforce. Others stay as
  // honest 'not verified' chips in the dependency grid below.
  const cloudConnectorDeps = engineer.requiredConnectors.filter(
    (c) => c === "aws" || c === "azure" || c === "gcp",
  );
  const githubRequired = engineer.requiredConnectors.includes("github");
  const [cloudAccountRows, githubInstallCount] = await Promise.all([
    cloudConnectorDeps.length > 0
      ? prisma.cloudAccount.findMany({
          where: {
            organizationId: String(ctx.organizationId),
            provider: { in: cloudConnectorDeps as ("aws" | "azure" | "gcp")[] },
            enabled: true,
          },
          select: { provider: true, externalAccountId: true },
        }).catch(() => [] as Array<{ provider: string; externalAccountId: string }>)
      : Promise.resolve([] as Array<{ provider: string; externalAccountId: string }>),
    githubRequired
      ? prisma.gitHubInstallation.count({
          where: { organizationId: String(ctx.organizationId) },
        }).catch(() => 0)
      : Promise.resolve(0),
  ]);
  const connectedProviders = new Set<string>(cloudAccountRows.map((r) => r.provider));
  const githubConnected = githubInstallCount > 0;
  const hasReadinessSection = cloudConnectorDeps.length > 0 || githubRequired;

  const currentRule: ApprovalRule = (record?.currentApprovalRule as ApprovalRule | null) ?? engineer.approvalRule;
  const overrideActive = !!record?.currentApprovalRule && record.currentApprovalRule !== engineer.approvalRule;

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
          <UserGroupIcon className="h-4 w-4 text-zinc-500" />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Engineer · {engineer.department}</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">{engineer.displayName}</h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">{engineer.role}</p>
      </div>

      {/* Approval rule strip */}
      <section className="rounded-2xl border border-violet-500/15 bg-white/[0.015] p-5 mb-6">
        <header className="flex items-center gap-2 mb-3 flex-wrap">
          <ShieldCheckIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Approval rule in this workspace</p>
          {overrideActive && (
            <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 text-amber-300 bg-amber-500/10 border-amber-500/30">
              workspace override
            </span>
          )}
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-[11px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${APPROVAL_TONE[currentRule]}`}>
            {APPROVAL_LABEL[currentRule]}
          </span>
          <span className="text-[11px] text-zinc-500">canonical default: <span className="text-zinc-300">{APPROVAL_LABEL[engineer.approvalRule]}</span></span>
          {record?.isEnabled === false && (
            <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 text-rose-300 bg-rose-500/10 border-rose-500/30">
              disabled in workspace
            </span>
          )}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {engineer.id === "migration_engineer" && (
              <Link
                href={`/dashboard/workforce/${engineer.id}/stage`}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-100 border border-amber-500/40 hover:bg-amber-500/25 transition"
              >
                <ShieldCheckIcon className="h-3 w-3" />
                Stage migration
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            )}
            <Link
              href={`/dashboard/workforce/${engineer.id}/edit`}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-white/[0.12] hover:bg-violet-500/25 transition"
            >
              Tighten rule
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* 30-day rollup — honest zeros if this engineer hasn't been
          exercised in the workspace yet, no fabricated KPIs. */}
      <section className="mb-6">
        <header className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Last 30 days</p>
          <span className="text-[10px] font-mono text-zinc-500">{totalAttempts30d} attempt{totalAttempts30d === 1 ? "" : "s"}</span>
        </header>
        <div className="grid grid-cols-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] overflow-hidden">
          <RollupTile label="allowed"           count={rollup.allowed}           tone={rollup.allowed > 0 ? "text-emerald-300" : "text-zinc-600"} />
          <RollupTile label="requires approval" count={rollup.requires_approval} tone={rollup.requires_approval > 0 ? "text-amber-300" : "text-zinc-600"} />
          <RollupTile label="blocked"           count={rollup.blocked}           tone={rollup.blocked > 0 ? "text-rose-300" : "text-zinc-600"} />
        </div>
        {recentBlock && (
          <p className="text-[11px] text-rose-300/80 mt-2 leading-relaxed">
            Most recent block on <span className="font-mono text-zinc-300">{recentBlock.action}</span> · {recentBlock.reason}
          </p>
        )}
      </section>

      {/* Connector readiness — cloud + github are checkable here.
          Renders only when the engineer requires at least one of
          those connectors. */}
      {hasReadinessSection && (
        <section className="mb-6">
          <header className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Connector readiness</p>
            <Link
              href="/dashboard/connectors"
              className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
            >
              manage
            </Link>
          </header>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {cloudConnectorDeps.map((c) => {
              const isConnected = connectedProviders.has(c);
              return (
                <li key={c} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden />
                    <p className="text-[12px] font-mono uppercase tracking-wider text-white">{c}</p>
                  </div>
                  {isConnected ? (
                    <span className="text-[10px] font-mono text-emerald-300">connected</span>
                  ) : (
                    <Link
                      href="/dashboard/connect-cloud"
                      className="text-[10px] font-mono text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      connect →
                    </Link>
                  )}
                </li>
              );
            })}
            {githubRequired && (
              <li className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${githubConnected ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden />
                  <p className="text-[12px] font-mono uppercase tracking-wider text-white">github</p>
                </div>
                {githubConnected ? (
                  <span className="text-[10px] font-mono text-emerald-300">
                    {githubInstallCount} install{githubInstallCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <Link
                    href="/dashboard/integrations/github"
                    className="text-[10px] font-mono text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    connect →
                  </Link>
                )}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Top actions — only render when this engineer has actually
          attempted something. Empty state lives in 'recent attempts'
          below, no need to double up. */}
      {topActions.length > 0 && (
        <section className="mb-6">
          <header className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Top actions · 30d</p>
            <span className="text-[10px] font-mono text-zinc-500">{topActions.length} of {actionMap.size}</span>
          </header>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {topActions.map((a) => {
              const allowedPct = a.total > 0 ? (a.allowed / a.total) * 100 : 0;
              const approvalPct = a.total > 0 ? (a.requires_approval / a.total) * 100 : 0;
              const blockedPct = a.total > 0 ? (a.blocked / a.total) * 100 : 0;
              return (
                <li key={a.action} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[13px] font-mono text-white truncate">{a.action}</p>
                    <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">{a.total}</span>
                  </div>
                  {/* Stacked bar — emerald/amber/rose proportional to outcomes. */}
                  <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex">
                    {a.allowed > 0 && (
                      <span className="bg-emerald-400/70" style={{ width: `${allowedPct}%` }} />
                    )}
                    {a.requires_approval > 0 && (
                      <span className="bg-amber-400/70" style={{ width: `${approvalPct}%` }} />
                    )}
                    {a.blocked > 0 && (
                      <span className="bg-rose-400/70" style={{ width: `${blockedPct}%` }} />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-500">
                    {a.allowed > 0 &&           <span><span className="text-emerald-300">{a.allowed}</span> allowed</span>}
                    {a.requires_approval > 0 && <span><span className="text-amber-300">{a.requires_approval}</span> needs approval</span>}
                    {a.blocked > 0 &&           <span><span className="text-rose-300">{a.blocked}</span> blocked</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Dependencies grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <DepCard title="Connectors" items={engineer.requiredConnectors.map((c) => c.replace(/_/g, " "))} tone="text-amber-300" />
        <DepCard title="Tools / modules" items={engineer.requiredTools.map((t) => t.replace(/_/g, " "))} tone="text-cyan-300" />
        <DepCard title="Permissions" items={engineer.requiredPermissions} tone="text-violet-300" />
        <DepCard title="Backend services" items={engineer.requiredBackendServices} tone="text-emerald-300" />
        <DepCard title="Automation workflows" items={engineer.automationWorkflows} tone="text-fuchsia-300" />
        <DepCard title="Audit topics" items={engineer.auditTopics} tone="text-zinc-300" />
      </section>

      {/* Surfaces */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Where this engineer is exposed</p>
        <div className="flex flex-wrap gap-2 text-[10.5px] font-mono uppercase tracking-wider">
          {engineer.requiresDesktopApp && (
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 px-2 py-0.5">
              <ComputerDesktopIcon className="h-3 w-3" /> desktop required
            </span>
          )}
          {engineer.cliExposed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2 py-0.5">
              <CommandLineIcon className="h-3 w-3" /> cli
            </span>
          )}
          {engineer.ideExposed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-violet-500/10 text-violet-300 px-2 py-0.5">
              <CodeBracketIcon className="h-3 w-3" /> ide
            </span>
          )}
          {!engineer.requiresDesktopApp && !engineer.cliExposed && !engineer.ideExposed && (
            <span className="text-[11px] text-zinc-500">Server-side only — runs in the platform's hosted runtime.</span>
          )}
        </div>
      </section>

      {/* Missing pieces */}
      {engineer.missingPieces.length > 0 && (
        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5 mb-6">
          <header className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Missing setup ({engineer.missingPieces.length})</p>
          </header>
          <ul className="text-[12px] text-amber-100/85 leading-relaxed list-disc list-inside marker:text-amber-400/70">
            {engineer.missingPieces.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </section>
      )}

      {/* Recent attempts */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-zinc-400" />
            <p className="text-[12px] font-semibold text-white">Recent action attempts</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{attempts.length} shown</span>
        </header>
        {attempts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[12.5px] text-zinc-300">No engineer action attempts yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
              Once an agent runs a tool, its runtime decision and audit trail appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {attempts.map((a) => (
              <li key={a.id} className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <p className="text-[12px] font-semibold text-white truncate">{a.action}</p>
                  <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px ${
                    a.runtimeDecision === "allowed"           ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
                    a.runtimeDecision === "requires_approval" ? "text-amber-300 bg-amber-500/10 border-amber-500/30"       :
                                                                "text-rose-300 bg-rose-500/10 border-rose-500/30"
                  }`}>
                    {a.runtimeDecision.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-snug">{a.reason}</p>
                <p className="mt-1 text-[10px] font-mono text-zinc-500">
                  {a.riskLevel} · {a.effectiveRule} · via {a.policySource} · {a.requestedBy} · {a.createdAt.toISOString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/agent-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <ShieldCheckIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Agent tool access matrix</p>
          <p className="text-[11px] text-zinc-500 mt-1">Per-action read / write / approval rules.</p>
        </Link>
        <Link href="/dashboard/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <PuzzlePieceIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Approvals queue</p>
          <p className="text-[11px] text-zinc-500 mt-1">Where this engineer's actions stage.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every gate decision recorded.</p>
        </Link>
      </section>
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

function DepCard({ title, items, tone }: { title: string; items: readonly string[]; tone: string }) {
  if (items.length === 0) {
    return (
      <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${tone}`}>{title}</p>
        <p className="text-[11px] text-zinc-500">None required.</p>
      </article>
    );
  }
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${tone}`}>{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="text-[10.5px] font-mono text-zinc-200 bg-white/[0.02] border border-white/[0.06] rounded-full px-1.5 py-0.5">
            {it}
          </span>
        ))}
      </div>
    </article>
  );
}
