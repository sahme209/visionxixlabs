/**
 * /dashboard/workforce/pipelines/runs/[runId] — per-run stage timeline.
 *
 * Renders every PipelineStageRun for a PipelineRun in order. Each row
 * shows the stage status, executor output / error, timestamps, and
 * (for approval gates) the linked approval id. Cross-tenant guarded.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  BoltIcon,
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
  title: "Pipeline run · Axiom",
};

export const dynamic = "force-dynamic";

const STAGE_TONE: Record<string, { tone: string; icon: typeof CheckCircleIcon; label: string }> = {
  queued:             { tone: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",                     icon: ClockIcon,                label: "queued" },
  running:            { tone: "text-amber-300 bg-amber-500/10 border-amber-500/30",                    icon: ArrowPathIcon,            label: "running" },
  succeeded:          { tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",              icon: CheckCircleIcon,          label: "succeeded" },
  failed:             { tone: "text-rose-300 bg-rose-500/10 border-rose-500/30",                       icon: ExclamationTriangleIcon,  label: "failed" },
  skipped:            { tone: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",                     icon: CheckCircleIcon,          label: "skipped" },
  awaiting_approval:  { tone: "text-amber-300 bg-amber-500/15 border-amber-500/40",                    icon: PauseCircleIcon,          label: "awaiting approval" },
};

const RUN_STATUS_TONE: Record<string, string> = {
  queued:    "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  running:   "text-amber-300 bg-amber-500/10 border-amber-500/30",
  succeeded: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  failed:    "text-rose-300 bg-rose-500/10 border-rose-500/30",
  cancelled: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

export default async function PipelineRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);

  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: {
      stages: { orderBy: { ordering: "asc" } },
    },
  }).catch(() => null);

  if (!run) notFound();
  if (run.organizationId !== orgId) notFound();

  const def = findPipelineDefinition(run.pipelineId);
  const runTone = RUN_STATUS_TONE[run.status] ?? RUN_STATUS_TONE.queued;

  const succeeded = run.stages.filter((s) => s.status === "succeeded").length;
  const failed    = run.stages.filter((s) => s.status === "failed").length;
  const pending   = run.stages.filter((s) => s.status === "queued" || s.status === "running" || s.status === "awaiting_approval").length;

  return (
    <div className="relative max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/workforce/pipelines" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to pipelines
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <BoltIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Pipeline run</p>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] mb-2">
          {def?.name ?? run.pipelineId} · <span className="text-gradient">{run.status}</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-2xl leading-relaxed">
          {def?.description ?? "Pipeline definition no longer in the registry."}
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-[11px] font-semibold text-white">Run summary</p>
          <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${runTone}`}>
            {run.status}
          </span>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <Meta label="Triggered by" value={run.triggeredBy} />
          <Meta label="Started" value={run.startedAt.toISOString()} />
          {run.completedAt && <Meta label="Completed" value={run.completedAt.toISOString()} />}
          <Meta label="Stages" value={`${succeeded} ✓ · ${pending} ⌛ · ${failed} ✕`} />
          <Meta label="Correlation" value={run.correlationId} span2 />
          <Meta label="Run id" value={run.id} span2 />
        </dl>
        {run.errorSummary && (
          <p className="mt-4 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-rose-300">
            {run.errorSummary}
          </p>
        )}
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// stage timeline</p>
      <ol className="space-y-2">
        {run.stages.map((s, i) => {
          const meta = STAGE_TONE[s.status] ?? STAGE_TONE.queued;
          const Icon = meta.icon;
          const defStage = def?.stages.find((ds) => ds.id === s.stageId);
          return (
            <li key={s.id} className={`rounded-xl border bg-white/[0.02] px-4 py-3 ${meta.tone.split(" ").find((c) => c.startsWith("border-")) ?? "border-white/[0.06]"}`}>
              <header className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-zinc-500">#{i + 1}</span>
                  <Icon className={`h-4 w-4 ${meta.tone.split(" ")[0]} ${s.status === "running" ? "animate-spin" : ""}`} />
                  <p className="text-[12px] font-semibold text-white truncate">{defStage?.name ?? s.stageId}</p>
                  {s.requiresApproval && (
                    <ShieldCheckIcon className="h-3 w-3 text-amber-400" title="Approval gate" />
                  )}
                </div>
                <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${meta.tone}`}>
                  {meta.label}
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
