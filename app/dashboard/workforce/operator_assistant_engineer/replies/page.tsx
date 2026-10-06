/** /dashboard/workforce/operator_assistant_engineer/replies — Phase 607. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { OPERATOR_ASSISTANT_TARGET_KIND } from "@/lib/workforce/domains/operatorAssistantEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-zinc-300",
  error: "text-rose-300",
};

const INTENT_TONE: Record<string, string> = {
  question: "text-sky-300",
  proposal_request: "text-emerald-300",
  investigation: "text-zinc-300",
  small_talk: "text-zinc-400",
};

export default async function OperatorAssistantRepliesPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/operator_assistant_engineer/replies");
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: { organizationId: String(ctx.organizationId), targetKind: OPERATOR_ASSISTANT_TARGET_KIND },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { targetId: true, narrative: true, outcome: true, modelHint: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => []);

  const decoded = rows.map((r) => {
    let title = r.targetId;
    let intent: string | null = null;
    let confidence: number | null = null;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("intent|")) intent = e.slice("intent|".length);
        else if (e.startsWith("confidence|")) {
          const v = Number(e.slice("confidence|".length));
          if (Number.isFinite(v)) confidence = v;
        }
      }
    }
    return { targetId: r.targetId, title, intent, confidence, narrative: r.narrative, outcome: r.outcome, modelHint: r.modelHint, updatedAt: r.updatedAt };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce/operator_assistant_engineer" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Operator Assistant
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">replies · operator copilot</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Ask the operator copilot
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          The chat-style entry point into the workforce. Ask a question, request a proposal, or
          explore symptoms. The copilot routes you to the right specialty engineers and stages a
          proposal when you ask for one.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/operator_assistant_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">conversation title</label>
            <input id="title" name="title" required maxLength={200} placeholder="e.g. Question about audit-trail retention"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="prompt" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">prompt</label>
            <textarea id="prompt" name="prompt" required rows={6} maxLength={4000} placeholder={"Ask anything. Examples: \"How do I retire an engineer?\", \"Stage a proposal to migrate to gpt-4o-mini for noise-classification\", \"Why did the checkout latency spike yesterday?\""}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="workspaceContext" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">workspace context (optional)</label>
            <input id="workspaceContext" name="workspaceContext" maxLength={1200} placeholder="e.g. read-heavy postgres workspace, 12 engineers active"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="conversationHistory" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">conversation history (optional)</label>
            <textarea id="conversationHistory" name="conversationHistory" rows={4} maxLength={4000} placeholder={"Paste prior turns of the conversation if you're continuing one."}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500">Metered AI · billable usage · same pipeline as every engineer.</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              ask the copilot →
            </button>
          </div>
        </form>
      </section>

      {decoded.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No copilot replies yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Submit the form above to ask the first one.</p>
        </div>
      ) : (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recent replies · {decoded.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((d) => (
              <li key={d.targetId}>
                <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${OPERATOR_ASSISTANT_TARGET_KIND}:${d.targetId}`)}`} className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {d.intent && (<span className={INTENT_TONE[d.intent] ?? "text-zinc-400"}>{d.intent.replace(/_/g, " ")}</span>)}
                    <span className="text-zinc-500">·</span>
                    <span className={OUTCOME_TONE[d.outcome] ?? "text-zinc-400"}>{d.outcome.replace(/_/g, " ")}</span>
                    {d.confidence !== null && (<><span className="text-zinc-500">·</span><span className="text-emerald-300">{d.confidence}%</span></>)}
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
