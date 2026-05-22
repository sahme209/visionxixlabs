/**
 * /dashboard/workforce/coding — AI coding loop home.
 *
 * Two surfaces in one page:
 *   1. "Start a coding task" form — operator describes the change.
 *   2. Recent tasks list — most recent CodingTask rows for the workspace,
 *      each linking to its detail page (which itself surfaces the
 *      linked pipeline run timeline).
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { CodingTaskForm } from "@/components/workforce/CodingTaskForm";

export const metadata: Metadata = {
  title: "AI coding · Axiom",
  description: "AI engineer that proposes patches, runs tests, gates two-step approvals, and opens PRs.",
};

export const dynamic = "force-dynamic";

const TASK_STATUS_TONE: Record<string, string> = {
  queued:    "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  running:   "text-amber-300 bg-amber-500/10 border-amber-500/30",
  succeeded: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  failed:    "text-rose-300 bg-rose-500/10 border-rose-500/30",
  cancelled: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

export default async function CodingPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return <div className="p-8 text-sm text-zinc-300">Sign in required.</div>;
  }
  const orgId = String(ctx.organizationId);

  const tasks = await prisma.codingTask.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      run: { select: { id: true, status: true, completedAt: true } },
    },
  }).catch(() => [] as Array<never>);

  const statusGroups = await prisma.codingTask.groupBy({
    by: ["status"],
    where: { organizationId: orgId },
    _count: { _all: true },
  }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>);
  const countByStatus = new Map(statusGroups.map((g) => [g.status, g._count._all] as const));

  return (
    <div className="relative max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/workforce" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Workforce
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CodeBracketIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">AI coding</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Describe the change. <span className="text-gradient">We propose, gate, and ship.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          The AI engineer scans the target branch, drafts a minimal patch, runs lint + tests, pauses for two-step approval, then opens the PR with the audit correlation in the description. One click. Two reviewers. Zero shell access.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Running"   value={countByStatus.get("running")   ?? 0} icon={ClockIcon}              tone="text-amber-300" />
        <Stat label="Succeeded" value={countByStatus.get("succeeded") ?? 0} icon={CheckCircleIcon}        tone="text-emerald-300" />
        <Stat label="Failed"    value={countByStatus.get("failed")    ?? 0} icon={ExclamationTriangleIcon} tone="text-rose-300" />
        <Stat label="All"       value={Array.from(countByStatus.values()).reduce((a, b) => a + b, 0)}     icon={CpuChipIcon}             tone="text-violet-300" />
      </section>

      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-5 mb-8">
        <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-widest mb-3">// new coding task</p>
        <CodingTaskForm />
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// recent tasks</p>
      {tasks.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <CodeBracketIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No coding tasks yet.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            Start one above. Every stage transition is durable, every PR mint is audited.
          </p>
        </section>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const tone = TASK_STATUS_TONE[t.status] ?? TASK_STATUS_TONE.queued;
            return (
              <li key={t.id}>
                <Link
                  href={`/dashboard/workforce/coding/${t.id}`}
                  className="block rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-violet-500/25 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <p className="text-[12px] font-semibold text-white truncate">{t.instruction.slice(0, 120)}{t.instruction.length > 120 ? "…" : ""}</p>
                    <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${tone}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-zinc-500">
                    <span>repo · {t.repoRef}</span>
                    {t.branchHint && <span>branch · {t.branchHint}</span>}
                    <span>by · {t.createdBy}</span>
                    <span className="ml-auto">{t.createdAt.toISOString()}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof CheckCircleIcon; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <Icon className={`h-4 w-4 ${tone} mb-2`} />
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}
