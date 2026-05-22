/**
 * /admin/eval-runs — Phase 389.
 *
 * Internal AI coding loop eval dashboard. Admin-gated (ADMIN_EMAILS).
 * Shows recent eval runs + per-run case grids. Operator can fire a
 * manual or dry-run eval from here.
 *
 * Never linked from client surfaces.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  ChartBarIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { EVAL_TASK_CORPUS } from "@/lib/workforce/eval/evalTaskCorpus";
import { formatCents } from "@/lib/billing/computeInvocationCost";
import { RunEvalSuiteButton } from "@/components/admin/RunEvalSuiteButton";

export const metadata: Metadata = {
  title: "AI coding eval · Admin",
};

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  pass:     "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  fail:     "text-rose-300 bg-rose-500/10 border-rose-500/30",
  errored:  "text-rose-300 bg-rose-500/15 border-rose-500/40",
  skipped:  "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

const STATUS_TONE: Record<string, string> = {
  pending:   "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  running:   "text-amber-300 bg-amber-500/10 border-amber-500/30",
  completed: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  failed:    "text-rose-300 bg-rose-500/10 border-rose-500/30",
};

export default async function AdminEvalRunsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/login");
  }

  const runs = await prisma.evalRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
    include: {
      cases: {
        orderBy: { taskKey: "asc" },
        select: { id: true, taskKey: true, outcome: true, score: true, durationMs: true, failures: true, notes: true },
      },
    },
  }).catch(() => [] as Array<never>);

  const totalRuns = runs.length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const totalSpend = runs.reduce((acc, r) => acc + r.totalCostCents, 0);
  const lastRun = runs[0];

  return (
    <div className="relative max-w-6xl">
      <div className="mb-6">
        <Link href="/admin" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to admin
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ChartBarIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">AI coding eval · admin only</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Quality gate · <span className="text-gradient">{EVAL_TASK_CORPUS.length} synthetic tasks</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-3xl leading-relaxed">
          Nightly cron walks the eval corpus through the live AI coding loop. Each task scored by the pure scorer; regressions surface here before they break a real customer.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Runs (last 30)" value={String(totalRuns)} tone="text-violet-300" />
        <Stat label="Completed" value={String(completed)} tone={completed > 0 ? "text-emerald-300" : "text-zinc-300"} />
        <Stat label="Total eval spend" value={formatCents(totalSpend)} tone="text-amber-300" />
        <Stat
          label="Last run pass rate"
          value={lastRun ? `${Math.round((lastRun.passCount / Math.max(1, lastRun.totalCases - lastRun.skippedCount)) * 100)}%` : "—"}
          tone={lastRun && lastRun.failCount === 0 ? "text-emerald-300" : "text-rose-300"}
        />
      </section>

      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5 mb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[12px] font-semibold text-white mb-1">Trigger an eval run</p>
            <p className="text-[11.5px] text-zinc-400 leading-snug">
              Manual runs burn real Anthropic tokens. Dry-run skips the actual pipeline call — useful to verify the scaffolding without cost.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RunEvalSuiteButton dryRun />
            <RunEvalSuiteButton />
          </div>
        </div>
      </section>

      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">// recent runs</p>
      {runs.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <CpuChipIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No eval runs yet.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            Fire a dry-run above to verify the scaffolding, or wait for the nightly cron at 07:00 UTC.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {runs.map((r) => {
            const statusTone = STATUS_TONE[r.status] ?? STATUS_TONE.pending;
            const denom = Math.max(1, r.totalCases - r.skippedCount);
            const passRate = Math.round((r.passCount / denom) * 100);
            return (
              <article key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <header className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300">{r.runKind}</span>
                    <span className="text-[11px] font-mono text-zinc-300 truncate">by {r.triggeredBy}</span>
                  </div>
                  <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${statusTone}`}>
                    {r.status}
                  </span>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-[10.5px] mb-3">
                  <Field label="Pass" value={String(r.passCount)} tone="text-emerald-300" />
                  <Field label="Fail" value={String(r.failCount)} tone={r.failCount > 0 ? "text-rose-300" : "text-zinc-300"} />
                  <Field label="Skipped" value={String(r.skippedCount)} />
                  <Field label="Pass rate" value={`${passRate}%`} tone={passRate >= 80 ? "text-emerald-300" : "text-rose-300"} />
                  <Field label="Spend" value={formatCents(r.totalCostCents)} />
                  <Field label="Started" value={r.startedAt.toISOString().slice(11, 19)} />
                </div>

                {r.cases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.04]">
                    {r.cases.map((c) => {
                      const tone = OUTCOME_TONE[c.outcome] ?? OUTCOME_TONE.skipped;
                      const Icon = c.outcome === "pass" ? CheckCircleIcon : c.outcome === "skipped" ? CpuChipIcon : ExclamationTriangleIcon;
                      return (
                        <span
                          key={c.id}
                          className={`text-[10px] font-mono inline-flex items-center gap-1 border rounded-full px-1.5 py-0.5 ${tone}`}
                          title={`${c.taskKey} · score ${Math.round(c.score * 100)}% · ${c.notes ?? ""}`}
                        >
                          <Icon className="h-3 w-3" />
                          {c.taskKey} · {Math.round(c.score * 100)}%
                        </span>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
        <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-widest mb-2">// how the eval harness works</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-amber-400/70 space-y-1">
          <li>Corpus lives in <code className="text-zinc-200">lib/workforce/eval/evalTaskCorpus.ts</code> — add tasks here to expand coverage.</li>
          <li>Pure scorer in <code className="text-zinc-200">lib/workforce/eval/scoreEvalCase.ts</code> with 14 unit tests covers expectation matching, partial credit, fatal failures, threshold pass/fail.</li>
          <li>Cron schedule: <code className="text-zinc-200">0 7 * * *</code> (daily 07:00 UTC). Bearer CRON_SECRET guarded.</li>
          <li>When ANTHROPIC_API_KEY is unset, every case lands as <span className="font-mono text-zinc-200">skipped</span> — scaffolding stays live without burning tokens.</li>
          <li>Audit fabric: <code className="text-zinc-200">eval.run_started</code>, <code className="text-zinc-200">eval.case_recorded</code>, <code className="text-zinc-200">eval.run_completed</code> — every transition.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`font-mono mt-0.5 ${tone ?? "text-zinc-100"}`}>{value}</p>
    </div>
  );
}
