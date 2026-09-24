/** /dashboard/workforce/workload_performance_engineer/analyses — Phase 640. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ChartBarSquareIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { WORKLOAD_PERFORMANCE_TARGET_KIND } from "@/lib/workforce/domains/workloadPerformanceEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-amber-300",
  error: "text-rose-300",
};

const VERDICT_TONE: Record<string, string> = {
  healthy: "text-emerald-300",
  concerning: "text-amber-300",
  degraded: "text-rose-300",
  critical: "text-rose-400",
};

export default async function WorkloadPerformanceAnalysesPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/workload_performance_engineer/analyses");
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: { organizationId: String(ctx.organizationId), targetKind: WORKLOAD_PERFORMANCE_TARGET_KIND },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { targetId: true, narrative: true, outcome: true, modelHint: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => []);

  const decoded = rows.map((r) => {
    let title = r.targetId;
    let verdict: string | null = null;
    let deviationCount = 0;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("verdict|")) verdict = e.slice("verdict|".length);
        else if (e.startsWith("deviation|")) deviationCount += 1;
      }
    }
    return { targetId: r.targetId, title, verdict, deviationCount, narrative: r.narrative, outcome: r.outcome, modelHint: r.modelHint, updatedAt: r.updatedAt };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">workload-performance</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">point-in-time telemetry analysis</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ChartBarSquareIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Workload performance analysis
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Paste a telemetry snapshot from any source — CloudWatch JSON, Datadog API output,
          Prometheus query, vCenter perfQuery, kubectl top, Grafana export. Engineer analyzes
          baseline deviation, hypothesizes root causes, recommends ordered remediation, and
          routes to downstream workforce engineers (verifier / anomaly / pipeline_repair /
          incident / reasoner).
        </p>
      </header>

      <section className="mb-10 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/workload_performance_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">title</label>
            <input id="title" name="title" required maxLength={200}
              placeholder="e.g. checkout API p95 latency spike · 2026-06-15 14:00 UTC"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="serviceDescription" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">service description</label>
            <textarea id="serviceDescription" name="serviceDescription" required rows={3} maxLength={2000}
              placeholder={"e.g. checkout API · Node 22 · EKS us-east-1 · 6 pods · ALB ingress · backed by Aurora Postgres + Redis ElastiCache · ~2k rps steady"}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="telemetrySnapshot" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">telemetry snapshot</label>
            <textarea id="telemetrySnapshot" name="telemetrySnapshot" required rows={12} maxLength={12000}
              placeholder={"Paste anything tabular:\n· CloudWatch metric JSON\n· Datadog API export\n· Prometheus query result\n· vCenter perfQuery output\n· kubectl top pods/nodes output\n· Grafana CSV export\n\nThe richer the time series, the more precise the analysis."}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="baselineExpectations" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">baseline expectations (optional but recommended)</label>
            <textarea id="baselineExpectations" name="baselineExpectations" rows={3} maxLength={2000}
              placeholder={"e.g. p95 latency ~ 180ms · error rate < 0.5% · CPU < 60% · memory < 70% · Aurora replica lag < 2s"}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="recentChanges" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">recent changes (optional)</label>
            <input id="recentChanges" name="recentChanges" maxLength={2000}
              placeholder="e.g. node-affinity rule shipped 2h ago · Aurora minor version bump last night · index rebuild ran at 13:30 UTC"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500 font-mono">metered AI · billable · ~$0.30 per analysis</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              analyze →
            </button>
          </div>
        </form>
      </section>

      {decoded.length === 0 ? (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No analyses yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">paste a telemetry snapshot to run the first one</p>
        </div>
      ) : (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span className="text-emerald-300">recent-analyses</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-400 tabular-nums">{decoded.length}</span>
          </p>
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((d) => (
              <li key={d.targetId}>
                <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${WORKLOAD_PERFORMANCE_TARGET_KIND}:${d.targetId}`)}`} className="block px-5 py-3.5 hover:bg-emerald-500/[0.04] transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {d.verdict && (
                      <span className={VERDICT_TONE[d.verdict] ?? "text-zinc-400"}>{d.verdict}</span>
                    )}
                    <span className="text-zinc-700">::</span>
                    <span className="text-zinc-400 tabular-nums">{d.deviationCount} deviation{d.deviationCount === 1 ? "" : "s"}</span>
                    <span className="text-zinc-500">·</span>
                    <span className={OUTCOME_TONE[d.outcome] ?? "text-zinc-400"}>{d.outcome.replace(/_/g, " ")}</span>
                    {d.modelHint && (<><span className="text-zinc-500">·</span><span className="text-zinc-400">{d.modelHint}</span></>)}
                    <span className="text-zinc-500 ml-auto">{d.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                  </div>
                  <p className="text-[14px] font-medium text-white">{d.title}</p>
                  <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{d.narrative}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
