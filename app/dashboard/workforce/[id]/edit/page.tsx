/**
 * /dashboard/workforce/[id]/edit — operator override surface.
 *
 * Workspace admins can TIGHTEN an engineer's approval rule (never
 * loosen) and toggle the engineer on/off in their workspace. The
 * persistence + tightening enforcement lives in
 * `lib/workforce/runtimeActionGate.canTightenApprovalRule()` and
 * `loadWorkspaceEngineerMap`. The page renders the form scaffolding
 * + safety messaging today; the POST handler ships in the next
 * phase so the schema decision is reviewable first.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type ApprovalRule,
} from "@/lib/workforce/agentWorkforceRegistry";
import { canTightenApprovalRule } from "@/lib/workforce/runtimeActionGate";

export const metadata: Metadata = {
  title: "Edit engineer policy · Axiom",
};

export const dynamic = "force-dynamic";

const RULE_OPTIONS: readonly ApprovalRule[] = [
  "no_approval_needed",
  "single_approver",
  "two_step_approval",
  "incident_commander_only",
  "blocked_always",
];

const RULE_LABEL: Record<ApprovalRule, string> = {
  no_approval_needed:      "Auto-OK (no approval)",
  single_approver:         "Single approval",
  two_step_approval:       "Two-step approval",
  incident_commander_only: "Incident commander only",
  blocked_always:          "Policy-blocked",
};

export default async function EditEngineerPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") notFound();

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }

  const record = await prisma.agentEngineerRecord.findUnique({
    where: { organizationId_engineerId: { organizationId: String(ctx.organizationId), engineerId: engineer.id } },
  }).catch(() => null);

  const canonical = engineer.approvalRule;
  const current: ApprovalRule = (record?.currentApprovalRule as ApprovalRule | null) ?? canonical;
  const isEnabled = record?.isEnabled ?? true;

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href={`/dashboard/workforce/${engineer.id}`} className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to engineer
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <LockClosedIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Policy override</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Tighten <span className="text-gradient">{engineer.displayName}</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          You can tighten this engineer's approval requirements, but you cannot loosen the platform safety baseline. The canonical default applies if no override is set.
        </p>
      </div>

      {/* Tightening invariant rail */}
      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-6">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Tightening rule</p>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>Allowed: single_approver → two_step_approval</li>
          <li>Allowed: two_step_approval → blocked_always</li>
          <li>Not allowed: two_step_approval → single_approver</li>
          <li>Not allowed: blocked_always → no_approval_needed</li>
        </ul>
        <p className="mt-3 text-[11px] text-zinc-400">
          Canonical default for this engineer: <span className="font-mono text-zinc-200">{RULE_LABEL[canonical]}</span>
        </p>
      </section>

      {/* Override form scaffolding */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <header className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Current rule</p>
          <p className="text-[14px] font-semibold text-white mt-1">{RULE_LABEL[current]}</p>
        </header>

        <div className="grid gap-2">
          {RULE_OPTIONS.map((rule) => {
            const allowed = canTightenApprovalRule(canonical, rule);
            const isCurrent = rule === current;
            return (
              <label
                key={rule}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 cursor-default ${
                  isCurrent
                    ? "border-violet-500/40 bg-violet-500/[0.05]"
                    : allowed
                      ? "border-white/[0.06] bg-white/[0.01] opacity-100"
                      : "border-rose-500/15 bg-rose-500/[0.03] opacity-70"
                }`}
              >
                <div>
                  <p className="text-[12.5px] font-semibold text-white">{RULE_LABEL[rule]}</p>
                  <p className="text-[10.5px] text-zinc-500 mt-0.5">
                    {!allowed
                      ? "Loosening below the canonical baseline — not allowed."
                      : isCurrent
                        ? "Currently in force in this workspace."
                        : "Tightening allowed."}
                  </p>
                </div>
                <input
                  type="radio"
                  name="rule"
                  value={rule}
                  defaultChecked={isCurrent}
                  disabled={!allowed}
                  className="accent-violet-500"
                />
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked={isEnabled} className="accent-violet-500" />
            <span className="text-[12px] text-zinc-300">Engineer enabled in this workspace</span>
          </label>
          <button
            disabled
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 disabled:opacity-60"
            title="Save handler ships in the next phase — schema decision under review."
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Save policy — coming next phase
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">What happens when you save</p>
        </header>
        <ul className="text-[12px] text-amber-100/85 leading-relaxed list-disc list-inside marker:text-amber-400/70">
          <li>The runtime gate immediately applies the new rule to every future action by this engineer.</li>
          <li>A `engineer.policy_override_updated` audit row is written with your user id + timestamp.</li>
          <li>Already-staged approval requests keep their original required-approver count.</li>
          <li>You can revert at any time — reverts also write an audit row.</li>
        </ul>
      </section>
    </div>
  );
}
