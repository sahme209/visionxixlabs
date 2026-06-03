/** /dashboard/workforce/simulator_engineer/simulations — Phase 605. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { SIMULATOR_TARGET_KIND } from "@/lib/workforce/domains/simulatorEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-amber-300",
  error: "text-rose-300",
};

const VERDICT_TONE: Record<string, string> = {
  safe: "text-emerald-300",
  caution: "text-amber-300",
  unsafe: "text-rose-300",
};

export default async function SimulatorSimulationsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/simulator_engineer/simulations");
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: { organizationId: String(ctx.organizationId), targetKind: SIMULATOR_TARGET_KIND },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { targetId: true, narrative: true, outcome: true, modelHint: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => []);

  const decoded = rows.map((r) => {
    let title = r.targetId;
    let verdict: string | null = null;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("verdict|")) verdict = e.slice("verdict|".length);
      }
    }
    return { targetId: r.targetId, title, verdict, narrative: r.narrative, outcome: r.outcome, modelHint: r.modelHint, updatedAt: r.updatedAt };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce/simulator_engineer" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Simulator Engineer
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">simulations · simulator engineer</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Dry-run a proposed action
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Describe the proposed action + the current state. The engineer simulates the outcome and
          returns a typed verdict (safe / caution / unsafe), predicted outcomes, detected side
          effects, and pre-approval requirements before any approval packet is built.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/simulator_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">title</label>
            <input id="title" name="title" required maxLength={200} placeholder="e.g. Drop legacy session columns"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="proposedAction" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">proposed action</label>
            <textarea id="proposedAction" name="proposedAction" required rows={6} maxLength={6000} placeholder={"Describe exactly what action you want to dry-run. SQL, API call, deploy step, configuration change, etc."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="currentState" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">current state</label>
            <textarea id="currentState" name="currentState" required rows={6} maxLength={6000} placeholder={"Describe the state the action will run against: schema, traffic profile, feature-flag scope, live consumers, etc."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="knownConstraints" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">known constraints (optional)</label>
              <input id="knownConstraints" name="knownConstraints" maxLength={1000} placeholder="e.g. zero downtime, prod traffic 5k rps"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
            </div>
            <div>
              <label htmlFor="blastRadius" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">blast radius hint (optional)</label>
              <input id="blastRadius" name="blastRadius" maxLength={600} placeholder="e.g. only the staging org, single workspace"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500">Metered AI · billable usage · same pipeline as every engineer.</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              run the simulation →
            </button>
          </div>
        </form>
      </section>

      {decoded.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No simulations yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Submit the form above to run the first one.</p>
        </div>
      ) : (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recent simulations · {decoded.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((d) => (
              <li key={d.targetId}>
                <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${SIMULATOR_TARGET_KIND}:${d.targetId}`)}`} className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {d.verdict && (<span className={VERDICT_TONE[d.verdict] ?? "text-zinc-400"}>{d.verdict}</span>)}
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
