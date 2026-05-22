/**
 * /dashboard/workforce/pipelines — pipeline catalog + recent runs.
 *
 * Lists every PipelineDefinition in the registry with a one-click
 * "Run pipeline" button, plus the workspace's most recent runs across
 * all pipelines. Each run links to its detail page with the stage
 * timeline.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  EyeIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { PIPELINE_REGISTRY, type PipelineCategory } from "@/lib/workforce/pipelines/pipelineRegistry";
import { StartPipelineButton } from "@/components/workforce/StartPipelineButton";

export const metadata: Metadata = {
  title: "Pipelines · Axiom",
  description: "Multi-stage workflows with gates between stages — one click to ship.",
};

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<PipelineCategory, { label: string; icon: typeof BoltIcon; tone: string }> = {
  ci_cd:         { label: "CI/CD",         icon: ServerStackIcon, tone: "text-violet-300" },
  database:      { label: "Database",      icon: CircleStackIcon, tone: "text-blue-300" },
  security:      { label: "Security",      icon: ShieldCheckIcon, tone: "text-amber-300" },
  observability: { label: "Observability", icon: EyeIcon,         tone: "text-cyan-300"  },
};

const RUN_STATUS_TONE: Record<string, string> = {
  queued:    "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  running:   "text-amber-300 bg-amber-500/10 border-amber-500/30",
  succeeded: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  failed:    "text-rose-300 bg-rose-500/10 border-rose-500/30",
  cancelled: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

export default async function PipelinesPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);

  const recentRuns = await prisma.pipelineRun.findMany({
    where: { organizationId: orgId },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { stages: { select: { status: true } } },
  }).catch(() => [] as Array<never>);

  const statusGroups = await prisma.pipelineRun.groupBy({
    by: ["status"],
    where: { organizationId: orgId },
    _count: { _all: true },
  }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>);
  const countByStatus = new Map(statusGroups.map((g) => [g.status, g._count._all] as const));

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
          <BoltIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Pipelines</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Ship. <span className="text-gradient">Without holding your breath.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Multi-stage workflows with the gate baked in. Build → test → security → approve → deploy → smoke — every stage durable, every transition audited, every approval enforced.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Running"    value={countByStatus.get("running")   ?? 0} icon={ClockIcon}              tone="text-amber-300" />
        <Stat label="Succeeded"  value={countByStatus.get("succeeded") ?? 0} icon={CheckCircleIcon}        tone="text-emerald-300" />
        <Stat label="Failed"     value={countByStatus.get("failed")    ?? 0} icon={ExclamationTriangleIcon} tone="text-rose-300" />
        <Stat label="Catalog"    value={PIPELINE_REGISTRY.length}            icon={CpuChipIcon}             tone="text-violet-300" />
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// catalog</p>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
        {PIPELINE_REGISTRY.map((p) => {
          const meta = CATEGORY_META[p.category];
          const Icon = meta.icon;
          const totalSeconds = p.stages.reduce((acc, s) => acc + s.expectedDurationSeconds, 0);
          return (
            <article key={p.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-violet-500/25 transition-colors">
              <header className="flex items-center gap-2 mb-2 flex-wrap">
                <Icon className={`h-4 w-4 ${meta.tone}`} />
                <p className={`text-[10px] font-mono uppercase tracking-wider ${meta.tone}`}>{meta.label}</p>
              </header>
              <h3 className="text-[15px] font-semibold text-white mb-1">{p.name}</h3>
              <p className="text-[12px] text-zinc-400 mb-3 leading-snug">{p.tagline}</p>
              <p className="text-[11px] text-zinc-500 mb-3 leading-snug">{p.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.stages.map((s) => (
                  <span
                    key={s.id}
                    className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${
                      s.requiresApproval
                        ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                        : "text-zinc-300 bg-white/[0.02] border-white/[0.08]"
                    }`}
                    title={s.description}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/[0.04]">
                <span className="text-[10px] font-mono text-zinc-500">
                  {p.stages.length} stages · ~{totalSeconds}s dry-run
                </span>
                <StartPipelineButton pipelineId={p.id} label="Run pipeline" />
              </div>
            </article>
          );
        })}
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// recent runs</p>
      {recentRuns.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <ClockIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No runs yet.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            Trigger a pipeline above. Every stage transition lands here with the full audit trail.
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {recentRuns.map((r) => {
            const def = PIPELINE_REGISTRY.find((p) => p.id === r.pipelineId);
            const tone = RUN_STATUS_TONE[r.status] ?? RUN_STATUS_TONE.queued;
            const succeeded = r.stages.filter((s) => s.status === "succeeded").length;
            const failed    = r.stages.filter((s) => s.status === "failed").length;
            const total     = r.stages.length;
            return (
              <Link
                key={r.id}
                href={`/dashboard/workforce/pipelines/runs/${r.id}`}
                className="block rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-violet-500/25 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <p className="text-[12px] font-semibold text-white truncate">
                    {def?.name ?? r.pipelineId}
                  </p>
                  <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${tone}`}>
                    {r.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-500">
                  <span>by {r.triggeredBy}</span>
                  <span>{succeeded}/{total} succeeded{failed > 0 ? ` · ${failed} failed` : ""}</span>
                  <span className="ml-auto">{r.startedAt.toISOString()}</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof BoltIcon; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <Icon className={`h-4 w-4 ${tone} mb-2`} />
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}
