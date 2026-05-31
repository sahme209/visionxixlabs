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

  // Recent operator changes — who flipped the toggle, who tightened
  // the rule, who saved notes. Scope to the three workspace-state
  // audit actions so the timeline stays meaningful (i.e. it doesn't
  // drown in every action_attempted row).
  const recentOperatorChanges = await prisma.secureAuditRecord.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      entityRef: `engineer:${engineer.id}`,
      action: { in: ["engineer.enable_toggled", "engineer.policy_override_updated", "engineer.notes_updated"] },
    },
    orderBy: { occurredAt: "desc" },
    take: 5,
    select: {
      id: true,
      action: true,
      actorUserId: true,
      actorKind: true,
      occurredAt: true,
      detail: true,
    },
  }).catch(() => [] as Array<{
    id: string;
    action: string;
    actorUserId: string | null;
    actorKind: string;
    occurredAt: Date;
    detail: unknown;
  }>);

  // 14-day daily attempt trend. We fetch raw createdAt for each
  // attempt in window and bucket by UTC date in-app — fast, no DB
  // function dependency, and the trend stays accurate across DST
  // boundaries because we never touch local time.
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const trendAttempts = await prisma.agentEngineerActionAttempt.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
      createdAt: { gte: since14d },
    },
    select: { createdAt: true },
    take: 5000,
  }).catch(() => [] as Array<{ createdAt: Date }>);

  type DayBucket = { day: string; count: number };
  const trend: DayBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    trend.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  const trendIndex = new Map(trend.map((t, i) => [t.day, i]));
  for (const a of trendAttempts) {
    const key = a.createdAt.toISOString().slice(0, 10);
    const i = trendIndex.get(key);
    if (i !== undefined) trend[i].count++;
  }
  const trendPeak = Math.max(1, ...trend.map((t) => t.count));

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
  // Pending approvals + recent decision latency, scoped to this
  // engineer via the EngineerApprovalSnapshot mirror. Median is
  // computed in-app from the last 50 decisions — small enough to
  // load + sort cheaply, big enough to be representative.
  const [pendingApprovalCount, recentDecisions, executionGroups] = await Promise.all([
    prisma.engineerApprovalSnapshot.count({
      where: {
        organizationId: String(ctx.organizationId),
        engineerId: engineer.id,
        status: "pending",
      },
    }).catch(() => 0),
    prisma.engineerApprovalSnapshot.findMany({
      where: {
        organizationId: String(ctx.organizationId),
        engineerId: engineer.id,
        decidedAt: { not: null },
      },
      orderBy: { decidedAt: "desc" },
      take: 50,
      select: { createdAt: true, decidedAt: true },
    }).catch(() => [] as Array<{ createdAt: Date; decidedAt: Date | null }>),
    prisma.engineerApprovalSnapshot.groupBy({
      by: ["status", "executionStatus"],
      where: {
        organizationId: String(ctx.organizationId),
        engineerId: engineer.id,
      },
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; executionStatus: string; _count: { _all: number } }>),
  ]);

  // Last 10 decided approvals — most concrete signal of "what's
  // actually happening with this engineer's outputs". Pulled
  // separately from the latency window above because we want the
  // newest 10 in full, not the median-pull list.
  const recentDecidedFull = await prisma.engineerApprovalSnapshot.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
      decidedAt: { not: null },
    },
    orderBy: { decidedAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      status: true,
      executionStatus: true,
      decidedAt: true,
      createdAt: true,
      decisionReason: true,
    },
  }).catch(() => [] as Array<{
    id: string;
    action: string;
    status: string;
    executionStatus: string;
    decidedAt: Date | null;
    createdAt: Date;
    decisionReason: string | null;
  }>);

  // Funnel: minted → decided → executed → failed. Each stage is the
  // count satisfying that terminal condition across all-time
  // snapshots for this engineer. We render a row only when the prior
  // stage has at least one — keeps the empty engineer surface honest.
  const funnel = { minted: 0, decided: 0, executed: 0, failed: 0 };
  for (const g of executionGroups) {
    funnel.minted += g._count._all;
    if (g.status === "approved" || g.status === "rejected" || g.status === "expired") {
      funnel.decided += g._count._all;
    }
    if (g.executionStatus === "executed") funnel.executed += g._count._all;
    if (g.executionStatus === "failed")   funnel.failed   += g._count._all;
  }

  const latenciesMs = recentDecisions
    .map((d) => (d.decidedAt ? d.decidedAt.getTime() - d.createdAt.getTime() : 0))
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);
  const medianDecisionMs = latenciesMs.length === 0
    ? null
    : latenciesMs[Math.floor(latenciesMs.length / 2)];

  function formatMs(ms: number): string {
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    return `${Math.floor(hr / 24)}d`;
  }

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
          select: { id: true, provider: true, externalAccountId: true, alias: true },
        }).catch(() => [] as Array<{ id: string; provider: string; externalAccountId: string; alias: string | null }>)
      : Promise.resolve([] as Array<{ id: string; provider: string; externalAccountId: string; alias: string | null }>),
    githubRequired
      ? prisma.gitHubInstallation.count({
          where: { organizationId: String(ctx.organizationId) },
        }).catch(() => 0)
      : Promise.resolve(0),
  ]);
  const connectedProviders = new Set<string>(cloudAccountRows.map((r) => r.provider));
  const githubConnected = githubInstallCount > 0;
  const hasReadinessSection = cloudConnectorDeps.length > 0 || githubRequired;

  // Cloud accounts this engineer has actually exercised (last 30d).
  // We pivot via the AgentEngineerActionAttempt.connector field — when
  // the engineer's connector matches a CloudAccount.provider, we
  // attribute the touch. Returns per-provider attempt counts which we
  // fold against the enabled cloud accounts above.
  const touchedConnectorGroups = await prisma.agentEngineerActionAttempt.groupBy({
    by: ["connector"],
    where: {
      organizationId: String(ctx.organizationId),
      engineerId: engineer.id,
      connector: { in: ["aws", "azure", "gcp"] },
      createdAt: { gte: since30d },
    },
    _count: { _all: true },
  }).catch(() => [] as Array<{ connector: string | null; _count: { _all: number } }>);
  const touchByProvider = new Map<string, number>();
  for (const g of touchedConnectorGroups) {
    if (g.connector) touchByProvider.set(g.connector, g._count._all);
  }
  const touchedAccounts = cloudAccountRows
    .filter((a) => (touchByProvider.get(a.provider) ?? 0) > 0)
    .map((a) => ({ ...a, attempts: touchByProvider.get(a.provider) ?? 0 }));

  // The engineer's own specialty rationale — minted by /api/workforce/[id]/run-agi
  // when the operator hits the 'Run AGI now' button (Phase 557). One
  // row per (org, engineerSpecialty, engineerId) via the unique
  // constraint, so refreshing always shows the latest.
  const ownRationale = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: String(ctx.organizationId),
        targetKind: "engineer_specialty",
        targetId: engineer.id,
      },
    },
    select: {
      narrative: true,
      riskFactorsJson: true,
      nextActionsJson: true,
      outcome: true,
      modelHint: true,
      errorMessage: true,
      generatedAt: true,
      updatedAt: true,
    },
  }).catch(() => null);
  const ownRiskFactors = ownRationale && Array.isArray(ownRationale.riskFactorsJson)
    ? (ownRationale.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const ownNextActions = ownRationale && Array.isArray(ownRationale.nextActionsJson)
    ? (ownRationale.nextActionsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  // Recent Q&A — Phase 564 persists each exchange as an
  // engineer_qa row with targetId=`<engineerId>:<ts36>`. The
  // startsWith prefix scopes cheaply to this engineer.
  const recentQa = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: "engineer_qa",
      targetId: { startsWith: `${engineer.id}:` },
    },
    orderBy: { generatedAt: "desc" },
    take: 3,
    select: {
      targetId: true,
      narrative: true,
      riskFactorsJson: true,
      outcome: true,
      generatedAt: true,
    },
  }).catch(() => [] as Array<{
    targetId: string;
    narrative: string;
    riskFactorsJson: unknown;
    outcome: string;
    generatedAt: Date;
  }>);
  const qaEntries = recentQa.map((r) => {
    const question = Array.isArray(r.riskFactorsJson) && typeof r.riskFactorsJson[0] === "string"
      ? r.riskFactorsJson[0]
      : "";
    return {
      targetId: r.targetId,
      question,
      answer: r.narrative,
      outcome: r.outcome,
      generatedAt: r.generatedAt,
    };
  });

  // AGI rationale relevant to this engineer. Map the canonical
  // department to the AiRationaleEnrichment.targetKind values the
  // AGI emits. Safety / planning / reasoning engineers operate at
  // the council layer; incident / security / devops / finops /
  // observability live in the triage + remediation layer. Everything
  // else gets the full set so we never silently hide.
  function agiKindsForDepartment(dept: string): string[] {
    if (dept === "safety" || dept === "planning" || dept === "reasoning") {
      return ["council"];
    }
    if (dept === "incident_response" || dept === "security" || dept === "devops" || dept === "finops" || dept === "observability") {
      return ["triage", "remediation"];
    }
    return ["council", "triage", "remediation"];
  }
  const relevantKinds = agiKindsForDepartment(engineer.department);
  const recentAgiRationale = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: { in: relevantKinds },
    },
    orderBy: { generatedAt: "desc" },
    take: 5,
    select: {
      targetKind: true,
      targetId: true,
      narrative: true,
      outcome: true,
      modelHint: true,
      generatedAt: true,
    },
  }).catch(() => [] as Array<{
    targetKind: string;
    targetId: string;
    narrative: string;
    outcome: string;
    modelHint: string | null;
    generatedAt: Date;
  }>);

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

      {/* Engineer's own AGI rationale — the engineer literally
          speaking for itself via Claude. POST /api/workforce/[id]/run-agi
          mints a fresh narrative + risk factors + next actions and
          upserts the row. When the row doesn't exist yet, surface a
          'Run AGI now' button so operators kick off the first run. */}
      <section className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
            {engineer.displayName} · speaking for itself
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/workforce/${engineer.id}/ask`}
              className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.18] transition-colors"
              title={`Ask ${engineer.displayName} a question`}
            >
              ask →
            </Link>
            <form action={`/api/workforce/${engineer.id}/run-agi`} method="POST">
              <button
                type="submit"
                className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-violet-500/30 text-violet-100 hover:border-violet-500/60 hover:bg-violet-500/15 transition-colors"
              >
                {ownRationale ? "re-run AGI" : "run AGI now"}
              </button>
            </form>
          </div>
        </div>
        {ownRationale ? (
          <>
            <div className="flex items-center gap-2 mb-2 flex-wrap text-[10px] font-mono uppercase tracking-wider">
              <span className={
                ownRationale.outcome === "ai_generated" ? "text-emerald-300" :
                ownRationale.outcome === "fallback_rules" ? "text-amber-300" :
                "text-rose-300"
              }>{ownRationale.outcome.replace(/_/g, " ")}</span>
              {ownRationale.modelHint && (
                <>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-400">{ownRationale.modelHint}</span>
                </>
              )}
              <span className="text-zinc-500 ml-auto">
                {ownRationale.updatedAt.toISOString().slice(0, 19).replace("T", " ")}
              </span>
            </div>
            <p className="text-[13.5px] text-zinc-100 leading-relaxed whitespace-pre-line">{ownRationale.narrative}</p>
            {ownRiskFactors.length > 0 && (
              <div className="mt-3">
                <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">risk factors</p>
                <ul className="space-y-0.5">
                  {ownRiskFactors.map((f, i) => (
                    <li key={`${i}_${f.slice(0, 24)}`} className="text-[12px] text-zinc-200 flex gap-1.5">
                      <span className="text-rose-400">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ownNextActions.length > 0 && (
              <div className="mt-3">
                <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">next actions</p>
                <ul className="space-y-0.5">
                  {ownNextActions.map((a, i) => (
                    <li key={`${i}_${a.slice(0, 24)}`} className="text-[12px] text-zinc-200 flex gap-1.5">
                      <span className="text-emerald-400">→</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ownRationale.errorMessage && (
              <p className="mt-2 text-[10.5px] font-mono text-rose-300/80">↳ {ownRationale.errorMessage}</p>
            )}
            <Link
              href={`/dashboard/agi-memory/${encodeURIComponent(`engineer_specialty:${engineer.id}`)}`}
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
            >
              permalink →
            </Link>
          </>
        ) : (
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            This engineer hasn&apos;t introduced itself yet. Hit the button to
            invoke its AGI flow — it will read your workspace context and
            return a structured rationale (narrative, risk factors, next
            actions) keyed to its specialty.
          </p>
        )}
      </section>

      {/* Recent Q&A — Phase 565. Three most recent operator-prompted
          exchanges with this engineer. Each row deep-links to the
          full thread page so a long conversation stays accessible. */}
      {qaEntries.length > 0 && (
        <section className="mb-6 rounded-2xl border border-violet-500/10 bg-white/[0.015] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">recent Q&amp;A · {qaEntries.length}</p>
            <Link
              href={`/dashboard/workforce/${engineer.id}/ask`}
              className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
            >
              full thread →
            </Link>
          </div>
          <ul className="space-y-3">
            {qaEntries.map((q) => (
              <li key={q.targetId} className="rounded-lg border border-white/[0.04] bg-white/[0.015] p-3">
                <p className="text-[10px] font-mono text-zinc-500 mb-1">{q.generatedAt.toISOString().slice(0, 16).replace("T", " ")}</p>
                {q.question && (
                  <p className="text-[11.5px] text-zinc-400 leading-snug mb-2 line-clamp-2">
                    <span className="text-zinc-500 mr-1">you:</span>{q.question}
                  </p>
                )}
                <p className="text-[12px] text-zinc-100 leading-snug line-clamp-3">
                  <span className="text-violet-300 mr-1 font-mono text-[10px] uppercase tracking-wider">{engineer.id.slice(0, 12)}:</span>{q.answer}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Enable / disable toggle — workspace-level switch on top of the
          canonical approval rule. Lives directly under the header so
          the operator never has to scroll to flip the engineer off. */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">workspace state</p>
          <p className="text-[13px] font-semibold text-white">
            {record?.isEnabled === false ? "Disabled in this workspace" : "Enabled in this workspace"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            {record?.isEnabled === false
              ? "Disabled engineers can't be invoked even with operator approval — every attempt blocks at the runtime gate."
              : "Engineer can be invoked under the approval rule above."}
          </p>
        </div>
        <form action={`/api/workforce/${engineer.id}/toggle`} method="POST" className="shrink-0">
          <input type="hidden" name="enabled" value={record?.isEnabled === false ? "true" : "false"} />
          <button
            type="submit"
            className={`text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${
              record?.isEnabled === false
                ? "border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50"
                : "border-rose-500/30 text-rose-200 hover:border-rose-500/50"
            }`}
          >
            {record?.isEnabled === false ? "enable" : "disable"}
          </button>
        </form>
      </section>

      {/* Operator notes — admin-visible scratchpad for context like
          "broker flaky on Tue mornings, keep disabled until fix lands".
          Plain server-rendered form, no client JS. */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 mb-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">operator notes</p>
        <form action={`/api/workforce/${engineer.id}/notes`} method="POST">
          <textarea
            name="notes"
            defaultValue={record?.notes ?? ""}
            rows={3}
            maxLength={4000}
            placeholder="Context the next operator should see — disabled-reason, runbook link, on-call notes."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.18] transition-colors resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono text-zinc-500">
              {record?.notes ? `${record.notes.length} chars saved` : "empty"} · 4000 max
            </p>
            <button
              type="submit"
              className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.18] transition-colors"
            >
              save notes
            </button>
          </div>
        </form>
      </section>

      {/* Recent operator changes — small chronological strip showing
          who flipped enable, tightened the rule, or edited notes. Only
          renders when there's at least one row so empty engineers stay
          tidy. */}
      {recentOperatorChanges.length > 0 && (
        <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">recent operator changes</p>
          <ul className="space-y-1.5">
            {recentOperatorChanges.map((c) => {
              const actionLabel = c.action.replace(/^engineer\./, "").replace(/_/g, " ");
              const detail = (c.detail ?? {}) as Record<string, unknown>;
              const nextEnabled = typeof detail.nextEnabled === "boolean" ? detail.nextEnabled : null;
              const priorLen = typeof detail.priorLen === "number" ? detail.priorLen : null;
              const nextLen = typeof detail.nextLen === "number" ? detail.nextLen : null;
              const nextRule = typeof detail.nextRule === "string" ? detail.nextRule : null;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.015]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-mono text-white">{actionLabel}</p>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      {c.actorUserId ? c.actorUserId.slice(0, 8) : c.actorKind}
                      {nextEnabled !== null && <> · → {nextEnabled ? "enabled" : "disabled"}</>}
                      {nextRule && <> · → {nextRule.replace(/_/g, " ")}</>}
                      {(priorLen !== null && nextLen !== null) && <> · {priorLen} → {nextLen} chars</>}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-600 shrink-0">{c.occurredAt.toISOString().slice(0, 10)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
        {/* 14-day daily trend. CSS-only bar chart — one column per day,
            height proportional to the peak so a dormant engineer's flat
            row reads as flat and a hot one reads as hot. */}
        <div className="mt-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">14-day trend</p>
          <div className="flex items-end gap-[2px] h-10">
            {trend.map((t) => {
              const pct = (t.count / trendPeak) * 100;
              const isToday = t.day === new Date().toISOString().slice(0, 10);
              return (
                <div key={t.day} className="flex-1 flex flex-col justify-end" title={`${t.day} · ${t.count}`}>
                  <div
                    className={`w-full rounded-sm ${t.count > 0 ? (isToday ? "bg-emerald-300/80" : "bg-zinc-400/70") : "bg-white/[0.04]"}`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Approval SLA — pending count + median decision latency for
          the last 50 decided requests. Honest 'no decisions yet' note
          when the engineer has never minted an approval. */}
      <section className="mb-6 grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">pending approvals</p>
          <p className={`text-[22px] font-semibold tabular-nums ${pendingApprovalCount > 0 ? "text-amber-300" : "text-zinc-600"}`}>
            {pendingApprovalCount}
          </p>
          {pendingApprovalCount > 0 ? (
            <Link
              href={`/dashboard/workforce/approvals?engineer=${encodeURIComponent(engineer.id)}`}
              className="text-[11px] font-mono text-zinc-400 hover:text-white mt-2 inline-flex items-center gap-1"
            >
              review queue <ArrowRightIcon className="h-3 w-3" />
            </Link>
          ) : (
            <p className="text-[11px] text-zinc-500 mt-1">Nothing waiting on a workspace decision.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">median decision latency</p>
          <p className={`text-[22px] font-semibold tabular-nums ${medianDecisionMs !== null ? "text-white" : "text-zinc-600"}`}>
            {medianDecisionMs !== null ? formatMs(medianDecisionMs) : "—"}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {medianDecisionMs !== null
              ? `Across the last ${latenciesMs.length} decision${latenciesMs.length === 1 ? "" : "s"}.`
              : "No decided requests yet."}
          </p>
        </div>
      </section>

      {/* Outcome funnel — only render when at least one approval has
          been minted for this engineer. Stages: minted → decided →
          executed, with a separate 'failed' callout when applies have
          broken. Honest hide when there's nothing to show. */}
      {funnel.minted > 0 && (
        <section className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Approval funnel · all time</p>
          <ol className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            <FunnelRow label="minted"   count={funnel.minted}   tone="text-white" />
            <FunnelRow label="decided"  count={funnel.decided}  tone={funnel.decided > 0 ? "text-zinc-200" : "text-zinc-600"} />
            <FunnelRow label="executed" count={funnel.executed} tone={funnel.executed > 0 ? "text-emerald-300" : "text-zinc-600"} />
            {funnel.failed > 0 && (
              <FunnelRow label="failed" count={funnel.failed} tone="text-rose-300" />
            )}
          </ol>
        </section>
      )}

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

      {/* AGI rationale tied to this engineer's domain. The mapping is
          department → targetKind (council / triage / remediation),
          so every engineer sees the AGI surface that actually
          reasons about its work. Hidden when there's nothing to
          show — honest empty. */}
      {recentAgiRationale.length > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">AGI rationale · {relevantKinds.join(" + ")}</p>
            <div className="flex items-center gap-3">
              <a
                href={`/api/workforce/${engineer.id}/agi.csv`}
                download
                className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                title={`Download up to 5000 AGI rationale rows scoped to this engineer's kinds`}
              >
                download .csv
              </a>
              <Link href="/dashboard/agi-memory" className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors">
                full feed →
              </Link>
            </div>
          </div>
          <ul className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] divide-y divide-white/[0.04] overflow-hidden">
            {recentAgiRationale.map((r) => (
              <li key={`${r.targetKind}:${r.targetId}`}>
                <Link
                  href={`/dashboard/agi-memory/${encodeURIComponent(`${r.targetKind}:${r.targetId}`)}`}
                  className="group block px-5 py-3 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-violet-300">{r.targetKind}</span>
                    <span className="text-zinc-500">·</span>
                    <span className={
                      r.outcome === "ai_generated" ? "text-emerald-300" :
                      r.outcome === "fallback_rules" ? "text-amber-300" :
                      "text-rose-300"
                    }>{r.outcome.replace(/_/g, " ")}</span>
                    {r.modelHint && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{r.modelHint}</span>
                      </>
                    )}
                    <span className="text-zinc-500 ml-auto">{r.generatedAt.toISOString().slice(0, 10)}</span>
                  </div>
                  <p className="text-[12px] text-zinc-200 leading-relaxed line-clamp-2">{r.narrative}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cloud accounts this engineer has exercised in the last 30
          days. The attribution flows from
          AgentEngineerActionAttempt.connector → CloudAccount.provider,
          so an aws-touching engineer surfaces every connected aws
          account. Operators click through into the per-account
          surface to see what actually got produced. */}
      {touchedAccounts.length > 0 && (
        <section className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Cloud accounts touched · 30d</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {touchedAccounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/cloud-accounts/${a.id}`}
                  className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-300 shrink-0">{a.provider}</span>
                    <p className="text-[12.5px] font-medium text-white truncate">{a.alias ?? a.externalAccountId}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{a.attempts} via {a.provider}</span>
                    <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
            Attribution is per-provider — an aws-touching engineer sees every connected aws account because the runtime gate operates per connector, not per account.
          </p>
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

      {/* Recent decisions — last 10 decided approvals so the operator
          sees what's actually happening to this engineer's outputs.
          Hidden when there are no decisions yet. */}
      {recentDecidedFull.length > 0 && (
        <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-[12px] font-semibold text-white">Recent decisions</p>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{recentDecidedFull.length} shown</span>
          </header>
          <ul className="space-y-1.5">
            {recentDecidedFull.map((d) => {
              const latencyMs = d.decidedAt ? d.decidedAt.getTime() - d.createdAt.getTime() : 0;
              const statusTone =
                d.status === "approved" ? "text-emerald-300" :
                d.status === "rejected" ? "text-zinc-400" :
                d.status === "expired"  ? "text-rose-300"   :
                "text-zinc-500";
              const execTone =
                d.executionStatus === "executed" ? "text-emerald-300" :
                d.executionStatus === "failed"   ? "text-rose-300"    :
                "text-zinc-500";
              return (
                <li key={d.id} className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <p className="text-[12px] font-mono text-white truncate">{d.action}</p>
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider shrink-0">
                      <span className={statusTone}>{d.status}</span>
                      <span className="text-zinc-600">·</span>
                      <span className={execTone}>{d.executionStatus.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  {d.decisionReason && (
                    <p className="text-[10.5px] text-zinc-400 leading-snug">{d.decisionReason}</p>
                  )}
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">
                    decided in {formatMs(latencyMs)} · {d.decidedAt?.toISOString()}
                  </p>
                </li>
              );
            })}
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
          <div className="flex items-center gap-3">
            <a
              href={`/api/workforce/${engineer.id}/attempts.csv`}
              download
              className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
              title="Download up to 5000 attempts as CSV"
            >
              download .csv
            </a>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{attempts.length} shown</span>
          </div>
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
        <Link href={`/dashboard/workforce/${engineer.id}/audit`} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Audit timeline</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every workspace event tagged with this engineer&apos;s topics.</p>
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

function FunnelRow({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <li className="px-5 py-3 flex items-center justify-between gap-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={`text-[16px] font-semibold tabular-nums ${tone}`}>{count}</p>
    </li>
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
