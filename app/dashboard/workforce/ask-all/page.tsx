/**
 * /dashboard/workforce/ask-all — Phase 570.
 *
 * Single-question survey across every client engineer. Operators
 * submit a question; the POST handler runs each engineer's AGI flow
 * sequentially and persists one engineer_qa row per engineer keyed
 * to a shared sweep correlation id. This page renders the unified
 * collective response.
 *
 * ?sweep=<correlation> shows just that sweep. Without it, the page
 * shows the most-recent sweep for the workspace (most useful default
 * after a fresh redirect).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated:   "text-emerald-300",
  fallback_rules: "text-amber-300",
  error:          "text-rose-300",
};

export default async function AskAllPage({
  searchParams,
}: {
  searchParams: Promise<{ sweep?: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/ask-all");
  }
  const sp = await searchParams;
  const org = String(ctx.organizationId);

  let sweepId = sp.sweep ?? "";

  // If no sweep specified, find the most-recent askall sweep in the
  // workspace by sampling the latest engineer_qa rows that match the
  // suffix pattern. Honest empty when none exist.
  if (!sweepId) {
    const latest = await prisma.aiRationaleEnrichment.findFirst({
      where: {
        organizationId: org,
        targetKind: "engineer_qa",
        targetId: { contains: ":askall_" },
      },
      orderBy: { generatedAt: "desc" },
      select: { targetId: true },
    }).catch(() => null);
    if (latest?.targetId) {
      const colon = latest.targetId.indexOf(":");
      sweepId = colon === -1 ? "" : latest.targetId.slice(colon + 1);
    }
  }

  // Pull every row for this sweep. The targetId pattern is
  // `<engineerId>:<sweepCorrelation>` so a suffix match gets them all.
  const sweepRows = sweepId
    ? await prisma.aiRationaleEnrichment.findMany({
        where: {
          organizationId: org,
          targetKind: "engineer_qa",
          targetId: { endsWith: `:${sweepId}` },
        },
        orderBy: { generatedAt: "asc" },
        select: {
          targetId: true,
          narrative: true,
          riskFactorsJson: true,
          outcome: true,
          modelHint: true,
          errorMessage: true,
          generatedAt: true,
        },
      }).catch(() => [] as Array<{
        targetId: string;
        narrative: string;
        riskFactorsJson: unknown;
        outcome: string;
        modelHint: string | null;
        errorMessage: string | null;
        generatedAt: Date;
      }>)
    : [];

  const engineerLookup = new Map(AGENT_WORKFORCE_REGISTRY.map((e) => [e.id, e]));

  // The same question rides on every row's riskFactorsJson[0]; pick the
  // first one we see.
  const question = (() => {
    for (const r of sweepRows) {
      if (Array.isArray(r.riskFactorsJson) && typeof r.riskFactorsJson[0] === "string") {
        return r.riskFactorsJson[0];
      }
    }
    return "";
  })();

  const responses = sweepRows.map((r) => {
    const colon = r.targetId.indexOf(":");
    const engineerId = colon === -1 ? r.targetId : r.targetId.slice(0, colon);
    return {
      engineer: engineerLookup.get(engineerId),
      engineerId,
      answer: r.narrative,
      outcome: r.outcome,
      modelHint: r.modelHint,
      errorMessage: r.errorMessage,
      generatedAt: r.generatedAt,
    };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">ask · all engineers</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-violet-300 shrink-0 self-center" />
          Ask the whole workforce
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Submit one question; every client engineer answers in turn. Each
          response persists as a normal Q&amp;A row, so per-engineer ask
          threads pick up these exchanges too.
        </p>
      </header>

      {/* Ask form */}
      <section className="mb-10 rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5">
        <form action="/api/workforce/ask-all" method="POST">
          <label htmlFor="question" className="text-[10px] font-mono uppercase tracking-[0.18em] text-violet-300 mb-2 block">
            your question to the workforce
          </label>
          <textarea
            id="question"
            name="question"
            required
            rows={3}
            maxLength={1500}
            placeholder="e.g. What's the single most important thing you'd improve about this workspace this week?"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 transition-colors resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono text-zinc-500">sequential sweep · ~30s per engineer · bounded 270s</p>
            <button
              type="submit"
              className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-violet-500/30 text-violet-100 hover:text-white hover:border-violet-500/60 hover:bg-violet-500/15 transition-colors"
            >
              ask all
            </button>
          </div>
        </form>
      </section>

      {/* Collective response */}
      {responses.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No sweeps yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Ask above to get the first collective response from your workforce.</p>
        </div>
      ) : (
        <section>
          {question && (
            <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">the question</p>
              <p className="text-[14px] text-zinc-100 leading-relaxed whitespace-pre-line">{question}</p>
              {sweepId && (
                <p className="text-[10px] font-mono text-zinc-500 mt-3">sweep · {sweepId}</p>
              )}
            </div>
          )}
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">responses · {responses.length}</p>
          <ul className="space-y-3">
            {responses.map((r) => (
              <li key={r.engineerId} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.engineer ? (
                      <Link href={`/dashboard/workforce/${r.engineer.id}`} className="text-violet-300 hover:text-white transition-colors">
                        {r.engineer.displayName}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">{r.engineerId}</span>
                    )}
                    <span className="text-zinc-500">·</span>
                    <span className={OUTCOME_TONE[r.outcome] ?? "text-zinc-400"}>{r.outcome.replace(/_/g, " ")}</span>
                    {r.modelHint && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{r.modelHint}</span>
                      </>
                    )}
                  </div>
                  <span className="text-zinc-500">{r.generatedAt.toISOString().slice(11, 19)}</span>
                </div>
                <p className="text-[13px] text-zinc-100 leading-relaxed whitespace-pre-line">{r.answer}</p>
                {r.errorMessage && (
                  <p className="mt-2 text-[10.5px] font-mono text-rose-300/80">↳ {r.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
