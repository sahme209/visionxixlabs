/**
 * /dashboard/workforce/approvals/[id] — snapshot detail.
 *
 * Per-approver decision history for a single engineer-sourced approval
 * snapshot. Shows the full quorum trail: who voted, what, when, why.
 * The decision buttons (when the viewer can still vote) are inline.
 *
 * The [id] param is the approvalRequestId — same id the queue links
 * with and the /decide route accepts.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  AGENT_WORKFORCE_REGISTRY,
  type AgentEngineer,
} from "@/lib/workforce/agentWorkforceRegistry";
import { ApprovalDecisionButtons } from "@/components/workforce/ApprovalDecisionButtons";
import { ExecuteApprovalButton } from "@/components/workforce/ExecuteApprovalButton";
import { findPipelineDefinition } from "@/lib/workforce/pipelines/pipelineRegistry";

export const metadata: Metadata = {
  title: "Approval detail · Axiom",
  description: "Per-approver decision trail for an engineer-sourced approval.",
};

export const dynamic = "force-dynamic";

const ENGINEER_LOOKUP: Map<string, AgentEngineer> = new Map(
  AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client").map((e) => [e.id, e] as const),
);

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }

  const snapshot = await prisma.engineerApprovalSnapshot.findUnique({
    where: { approvalRequestId: id },
    include: {
      decisions: {
        orderBy: { decidedAt: "asc" },
        select: {
          id: true,
          approverUserId: true,
          decision: true,
          reason: true,
          decidedAt: true,
        },
      },
      pipelineStageRun: {
        select: {
          id: true,
          stageId: true,
          runId: true,
          run: { select: { id: true, pipelineId: true } },
        },
      },
    },
  }).catch(() => null);

  if (!snapshot) notFound();

  // Cross-tenant guard — never leak another workspace's snapshot.
  if (snapshot.organizationId !== String(ctx.organizationId)) notFound();

  const engineer = ENGINEER_LOOKUP.get(snapshot.engineerId);
  const isPipelineSourced = snapshot.sourceKind === "pipeline_stage";
  const pipelineDef = isPipelineSourced && snapshot.pipelineStageRun?.run
    ? findPipelineDefinition(snapshot.pipelineStageRun.run.pipelineId)
    : null;
  const pipelineStageDef = pipelineDef && snapshot.pipelineStageRun
    ? pipelineDef.stages.find((s) => s.id === snapshot.pipelineStageRun?.stageId) ?? null
    : null;

  const approvedBy = Array.from(
    new Set(snapshot.decisions.filter((d) => d.decision === "approved").map((d) => d.approverUserId)),
  );
  const rejectedCount = snapshot.decisions.filter((d) => d.decision === "rejected").length;
  const approvedCount = approvedBy.length;
  const viewerUserId = ctx.userId ? String(ctx.userId) : (ctx.email ?? "unknown");
  const myVote = (snapshot.decisions.find((d) => d.approverUserId === viewerUserId)?.decision ?? null) as
    | "approved"
    | "rejected"
    | null;

  const statusTone =
    snapshot.status === "pending"  ? "text-amber-300 bg-amber-500/10 border-amber-500/30"   :
    snapshot.status === "approved" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
    snapshot.status === "rejected" ? "text-rose-300 bg-rose-500/10 border-rose-500/30"      :
    snapshot.status === "expired"  ? "text-zinc-400 bg-white/[0.04] border-white/[0.08]"    :
                                     "text-zinc-400 bg-white/[0.04] border-white/[0.08]";

  return (
    <div className="relative max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/workforce/approvals" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to approvals
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-amber-400" />
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">
            {isPipelineSourced ? "Pipeline approval gate" : "Approval snapshot"}
          </p>
        </div>
        {isPipelineSourced ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] mb-2">
              {pipelineDef?.name ?? snapshot.pipelineStageRun?.run?.pipelineId} · <span className="text-gradient">{pipelineStageDef?.name ?? snapshot.pipelineStageRun?.stageId}</span>
            </h1>
            <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
              A pipeline run paused at this approval gate. Approve to resume the run; reject to fail it. Two approvers required — same quorum machinery as engineer-sourced approvals.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] mb-2">
              {engineer?.displayName ?? snapshot.engineerId} · <span className="text-gradient">{snapshot.action}</span>
            </h1>
            <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
              Source engineer staged this action; the runtime gate required approval. Every approver vote is recorded below with audit correlation intact.
            </p>
          </>
        )}
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <CpuChipIcon className="h-4 w-4 text-violet-300 shrink-0" />
            {isPipelineSourced && snapshot.pipelineStageRun?.runId ? (
              <Link
                href={`/dashboard/workforce/pipelines/runs/${snapshot.pipelineStageRun.runId}`}
                className="text-[13px] font-semibold text-white hover:text-violet-200 truncate"
              >
                {pipelineDef?.name ?? "Pipeline run"} → {pipelineStageDef?.name ?? "stage"}
              </Link>
            ) : engineer ? (
              <Link
                href={`/dashboard/workforce/${engineer.id}`}
                className="text-[13px] font-semibold text-white hover:text-violet-200 truncate"
              >
                {engineer.displayName}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold text-zinc-400">{snapshot.engineerId}</span>
            )}
          </div>
          <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${statusTone}`}>
            {snapshot.status}
          </span>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <Meta label="Risk" value={snapshot.riskLevel} mono />
          <Meta label="Rule" value={snapshot.effectiveRule} mono />
          <Meta label="Required" value={`${approvedCount}/${Math.max(snapshot.requiredApprovers, 1)}`} mono />
          <Meta label="Requested by" value={snapshot.requestedBy} mono />
          <Meta label="Created" value={snapshot.createdAt.toISOString()} mono />
          {snapshot.decidedAt && <Meta label="Decided" value={snapshot.decidedAt.toISOString()} mono />}
          <Meta label="Correlation" value={snapshot.correlationId} mono span2 />
          {snapshot.attemptId && <Meta label="Attempt id" value={snapshot.attemptId} mono span2 />}
        </dl>

        {snapshot.status === "pending" && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-zinc-400">
              {snapshot.requiredApprovers > 1
                ? `Two-step approval · needs ${snapshot.requiredApprovers - approvedCount} more approver${snapshot.requiredApprovers - approvedCount === 1 ? "" : "s"}.`
                : "Single approver required."}
              {rejectedCount > 0 && " A rejection short-circuits the quorum."}
            </span>
            <ApprovalDecisionButtons
              approvalId={snapshot.approvalRequestId}
              status={snapshot.status}
              myVote={myVote}
              approvedCount={approvedCount}
              requiredApprovers={snapshot.requiredApprovers}
            />
          </div>
        )}
        {snapshot.status !== "pending" && snapshot.decisionReason && (
          <p className="mt-4 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-400">
            decision reason · "{snapshot.decisionReason}"
          </p>
        )}
      </section>

      {/* Execution section — only renders for terminal-approved snapshots. */}
      {snapshot.status === "approved" && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5 mb-6">
          <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-3">// execution</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] mb-4">
            <Meta label="Status" value={snapshot.executionStatus} mono />
            {snapshot.executedAt && <Meta label="Executed" value={snapshot.executedAt.toISOString()} mono />}
            {snapshot.executedByUserId && <Meta label="Executed by" value={snapshot.executedByUserId} mono />}
          </div>
          {snapshot.executionResultSummary && (
            <p className="text-[12px] text-emerald-200 mb-3 leading-relaxed">
              {snapshot.executionResultSummary}
            </p>
          )}
          {snapshot.executionError && (
            <p className="text-[12px] text-rose-200 mb-3 leading-relaxed">
              error · {snapshot.executionError}
            </p>
          )}
          <ExecuteApprovalButton
            approvalId={snapshot.approvalRequestId}
            snapshotStatus={snapshot.status}
            executionStatus={snapshot.executionStatus}
          />
        </section>
      )}

      <section className="mb-6">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// vote history</p>
        {snapshot.decisions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
            <ClockIcon className="h-5 w-5 text-zinc-500 mx-auto mb-2" />
            <p className="text-[12px] text-zinc-400">No votes recorded yet.</p>
            <p className="text-[10.5px] text-zinc-500 mt-1">First approver vote will appear here.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {snapshot.decisions.map((d, i) => {
              const isApprove = d.decision === "approved";
              const Icon = isApprove ? CheckCircleIcon : XCircleIcon;
              const tone = isApprove ? "text-emerald-300" : "text-rose-300";
              const border = isApprove ? "border-emerald-500/20" : "border-rose-500/20";
              return (
                <li key={d.id} className={`rounded-xl border bg-white/[0.02] px-4 py-3 ${border}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500">#{i + 1}</span>
                      <Icon className={`h-4 w-4 ${tone}`} />
                      <span className={`text-[12px] font-semibold ${tone}`}>{d.decision}</span>
                      <span className="text-[11px] text-zinc-400 truncate">by {d.approverUserId}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{d.decidedAt.toISOString()}</span>
                  </div>
                  {d.reason && (
                    <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">"{d.reason}"</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-2">// quorum rules</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-amber-400/70 space-y-1">
          <li>Critical actions require {snapshot.requiredApprovers} distinct approvers. Same user cannot vote twice.</li>
          <li>A single rejection short-circuits the quorum and marks the snapshot rejected.</li>
          <li>Each vote writes an audit row tying back to the engineer source and correlation id.</li>
          <li>Pending approvals older than 24h are auto-expired by the sweeper cron.</li>
        </ul>
      </section>
    </div>
  );
}

function Meta({ label, value, mono, span2 }: { label: string; value: string; mono?: boolean; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className={`text-[12px] text-zinc-100 mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
