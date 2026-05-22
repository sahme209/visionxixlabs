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
  CommandLineIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  PuzzlePieceIcon,
} from "@heroicons/react/24/outline";
import {
  engineersByDepartment,
  workforceSummary,
  type AgentEngineer,
  type ApprovalRule,
  type WorkforceDepartment,
} from "@/lib/workforce/agentWorkforceRegistry";
import { currentContext } from "@/lib/auth/currentContext";
import { syncAgentEngineerRegistryForWorkspace } from "@/lib/workforce/workspaceRegistrySync";

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
  workflow:          { label: "Workflow",           tone: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
  devops:            { label: "DevOps",             tone: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
  database:          { label: "Database",           tone: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  security:          { label: "Security",           tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  finops:            { label: "FinOps",             tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  observability:     { label: "Observability",      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  incident_response: { label: "Incident response",  tone: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
  marketing:         { label: "Marketing",          tone: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
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

  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <UserGroupIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">AI Workforce</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Your AI engineering team, <span className="text-gradient">by department.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Every engineer the platform ships — what they do, what they need to do it, and what's still missing. Each engineer is a typed kernel that operates under the approval policy on the right.
        </p>
      </div>

      {/* Summary KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Client engineers"     value={summary.clientLayer}      icon={UserGroupIcon} />
        <Stat label="Consolidated kernels" value={summary.withDuplicates}    icon={CheckCircleIcon} sub="duplicate kernels folded into a single engineer" />
        <Stat label="Missing setup pieces" value={summary.totalMissingPieces} icon={ExclamationTriangleIcon} sub="implementation gaps tracked openly" />
        <Stat label="Departments"          value={groups.length}             icon={PuzzlePieceIcon} />
      </section>

      {/* Department groups */}
      <div className="space-y-10">
        {groups.map(({ dept, engineers }) => {
          const meta = DEPT_META[dept];
          return (
            <section key={dept}>
              <header className="flex items-baseline gap-3 mb-3 flex-wrap">
                <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${meta.tone}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest">{meta.label}</span>
                </span>
                <span className="text-[11px] text-zinc-500">{engineers.length} engineer{engineers.length === 1 ? "" : "s"}</span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {engineers.map((e) => (
                  <EngineerCard key={e.id} engineer={e} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Approval legend */}
      <section className="mt-10 rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5">
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

      <section className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/dashboard/agent-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <ShieldCheckIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Agent tool access matrix</p>
          <p className="text-[11px] text-zinc-500 mt-1">Per-action read / write / approval rules.</p>
        </Link>
        <Link href="/dashboard/workforce/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <ExclamationTriangleIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Engineer approvals</p>
          <p className="text-[11px] text-zinc-500 mt-1">Engineer-sourced risky actions awaiting sign-off.</p>
        </Link>
        <Link href="/dashboard/workforce/activity" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <ClockIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Activity feed</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every gated attempt — allowed, requires approval, or blocked.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-violet-400 mb-2" />
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

function EngineerCard({ engineer }: { engineer: AgentEngineer }) {
  const approval = APPROVAL_TONE[engineer.approvalRule];
  return (
    <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">{engineer.displayName}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">{engineer.id}</p>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${approval.tone}`}>
          {approval.label}
        </span>
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
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-1.5 py-0.5">
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

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-zinc-500">{engineer.kernelModules.length} kernel{engineer.kernelModules.length === 1 ? "" : "s"}</span>
        <Link href={`/dashboard/agents`} className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          Kernels
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
