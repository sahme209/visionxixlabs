/** /dashboard/workforce/safety-preflight — Phase 613 · recent verdicts added Phase 616. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DECISION_TONE: Record<string, string> = {
  approve: "text-emerald-300",
  reject: "text-rose-300",
  revise: "text-amber-300",
  escalate: "text-sky-300",
};

interface PreflightRow {
  preflightSlug: string;
  title: string;
  narrative: string;
  decision: string | null;
  updatedAt: Date;
}

function pickStr(v: string | string[] | undefined, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

async function recentPreflights(orgId: string): Promise<PreflightRow[]> {
  // Pre-flight composes three engineers under slugs ending in
  // "__approver", "__boundary", "__policy". Land on the approver row
  // since it carries the recommended decision and the narrative.
  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: orgId,
      targetKind: "engineer_approval_packet",
      targetId: { endsWith: "__approver" },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { targetId: true, narrative: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => [] as Array<{ targetId: string; narrative: string; updatedAt: Date; nextActionsJson: unknown }>);

  return rows.map((r) => {
    let title = r.targetId.replace(/__approver$/, "");
    let decision: string | null = null;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("decision|")) decision = e.slice("decision|".length);
      }
    }
    return { preflightSlug: r.targetId, title, narrative: r.narrative, decision, updatedAt: r.updatedAt };
  });
}

export default async function SafetyPreflightPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/safety-preflight");
  }

  const sp = (await searchParams) ?? {};
  const prefill = {
    title: pickStr(sp.title, 200),
    actionDescription: pickStr(sp.actionDescription, 6000),
    currentState: pickStr(sp.currentState, 6000),
    riskContext: pickStr(sp.riskContext, 6000),
    tenantCharter: pickStr(sp.tenantCharter, 6000),
  };

  const preflights = await recentPreflights(String(ctx.organizationId));

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">safety triad · composed pre-flight</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Pre-flight an action
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Runs your proposed action through all three safety engineers in parallel —
          policy_gate, boundary_gate, approver — and returns a composed verdict
          (allow / review / block). Each engineer also persists its own packet for trace.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/safety-preflight/run" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">title</label>
            <input id="title" name="title" required maxLength={200} defaultValue={prefill.title} placeholder="e.g. Apply Phase 4 schema migration"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="actionDescription" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">action description</label>
            <textarea id="actionDescription" name="actionDescription" required rows={5} maxLength={6000} defaultValue={prefill.actionDescription} placeholder={"What action do you want pre-flighted?"}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="currentState" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">current state</label>
            <textarea id="currentState" name="currentState" required rows={4} maxLength={6000} defaultValue={prefill.currentState} placeholder={"What state will the action run against? Topology, scope, dependencies."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="riskContext" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">risk context</label>
            <textarea id="riskContext" name="riskContext" required rows={4} maxLength={6000} defaultValue={prefill.riskContext} placeholder={"What could go wrong? Blast radius, irreversibility, mitigations."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="tenantCharter" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">tenant charter (optional — enables policy_gate)</label>
            <textarea id="tenantCharter" name="tenantCharter" rows={5} maxLength={6000} defaultValue={prefill.tenantCharter} placeholder={"Paste the operator-signed scope document. If empty, the pre-flight skips policy_gate and defaults the composed verdict to \"review\"."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500">3 metered AI calls in parallel · billable usage · same pipeline as every engineer.</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              run pre-flight →
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">composed verdicts</p>
        <ul className="space-y-2 text-[13px] text-zinc-300 leading-relaxed">
          <li><span className="text-emerald-300 font-mono">allow</span> — all three engineers cleared the action. Safe to auto-advance without further human review.</li>
          <li><span className="text-amber-300 font-mono">review</span> — at least one engineer flagged caution but no hard refusal. Surface the packet to the operator.</li>
          <li><span className="text-rose-300 font-mono">block</span> — policy refuses, boundary tier is platform/catastrophic, or approver rejects. Never auto-advance.</li>
        </ul>
        <p className="text-[11px] text-zinc-500 mt-4 leading-snug">
          Each engineer also persists its own packet under
          <span className="text-zinc-400 font-mono"> &lt;preflightSlug&gt;__policy</span>,
          <span className="text-zinc-400 font-mono"> __boundary</span>, and
          <span className="text-zinc-400 font-mono"> __approver</span>
          so the composed verdict is fully traceable in AGI memory.
        </p>
      </section>

      {preflights.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No pre-flights run yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Submit the form above to run the first one.</p>
        </div>
      ) : (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recent pre-flights · {preflights.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {preflights.map((p) => (
              <li key={p.preflightSlug}>
                <Link
                  href={`/dashboard/agi-memory/${encodeURIComponent(`engineer_approval_packet:${p.preflightSlug}`)}`}
                  className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {p.decision && (<span className={DECISION_TONE[p.decision] ?? "text-zinc-400"}>{p.decision}</span>)}
                    <span className="text-zinc-500 ml-auto">{p.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                  </div>
                  <p className="text-[14px] font-medium text-white">{p.title}</p>
                  <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{p.narrative}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
