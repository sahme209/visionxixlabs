/** /dashboard/workforce/approver_engineer/packets — Phase 608. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { APPROVER_TARGET_KIND } from "@/lib/workforce/domains/approverEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-zinc-300",
  error: "text-rose-300",
};

const DECISION_TONE: Record<string, string> = {
  approve: "text-emerald-300",
  reject: "text-rose-300",
  revise: "text-zinc-300",
  escalate: "text-sky-300",
};

export default async function ApprovalPacketsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/approver_engineer/packets");
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: { organizationId: String(ctx.organizationId), targetKind: APPROVER_TARGET_KIND },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { targetId: true, narrative: true, outcome: true, modelHint: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => []);

  const decoded = rows.map((r) => {
    let title = r.targetId;
    let decision: string | null = null;
    let authority: string | null = null;
    let impact: string | null = null;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("decision|")) decision = e.slice("decision|".length);
        else if (e.startsWith("authority|")) authority = e.slice("authority|".length);
        else if (e.startsWith("impact|")) impact = e.slice("impact|".length);
      }
    }
    return { targetId: r.targetId, title, decision, authority, impact, narrative: r.narrative, outcome: r.outcome, modelHint: r.modelHint, updatedAt: r.updatedAt };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce/approver_engineer" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Approver Engineer
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">packets · approver engineer</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Assemble an approval packet
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Paste a proposal + risk context. The engineer assembles the structured packet a
          decision-maker needs to sign or refuse: impact radius, decision authority, reversibility,
          recommended decision, and the artifacts they should open first.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/approver_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">title</label>
            <input id="title" name="title" required maxLength={200} placeholder="e.g. Approve quarterly schema purge"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="proposalDescription" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">proposal description</label>
            <textarea id="proposalDescription" name="proposalDescription" required rows={6} maxLength={6000} placeholder={"What is the action you want approval to take? Be specific about scope and end state."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="riskContext" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">risk context</label>
            <textarea id="riskContext" name="riskContext" required rows={6} maxLength={6000} placeholder={"What could go wrong? Blast radius, irreversibility, downstream consumers, mitigations already in place."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="requestedAuthority" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">requested authority (optional)</label>
              <input id="requestedAuthority" name="requestedAuthority" maxLength={200} placeholder="operator | admin | council | board"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
            </div>
            <div>
              <label htmlFor="knownDependencies" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">known dependencies (optional)</label>
              <input id="knownDependencies" name="knownDependencies" maxLength={1000} placeholder="e.g. blocks the migration_engineer Phase 3 runbook"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500">Metered AI · billable usage · same pipeline as every engineer.</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              assemble the packet →
            </button>
          </div>
        </form>
      </section>

      {decoded.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No approval packets yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Submit the form above to assemble the first one.</p>
        </div>
      ) : (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recent packets · {decoded.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((d) => (
              <li key={d.targetId}>
                <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${APPROVER_TARGET_KIND}:${d.targetId}`)}`} className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {d.decision && (<span className={DECISION_TONE[d.decision] ?? "text-zinc-400"}>{d.decision}</span>)}
                    {d.authority && (<><span className="text-zinc-500">·</span><span className="text-zinc-400">{d.authority}</span></>)}
                    {d.impact && (<><span className="text-zinc-500">·</span><span className="text-zinc-400">{d.impact}</span></>)}
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
