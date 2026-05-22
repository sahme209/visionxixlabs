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

  const currentRule: ApprovalRule = (record?.currentApprovalRule as ApprovalRule | null) ?? engineer.approvalRule;
  const overrideActive = !!record?.currentApprovalRule && record.currentApprovalRule !== engineer.approvalRule;

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/dashboard/workforce" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Workforce
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <UserGroupIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Engineer · {engineer.department}</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">{engineer.displayName}</h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">{engineer.role}</p>
      </div>

      {/* Approval rule strip */}
      <section className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5 mb-6">
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
          <Link
            href={`/dashboard/workforce/${engineer.id}/edit`}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25 transition"
          >
            Tighten rule
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>

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
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-2 py-0.5">
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
        <Link href="/dashboard/agent-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <ShieldCheckIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Agent tool access matrix</p>
          <p className="text-[11px] text-zinc-500 mt-1">Per-action read / write / approval rules.</p>
        </Link>
        <Link href="/dashboard/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <PuzzlePieceIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Approvals queue</p>
          <p className="text-[11px] text-zinc-500 mt-1">Where this engineer's actions stage.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every gate decision recorded.</p>
        </Link>
      </section>
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
