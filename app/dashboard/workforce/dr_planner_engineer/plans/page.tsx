/** /dashboard/workforce/dr_planner_engineer/plans — Phase 638. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, LifebuoyIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { DR_PLANNER_TARGET_KIND } from "@/lib/workforce/domains/drPlannerEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-amber-300",
  error: "text-rose-300",
};

const VERDICT_TONE: Record<string, string> = {
  achievable: "text-emerald-300",
  aspirational: "text-amber-300",
  gap: "text-rose-300",
};

export default async function DrPlansPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/dr_planner_engineer/plans");
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: { organizationId: String(ctx.organizationId), targetKind: DR_PLANNER_TARGET_KIND },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { targetId: true, narrative: true, outcome: true, modelHint: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => []);

  const decoded = rows.map((r) => {
    let title = r.targetId;
    let rpo: string | null = null;
    let rto: string | null = null;
    let verdict: string | null = null;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("rpo_target|")) rpo = e.slice("rpo_target|".length);
        else if (e.startsWith("rto_target|")) rto = e.slice("rto_target|".length);
        else if (e.startsWith("achievability_verdict|")) verdict = e.slice("achievability_verdict|".length);
      }
    }
    return { targetId: r.targetId, title, rpo, rto, verdict, narrative: r.narrative, outcome: r.outcome, modelHint: r.modelHint, updatedAt: r.updatedAt };
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
          <span className="text-emerald-300">dr-planner</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">disaster-recovery + contingency</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <LifebuoyIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Disaster recovery plan
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Paste your infrastructure topology + RPO/RTO targets. Engineer drafts a 6-section DR
          plan (NIST 800-34 / SOC2 CC7.5 / ISO 22301 evidence-grade): business-impact analysis,
          backup strategy with verification, ordered failover runbook, chaos-drill protocol,
          roles &amp; responsibilities, communication plan. The achievability verdict tells you
          honestly whether your declared RPO/RTO is realistic given the topology.
        </p>
      </header>

      <section className="mb-10 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/dr_planner_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">title</label>
            <input id="title" name="title" required maxLength={200} placeholder="e.g. Production DR plan v2.0 · AWS us-east-1 primary"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="rpoTarget" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">rpo target</label>
              <input id="rpoTarget" name="rpoTarget" required maxLength={80} placeholder="e.g. 15 minutes"
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
              <p className="text-[10px] text-zinc-500 mt-1 font-mono">max acceptable data loss</p>
            </div>
            <div>
              <label htmlFor="rtoTarget" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">rto target</label>
              <input id="rtoTarget" name="rtoTarget" required maxLength={80} placeholder="e.g. 1 hour"
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
              <p className="text-[10px] text-zinc-500 mt-1 font-mono">max acceptable downtime</p>
            </div>
          </div>
          <div>
            <label htmlFor="topology" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">infrastructure topology</label>
            <textarea id="topology" name="topology" required rows={10} maxLength={8000}
              placeholder={"Describe your stack. Examples:\n· AWS us-east-1 primary, us-west-2 standby (warm)\n· RDS Postgres 16, Multi-AZ, cross-region replicas\n· EKS clusters, 3 AZs each, ALB ingress\n· S3 buckets with cross-region replication\n· Datadog for monitoring, PagerDuty for paging\n· Daily backups via AWS Backup to glacier, weekly point-in-time test restores"}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="tier0Services" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">tier-0 services (optional)</label>
            <input id="tier0Services" name="tier0Services" maxLength={1000}
              placeholder="e.g. checkout API, auth service, payment processor — the ones that take the company offline"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="existingBackups" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">existing backups (optional)</label>
            <input id="existingBackups" name="existingBackups" maxLength={1000}
              placeholder="e.g. AWS Backup daily snapshots, Veeam for VMware, no current test-restore process"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="complianceContext" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">compliance context (optional)</label>
            <input id="complianceContext" name="complianceContext" maxLength={600}
              placeholder="e.g. SOC2 Type II CC7.5 evidence + HIPAA §164.308(a)(7) contingency plan"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500 font-mono">metered AI · billable · ~$0.45 per plan</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              draft dr plan →
            </button>
          </div>
        </form>
      </section>

      {decoded.length === 0 ? (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No DR plans yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">submit the form above to draft the first one</p>
        </div>
      ) : (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span className="text-emerald-300">recent-plans</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-400 tabular-nums">{decoded.length}</span>
          </p>
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((d) => (
              <li key={d.targetId}>
                <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${DR_PLANNER_TARGET_KIND}:${d.targetId}`)}`} className="block px-5 py-3.5 hover:bg-emerald-500/[0.04] transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {d.verdict && (
                      <span className={VERDICT_TONE[d.verdict] ?? "text-zinc-400"}>{d.verdict}</span>
                    )}
                    {d.rpo && (
                      <>
                        <span className="text-zinc-700">::</span>
                        <span className="text-zinc-400">RPO {d.rpo}</span>
                      </>
                    )}
                    {d.rto && (
                      <>
                        <span className="text-zinc-700">::</span>
                        <span className="text-zinc-400">RTO {d.rto}</span>
                      </>
                    )}
                    <span className="text-zinc-500">·</span>
                    <span className={OUTCOME_TONE[d.outcome] ?? "text-zinc-400"}>{d.outcome.replace(/_/g, " ")}</span>
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
