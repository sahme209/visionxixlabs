/** /dashboard/workforce/safety-preflight — Phase 613. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";

export default async function SafetyPreflightPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/safety-preflight");
  }

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
            <input id="title" name="title" required maxLength={200} placeholder="e.g. Apply Phase 4 schema migration"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="actionDescription" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">action description</label>
            <textarea id="actionDescription" name="actionDescription" required rows={5} maxLength={6000} placeholder={"What action do you want pre-flighted?"}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="currentState" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">current state</label>
            <textarea id="currentState" name="currentState" required rows={4} maxLength={6000} placeholder={"What state will the action run against? Topology, scope, dependencies."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="riskContext" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">risk context</label>
            <textarea id="riskContext" name="riskContext" required rows={4} maxLength={6000} placeholder={"What could go wrong? Blast radius, irreversibility, mitigations."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="tenantCharter" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">tenant charter (optional — enables policy_gate)</label>
            <textarea id="tenantCharter" name="tenantCharter" rows={5} maxLength={6000} placeholder={"Paste the operator-signed scope document. If empty, the pre-flight skips policy_gate and defaults the composed verdict to \"review\"."}
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

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
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
    </div>
  );
}
