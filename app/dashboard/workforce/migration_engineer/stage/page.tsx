/**
 * /dashboard/workforce/migration_engineer/stage — Phase 374.
 *
 * Workspace surface for staging a migration plan through the migration
 * engineer's gated orchestrator. The form posts to the stage API; on
 * success the operator is sent to the approval detail page where the
 * required two approvers can vote.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { MigrationStageForm } from "@/components/workforce/MigrationStageForm";

export const metadata: Metadata = {
  title: "Stage migration · Axiom",
};

export const dynamic = "force-dynamic";

export default async function StageMigrationPage() {
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === "migration_engineer");
  if (!engineer || engineer.productLayer !== "client") notFound();

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }

  return (
    <div className="relative max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/workforce/migration_engineer"
          className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
        >
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to {engineer.displayName}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">
            Stage migration · {engineer.displayName}
          </p>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] mb-2">
          Capture the plan. <span className="text-gradient">Land it in approvals.</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
          The engineer builds a typed runbook from your descriptor (preflight → dual-write → backfill → cutover → stop dual-write → decommission). The runtime gate forces two-step approval for every migration apply. Nothing executes until both approvers vote.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <MigrationStageForm />
      </section>

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-2">// how staging works</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-amber-400/70 space-y-1">
          <li>Risk floor is <span className="font-mono text-rose-300">critical</span> — every migration apply requires two distinct approvers.</li>
          <li>Runbook is built pure (no DB). If it reports errors, staging is refused before any approval mint.</li>
          <li>On accept, you'll be sent to the approval detail page — share the link with the second approver.</li>
          <li>The audit fabric records the stage attempt, the gate decision, and every approver vote.</li>
        </ul>
      </section>
    </div>
  );
}
