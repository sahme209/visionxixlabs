/**
 * /dashboard/workforce/proof-of-value — Phase 630.
 *
 * The contract-conversion surface. A trial customer hits this page
 * during week 4 of their trial and sees a structured 30-day rollup
 * naming concrete wins, AI spend, autonomy KPI, safety triad
 * activity. Suitable to screenshot and share with their CFO/CTO.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, TrophyIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { buildProofOfValueReport } from "@/lib/workforce/domains/proofOfValue";

export const dynamic = "force-dynamic";

function fmtUsd(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents < 100) return `$${(cents / 100).toFixed(4)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ProofOfValuePage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/proof-of-value");
  }

  const report = await buildProofOfValueReport(String(ctx.organizationId), 30);

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">proof of value · 30-day rollup</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <TrophyIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          What your workforce produced
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Past 30 days of autonomous + operator-input engineer output, structured for handoff to a
          decision-maker. Honest counts — same source-of-truth queries the rest of the dashboard uses.
        </p>
      </header>

      {/* Headline narrative */}
      <section className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2">summary</p>
        <p className="text-[14.5px] text-zinc-100 leading-relaxed">{report.narrative}</p>
      </section>

      {/* Engineer activity */}
      <section className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">engineer activity · 30d</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Autonomous engineers fired" value={String(report.engineers.autonomousFired)} tone="text-emerald-300" />
          <Stat label="Operator-input engineers used" value={String(report.engineers.operatorInputUsed)} tone="text-sky-300" />
          <Stat label="Total reports" value={String(report.engineers.totalReports)} tone="text-white" />
          <Stat label="AI-generated" value={String(report.engineers.aiGenerated)} tone="text-emerald-300" />
          <Stat label="Fallback rules" value={String(report.engineers.fallbackRules)} tone="text-amber-300" />
          <Stat label="Errors" value={String(report.engineers.error)} tone={report.engineers.error > 0 ? "text-rose-300" : "text-zinc-400"} />
        </div>
      </section>

      {/* Spend */}
      <section className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">AI spend · 30d</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Gross" value={fmtUsd(report.spend.grossCents)} tone="text-white" />
          <Stat label="Billed (at margin)" value={fmtUsd(report.spend.billedCents)} tone="text-emerald-300" />
          <Stat label="Margin multiplier" value={`${report.spend.marginMultiplier}×`} tone="text-violet-300" />
        </div>
        {report.spend.topEngineerByCost && (
          <p className="text-[12px] text-zinc-400 leading-snug mt-3">
            Top engineer by cost: <span className="font-mono text-zinc-300">{report.spend.topEngineerByCost.engineName}</span> at <span className="text-emerald-300">{fmtUsd(report.spend.topEngineerByCost.cents)}</span>.
            See <Link href="/dashboard/workforce/cost" className="underline underline-offset-2 hover:text-white">cost panel →</Link> for full breakdown.
          </p>
        )}
      </section>

      {/* Concrete wins */}
      <section className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">concrete output · 30d</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Anomaly spikes detected" value={String(report.signal.anomalySpikes)} tone={report.signal.anomalySpikes > 0 ? "text-emerald-300" : "text-zinc-400"} />
          <Stat label="Schema proposals" value={String(report.signal.schemaProposals)} tone={report.signal.schemaProposals > 0 ? "text-emerald-300" : "text-zinc-400"} />
          <Stat label="Refactor plans" value={String(report.signal.refactorPlans)} tone={report.signal.refactorPlans > 0 ? "text-emerald-300" : "text-zinc-400"} />
          <Stat label="Migration runbooks" value={String(report.signal.migrationRunbooks)} tone={report.signal.migrationRunbooks > 0 ? "text-emerald-300" : "text-zinc-400"} />
          <Stat label="Incident summaries" value={String(report.signal.incidentSummaries)} tone={report.signal.incidentSummaries > 0 ? "text-emerald-300" : "text-zinc-400"} />
          <Stat label="Council verdicts" value={String(report.signal.councilVerdicts)} tone={report.signal.councilVerdicts > 0 ? "text-emerald-300" : "text-zinc-400"} />
        </div>
      </section>

      {/* Safety triad */}
      <section className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">safety triad · 30d</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Pre-flights run" value={String(report.safety.preflightsRun)} tone="text-white" />
          <Stat label="Allow" value={String(report.safety.allow)} tone="text-emerald-300" />
          <Stat label="Review" value={String(report.safety.review)} tone="text-amber-300" />
          <Stat label="Block" value={String(report.safety.block)} tone={report.safety.block > 0 ? "text-rose-300" : "text-zinc-400"} />
          <Stat label="Policy refuse" value={String(report.safety.policyRefuse)} tone={report.safety.policyRefuse > 0 ? "text-rose-300" : "text-zinc-400"} />
          <Stat label="Boundary catastrophic" value={String(report.safety.boundaryCatastrophic)} tone={report.safety.boundaryCatastrophic > 0 ? "text-rose-400" : "text-zinc-400"} />
        </div>
      </section>

      {/* Autonomy KPI */}
      <section className="mb-8 rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-violet-300 mb-2">autonomy · last 7d</p>
        {report.autonomy.last7dPct === null ? (
          <p className="text-[14px] text-zinc-100 leading-relaxed">No engineer output in the last 7 days — workforce idle or workspace fully suppressed.</p>
        ) : (
          <>
            <p className="text-[40px] font-bold text-violet-200 tabular-nums leading-none mb-2">{report.autonomy.last7dPct}%</p>
            <p className="text-[13px] text-zinc-300 leading-relaxed">
              {report.autonomy.last7dAiGenerated} of {report.autonomy.last7dTotal} engineer outputs in the last 7 days were produced by AI (vs fallback rules / error). The closer to 100%, the more your workforce is operating in real-AI mode.
            </p>
          </>
        )}
      </section>

      {/* Methodology note */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">methodology</p>
        <ul className="text-[12.5px] text-zinc-300 leading-relaxed space-y-1.5">
          <li>· All counts read directly from <span className="font-mono text-zinc-400">AiRationaleEnrichment</span> rows scoped to this workspace.</li>
          <li>· AI spend uses the canonical <span className="font-mono text-zinc-400">computeInvocationCost</span> helper (Phase 381 — same pricing math as your billing line items).</li>
          <li>· Safety triad counts read pre-flight slugs (ending in <span className="font-mono text-zinc-400">__approver</span>) and their associated boundary/policy rows.</li>
          <li>· Autonomy KPI is <span className="font-mono text-zinc-400">ai_generated / total</span> over domain-engineer rows in the last 7 days. Fallback rules count as "we tried" but not "AI delivered."</li>
          <li>· Margin multiplier defaults to 2× — your plan's actual multiplier applies on the live billing pipeline.</li>
        </ul>
      </section>

      <p className="text-[11px] text-zinc-500 text-center leading-snug">
        Generated {report.generatedAt.toISOString().slice(0, 19).replace("T", " ")} · workspace {report.workspaceId}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">{label}</p>
      <p className={`text-[22px] font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
