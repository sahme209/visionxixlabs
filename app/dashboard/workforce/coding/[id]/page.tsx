/**
 * /dashboard/workforce/coding/[id] — coding task detail.
 *
 * Surfaces the operator's original instruction + repo target alongside
 * the linked pipeline run's stage timeline. Each stage's dry-run
 * output is rendered inline so the operator can see what the AI
 * "would have done" without leaving the page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClockIcon,
  PauseCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { findPipelineDefinition } from "@/lib/workforce/pipelines/pipelineRegistry";

export const metadata: Metadata = {
  title: "Coding task · Axiom",
};

export const dynamic = "force-dynamic";

const STAGE_TONE: Record<string, { tone: string; icon: typeof CheckCircleIcon; border: string }> = {
  queued:            { tone: "text-zinc-400",    icon: ClockIcon,               border: "border-white/[0.06]" },
  running:           { tone: "text-amber-300",   icon: ArrowPathIcon,           border: "border-amber-500/30" },
  succeeded:         { tone: "text-emerald-300", icon: CheckCircleIcon,         border: "border-emerald-500/20" },
  failed:            { tone: "text-rose-300",    icon: ExclamationTriangleIcon, border: "border-rose-500/30" },
  skipped:           { tone: "text-zinc-400",    icon: CheckCircleIcon,         border: "border-white/[0.06]" },
  awaiting_approval: { tone: "text-amber-300",   icon: PauseCircleIcon,         border: "border-amber-500/40" },
};

const RUN_STATUS_TONE: Record<string, string> = {
  queued:    "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  running:   "text-amber-300 bg-amber-500/10 border-amber-500/30",
  succeeded: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  failed:    "text-rose-300 bg-rose-500/10 border-rose-500/30",
  cancelled: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

export default async function CodingTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);

  const task = await prisma.codingTask.findUnique({
    where: { id },
    include: {
      run: {
        include: { stages: { orderBy: { ordering: "asc" } } },
      },
    },
  }).catch(() => null);

  if (!task) notFound();
  if (task.organizationId !== orgId) notFound();

  const def = findPipelineDefinition(task.run.pipelineId);
  const runTone = RUN_STATUS_TONE[task.run.status] ?? RUN_STATUS_TONE.queued;

  return (
    <div className="relative max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/workforce/coding" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to coding tasks
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <CodeBracketIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Coding task</p>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] mb-2">
          {task.instruction.slice(0, 120)}{task.instruction.length > 120 ? "…" : ""}
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
          Targeting <span className="font-mono text-zinc-200">{task.repoRef}</span>
          {task.branchHint && <> · branch <span className="font-mono text-zinc-200">{task.branchHint}</span></>}
          {" "}· started by {task.createdBy}.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-[11px] font-semibold text-white">Run summary</p>
          <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${runTone}`}>
            {task.run.status}
          </span>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <Meta label="Started" value={task.run.startedAt.toISOString()} />
          {task.run.completedAt && <Meta label="Completed" value={task.run.completedAt.toISOString()} />}
          <Meta label="Run id" value={task.run.id} span2 />
          <Meta label="Correlation" value={task.correlationId} span2 />
        </dl>
        {task.instruction.length > 120 && (
          <details className="mt-4 pt-4 border-t border-white/[0.06]">
            <summary className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 cursor-pointer">full instruction ({task.instruction.length} chars)</summary>
            <p className="mt-2 text-[12px] text-zinc-200 leading-relaxed whitespace-pre-wrap">{task.instruction}</p>
          </details>
        )}
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// stage timeline</p>
      <ol className="space-y-2 mb-6">
        {task.run.stages.map((s, i) => {
          const meta = STAGE_TONE[s.status] ?? STAGE_TONE.queued;
          const Icon = meta.icon;
          const defStage = def?.stages.find((ds) => ds.id === s.stageId);
          return (
            <li key={s.id} className={`rounded-xl border bg-white/[0.02] px-4 py-3 ${meta.border}`}>
              <header className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-zinc-500">#{i + 1}</span>
                  <Icon className={`h-4 w-4 ${meta.tone} ${s.status === "running" ? "animate-spin" : ""}`} />
                  <p className="text-[12px] font-semibold text-white truncate">{defStage?.name ?? s.stageId}</p>
                  {s.requiresApproval && (
                    <ShieldCheckIcon className="h-3 w-3 text-amber-400" />
                  )}
                </div>
                <span className={`text-[9px] font-mono uppercase tracking-wider ${meta.tone}`}>
                  {s.status.replace(/_/g, " ")}
                </span>
              </header>
              {defStage && <p className="text-[11px] text-zinc-400 mb-1 leading-snug">{defStage.description}</p>}
              {s.outputSummary && (
                <p className="text-[11px] text-emerald-200 mt-1 leading-relaxed">{s.outputSummary}</p>
              )}
              {s.errorMessage && (
                <p className="text-[11px] text-rose-200 mt-1 leading-relaxed">error · {s.errorMessage}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-500 mt-2">
                <span>kind · {s.stageKind}</span>
                {s.startedAt && <span>started · {s.startedAt.toISOString()}</span>}
                {s.completedAt && <span>finished · {s.completedAt.toISOString()}</span>}
                {s.approvalRequestId && (
                  <Link
                    href={`/dashboard/workforce/approvals/${s.approvalRequestId}`}
                    className="text-violet-300 hover:text-violet-200 ml-auto"
                  >
                    approval · {s.approvalRequestId} →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-2">// safety rails</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-amber-400/70 space-y-1">
          <li>The PR-open stage is gated by two-step approval — no code leaves until both approvers vote.</li>
          <li>Every stage transition is durable in Postgres + audited in the secure audit fabric.</li>
          <li>Executors are dry-run by default. Real Anthropic SDK integration is pluggable without touching the runner.</li>
          <li>Tasks belong to a workspace — cross-tenant reads return 404.</li>
        </ul>
      </section>
    </div>
  );
}

function Meta({ label, value, span2 }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-[12px] font-mono text-zinc-100 mt-0.5 truncate">{value}</dd>
    </div>
  );
}
