/**
 * /dashboard/workforce — the AI engineering team.
 *
 * Client-facing canonical view of every engineer the platform ships.
 * Renders only entries tagged productLayer === "client" — internal
 * VisionXIXLabs marketing/sales engineers never appear here.
 *
 * Each card shows: role, department, required connectors, tools, IDE/
 * CLI/desktop flags, approval rule, missing setup pieces. Engineers
 * that supersede an older kernel surface a "consolidated from" banner.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  UserGroupIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  CodeBracketSquareIcon,
  CommandLineIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  PuzzlePieceIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";
import {
  engineersByDepartment,
  workforceSummary,
  type AgentEngineer,
  type ApprovalRule,
  type WorkforceDepartment,
} from "@/lib/workforce/agentWorkforceRegistry";
import { currentContext } from "@/lib/auth/currentContext";
import { syncAgentEngineerRegistryForWorkspace } from "@/lib/workforce/workspaceRegistrySync";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "AI Workforce · Axiom",
  description: "Every engineer the platform ships — role, department, required tools, approval rules, and missing setup pieces.",
};

export const dynamic = "force-dynamic";

const DEPT_META: Record<WorkforceDepartment, { label: string; tone: string }> = {
  perception:        { label: "Perception",         tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  reasoning:         { label: "Reasoning",          tone: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" },
  planning:          { label: "Planning",           tone: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" },
  safety:            { label: "Safety",             tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  verification:      { label: "Verification",       tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  memory:            { label: "Memory",             tone: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
  workflow:          { label: "Workflow",           tone: "border-white/[0.12] bg-violet-500/10 text-violet-300" },
  devops:            { label: "DevOps",             tone: "border-white/[0.12] bg-violet-500/10 text-violet-300" },
  database:          { label: "Database",           tone: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  security:          { label: "Security",           tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  finops:            { label: "FinOps",             tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  observability:     { label: "Observability",      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  incident_response: { label: "Incident response",  tone: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
  marketing:         { label: "Marketing",          tone: "border-white/[0.12] bg-violet-500/10 text-violet-300" },
  sales:             { label: "Sales",              tone: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" },
};

const APPROVAL_TONE: Record<ApprovalRule, { label: string; tone: string }> = {
  no_approval_needed:      { label: "Auto-OK",          tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  single_approver:         { label: "Single approval",  tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  two_step_approval:       { label: "Two-step",          tone: "text-rose-300 bg-rose-500/10 border-rose-500/30" },
  incident_commander_only: { label: "Incident commander", tone: "text-rose-300 bg-rose-500/15 border-rose-500/40" },
  blocked_always:          { label: "Policy gate",       tone: "text-zinc-300 bg-zinc-500/10 border-zinc-500/30" },
};

export default async function WorkforcePage() {
  const groups = engineersByDepartment("client");
  const summary = workforceSummary();

  // Idempotent on every load — registers any new canonical engineers into
  // this workspace's record table. Safe to run on every page load; no
  // overrides ever get overwritten.
  const ctx = await currentContext();
  if (ctx.isAuthenticated && ctx.organizationId) {
    try {
      await syncAgentEngineerRegistryForWorkspace(String(ctx.organizationId));
    } catch {
      // Never block the page render on a sync hiccup — sync is idempotent
      // and the canonical registry remains the source of truth.
    }
  }

  // 30-day activity totals per engineer — one groupBy covers every
  // card so we don't N+1 the workforce render. Empty workspace gets
  // an empty map; cards render an honest "0 attempts" badge.
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const attemptCounts = new Map<string, number>();
  const pendingCounts = new Map<string, number>();
  if (ctx.isAuthenticated && ctx.organizationId) {
    try {
      const rows = await prisma.agentEngineerActionAttempt.groupBy({
        by: ["engineerId"],
        where: {
          organizationId: String(ctx.organizationId),
          createdAt: { gte: since30d },
        },
        _count: { _all: true },
      });
      for (const r of rows) attemptCounts.set(r.engineerId, r._count._all);
    } catch {
      // migration-pending degrades to empty map — cards show 0 honestly.
    }
    try {
      const rows = await prisma.engineerApprovalSnapshot.groupBy({
        by: ["engineerId"],
        where: {
          organizationId: String(ctx.organizationId),
          status: "pending",
        },
        _count: { _all: true },
      });
      for (const r of rows) pendingCounts.set(r.engineerId, r._count._all);
    } catch {
      // ditto — honest 0 fallback.
    }
  }

  // Disabled-state lookup so the cards can render a 'disabled' badge.
  // Only the rows that exist count — an absent record means the
  // canonical default (enabled), per the registry sync contract.
  const disabledSet = new Set<string>();
  if (ctx.isAuthenticated && ctx.organizationId) {
    try {
      const rows = await prisma.agentEngineerRecord.findMany({
        where: { organizationId: String(ctx.organizationId), isEnabled: false },
        select: { engineerId: true },
      });
      for (const r of rows) disabledSet.add(r.engineerId);
    } catch {
      // empty fallback — no row gets a disabled badge.
    }
  }

  return (
    <div className="relative">
      <PageIntro
        kicker="AI workforce"
        title={<>Your AI engineering team, <span className="text-zinc-500">by department.</span></>}
        description="Every engineer the platform ships — what they do, what they need to do it, and what's still missing. Each engineer is a typed kernel that operates under the approval policy."
        helps="Understand which AI engineer owns which surface, what tools they have, and whether they're operating at full capacity yet."
        connectFirst="The relevant connector for each engineer — Cloud Engineer needs AWS/Azure/GCP, DevOps needs GitHub/GitLab, etc."
        engineers={["Cloud", "DevOps", "Security", "Monitoring", "Database", "Incident", "FinOps", "Compliance"]}
        requiresApproval="Every write action proposed by an engineer surfaces as an approval packet. Engineers never execute autonomously."
        actions={[
          { label: "Manage connectors", href: "/dashboard/connectors" },
          { label: "View agent activity", href: "/dashboard/agent-activity" },
        ]}
        safetyNote="Engineers are read-only by default · Tool access is per-engineer + per-cloud · Every action audit-logged"
      />

      {/* Summary KPIs — registry-derived static facts. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Client engineers"     value={summary.clientLayer}      icon={UserGroupIcon} />
        <Stat label="Consolidated kernels" value={summary.withDuplicates}    icon={CheckCircleIcon} sub="duplicate kernels folded into a single engineer" />
        <Stat label="Missing setup pieces" value={summary.totalMissingPieces} icon={ExclamationTriangleIcon} sub="implementation gaps tracked openly" />
        <Stat label="Departments"          value={groups.length}             icon={PuzzlePieceIcon} />
      </section>

      {/* Live workforce KPIs — totals across every client engineer in
          THIS workspace. Honest zeros when the workspace is empty,
          no projected demo numbers. */}
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">live · this workspace</p>
        <div className="flex items-center gap-4">
          <a
            href="/api/workforce/attempts.csv"
            download
            className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
            title="Download up to 5000 workforce attempts as CSV"
          >
            download .csv
          </a>
          <Link href="/dashboard/workforce/compare" className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors">
            compare engineers →
          </Link>
        </div>
      </div>
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <LiveStat
          label="Attempts · 30d"
          value={Array.from(attemptCounts.values()).reduce((a, b) => a + b, 0)}
          sub="every gated engineer attempt across the workspace"
          tone="text-white"
        />
        <LiveStat
          label="Pending approvals"
          value={Array.from(pendingCounts.values()).reduce((a, b) => a + b, 0)}
          sub="waiting on a workspace decision right now"
          tone="text-amber-300"
        />
        <LiveStat
          label="Active engineers · 30d"
          value={attemptCounts.size}
          sub="engineers that emitted at least one attempt"
          tone="text-emerald-300"
        />
      </section>

      {/* Department groups */}
      <div className="space-y-10">
        {groups.map(({ dept, engineers }) => {
          const meta = DEPT_META[dept];
          return (
            <section key={dept}>
              <header className="flex items-baseline gap-3 mb-3 flex-wrap">
                <Link
                  href={`/dashboard/workforce/department/${dept}`}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 hover:opacity-80 transition-opacity ${meta.tone}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest">{meta.label}</span>
                </Link>
                <span className="text-[11px] text-zinc-500">{engineers.length} engineer{engineers.length === 1 ? "" : "s"}</span>
                <Link
                  href={`/dashboard/workforce/department/${dept}`}
                  className="text-[11px] text-zinc-500 hover:text-white transition-colors ml-auto inline-flex items-center gap-1"
                >
                  rollup <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {engineers.map((e) => (
                  <EngineerCard
                    key={e.id}
                    engineer={e}
                    attempts30d={attemptCounts.get(e.id) ?? 0}
                    pending={pendingCounts.get(e.id) ?? 0}
                    disabled={disabledSet.has(e.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Approval legend */}
      <section className="mt-10 rounded-2xl border border-violet-500/15 bg-white/[0.015] p-5">
        <header className="flex items-center gap-2 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Approval rules</p>
        </header>
        <div className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {(Object.entries(APPROVAL_TONE) as [ApprovalRule, { label: string; tone: string }][]).map(([rule, meta]) => (
            <div key={rule} className="flex items-start gap-2">
              <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${meta.tone}`}>{meta.label}</span>
              <span className="text-zinc-400 leading-snug">{APPROVAL_DESC[rule]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Link href="/dashboard/workforce/coding" className="block rounded-xl border border-white/[0.12] bg-white/[0.015] p-4 hover:border-white/[0.15] transition-colors">
          <CodeBracketSquareIcon className="h-4 w-4 text-violet-300 mb-2" />
          <p className="text-sm font-semibold text-white">AI coding</p>
          <p className="text-[11px] text-zinc-400 mt-1">Describe a change · we propose, gate, and ship the PR.</p>
        </Link>
        <Link href="/dashboard/workforce/pipelines" className="block rounded-xl border border-white/[0.12] bg-white/[0.015] p-4 hover:border-white/[0.15] transition-colors">
          <PuzzlePieceIcon className="h-4 w-4 text-violet-300 mb-2" />
          <p className="text-sm font-semibold text-white">Pipelines</p>
          <p className="text-[11px] text-zinc-400 mt-1">Multi-stage CI/CD, DB-migrate, security sweeps — one click.</p>
        </Link>
        <Link href="/dashboard/agent-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <ShieldCheckIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Agent tool access matrix</p>
          <p className="text-[11px] text-zinc-500 mt-1">Per-action read / write / approval rules.</p>
        </Link>
        <Link href="/dashboard/workforce/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <ExclamationTriangleIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Engineer approvals</p>
          <p className="text-[11px] text-zinc-500 mt-1">Engineer-sourced risky actions awaiting sign-off.</p>
        </Link>
        <Link href="/dashboard/workforce/activity" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <ClockIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Activity feed</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every gated attempt — allowed, requires approval, or blocked.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.10] transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-zinc-500 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every engineer action recorded.</p>
        </Link>
      </section>
    </div>
  );
}

const APPROVAL_DESC: Record<ApprovalRule, string> = {
  no_approval_needed:      "Read-only or pure-read action — no human gate.",
  single_approver:         "One workspace admin must approve before the action runs.",
  two_step_approval:       "Two approvers required — used for risky or high-blast-radius actions.",
  incident_commander_only: "Only the on-call incident commander can approve.",
  blocked_always:          "Action is policy-blocked even with human approval.",
};

function Stat({ label, value, icon: Icon, sub }: { label: string; value: number; icon: typeof UserGroupIcon; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <Icon className="h-4 w-4 text-violet-300 mb-2" />
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function LiveStat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${value > 0 ? tone : "text-zinc-600"}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{sub}</p>
    </div>
  );
}

function EngineerCard({ engineer, attempts30d, pending, disabled }: { engineer: AgentEngineer; attempts30d: number; pending: number; disabled: boolean }) {
  const approval = APPROVAL_TONE[engineer.approvalRule];
  return (
    <article className={`rounded-2xl border bg-white/[0.02] p-5 flex flex-col transition-opacity ${disabled ? "border-rose-500/15 opacity-60" : "border-white/[0.06]"}`}>
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">{engineer.displayName}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{engineer.id}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {disabled && (
            <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap text-rose-300 bg-rose-500/10 border-rose-500/30">
              disabled
            </span>
          )}
          <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${approval.tone}`}>
            {approval.label}
          </span>
        </div>
      </header>

      <p className="text-[11.5px] text-zinc-400 leading-snug mb-3">{engineer.role}</p>

      {engineer.supersedes && engineer.supersedes.length > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-2.5">
          <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider mb-1">consolidated</p>
          {engineer.supersedes.map((s) => (
            <p key={s} className="text-[10.5px] text-emerald-100/85 leading-snug">↳ {s}</p>
          ))}
        </div>
      )}

      <div className="mb-3 space-y-2">
        {engineer.requiredConnectors.length > 0 && (
          <SmallRow label="Connectors" items={engineer.requiredConnectors.map((c) => c.replace(/_/g, " "))} tone="text-amber-300" />
        )}
        <SmallRow label="Tools" items={engineer.requiredTools.map((t) => t.replace(/_/g, " "))} tone="text-cyan-300" />
        <SmallRow label="Permissions" items={engineer.requiredPermissions} tone="text-violet-300" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] font-mono uppercase tracking-wider">
        {engineer.requiresDesktopApp && (
          <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 px-1.5 py-0.5">
            <ComputerDesktopIcon className="h-3 w-3" /> desktop
          </span>
        )}
        {engineer.cliExposed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5">
            <CommandLineIcon className="h-3 w-3" /> cli
          </span>
        )}
        {engineer.ideExposed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-violet-500/10 text-violet-300 px-1.5 py-0.5">
            <CodeBracketIcon className="h-3 w-3" /> ide
          </span>
        )}
      </div>

      <p className="text-[10px] font-mono text-zinc-500 leading-snug mb-2">
        <span className="text-zinc-300">highest-risk:</span> {engineer.highestRiskAction}
      </p>

      {engineer.missingPieces.length > 0 && (
        <div className="mt-auto pt-2 border-t border-white/[0.04]">
          <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1 inline-flex items-center gap-1">
            <ExclamationTriangleIcon className="h-3 w-3" /> Missing setup ({engineer.missingPieces.length})
          </p>
          <ul className="text-[10.5px] text-amber-100/80 leading-snug space-y-0.5 list-disc list-inside marker:text-amber-400/70">
            {engineer.missingPieces.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-zinc-500">
            {attempts30d > 0
              ? <><span className="text-zinc-300 tabular-nums">{attempts30d}</span> attempt{attempts30d === 1 ? "" : "s"} · 30d</>
              : <span className="text-zinc-600">no attempts · 30d</span>}
          </span>
          {pending > 0 && (
            <span className="text-[10px] font-mono text-amber-300 inline-flex items-center gap-1">
              · <span className="tabular-nums">{pending}</span> pending
            </span>
          )}
        </div>
        <Link href={`/dashboard/workforce/${engineer.id}`} className="text-[11px] text-zinc-300 hover:text-white inline-flex items-center gap-1">
          Open
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}

function SmallRow({ label, items, tone }: { label: string; items: readonly string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-[9.5px] font-mono uppercase tracking-wider mb-1 ${tone}/80`}>{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 4).map((it) => (
          <span key={it} className={`text-[10px] font-mono ${tone} bg-white/[0.02] border border-white/[0.06] rounded-full px-1.5 py-0.5`}>
            {it}
          </span>
        ))}
        {items.length > 4 && (
          <span className="text-[10px] font-mono text-zinc-500">+{items.length - 4}</span>
        )}
      </div>
    </div>
  );
}
