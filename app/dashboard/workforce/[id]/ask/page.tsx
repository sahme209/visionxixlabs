/**
 * /dashboard/workforce/[id]/ask — Phase 564.
 *
 * Per-engineer Q&A thread. Server-rendered, no client JS. Operator
 * submits a question via a plain <form>, the POST handler persists
 * the answer, the page re-renders showing the new exchange at the
 * top of the thread.
 *
 * Past Q&A is read from AiRationaleEnrichment scoped to
 *   targetKind="engineer_qa"
 *   targetId starts with `<engineerId>:`
 *
 * — same model the Phase 557 specialty rationale uses, so the
 * existing AGI memory surfaces show Q&A entries automatically.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated:   "text-emerald-300",
  fallback_rules: "text-zinc-300",
  error:          "text-rose-300",
};

export default async function EngineerAskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") notFound();

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect(`/auth/signin?callbackUrl=/dashboard/workforce/${id}/ask`);
  }

  // Q&A rows for this engineer. The targetId prefix tactic — keying
  // on `<engineerId>:<timestamp>` — lets us scope cheaply with a
  // startsWith filter and order by generatedAt for the thread view.
  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: "engineer_qa",
      targetId: { startsWith: `${engineer.id}:` },
    },
    orderBy: { generatedAt: "desc" },
    take: 50,
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
  }>);

  const thread = rows.map((r) => {
    const question = Array.isArray(r.riskFactorsJson) && typeof r.riskFactorsJson[0] === "string"
      ? r.riskFactorsJson[0]
      : "";
    return {
      targetId: r.targetId,
      question,
      answer: r.narrative,
      outcome: r.outcome,
      modelHint: r.modelHint,
      errorMessage: r.errorMessage,
      generatedAt: r.generatedAt,
    };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href={`/dashboard/workforce/${id}`} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        {engineer.displayName}
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">ask · {engineer.id}</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-violet-300 shrink-0 self-center" />
          Ask {engineer.displayName}
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Submit a question; it&apos;s answered by Claude in this engineer&apos;s
          voice with your workspace as context. Every Q&amp;A persists as
          an AGI memory entry — recoverable via the permalink below.
        </p>
      </header>

      {/* Ask form */}
      <section className="mb-10 rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5">
        <form action={`/api/workforce/${engineer.id}/ask`} method="POST">
          <label htmlFor="question" className="text-[10px] font-mono uppercase tracking-[0.18em] text-violet-300 mb-2 block">
            your question
          </label>
          <textarea
            id="question"
            name="question"
            required
            rows={3}
            maxLength={1500}
            placeholder="e.g. What would you do about the consecutive blocks on apply_terraform today?"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 transition-colors resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono text-zinc-500">1500 char max · plain prose answer</p>
            <button
              type="submit"
              className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-violet-500/30 text-violet-100 hover:text-white hover:border-violet-500/60 hover:bg-violet-500/15 transition-colors"
            >
              ask
            </button>
          </div>
        </form>
      </section>

      {/* Thread */}
      {thread.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No questions yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Ask above — your conversation with {engineer.displayName} will appear here.</p>
        </div>
      ) : (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">thread · {thread.length}</p>
            <a
              href={`/api/workforce/${engineer.id}/qa.csv`}
              download
              className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
              title="Download up to 5000 Q&A rows as CSV"
            >
              download .csv
            </a>
          </div>
          <ul className="space-y-3">
            {thread.map((t) => (
              <li key={t.targetId} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className={OUTCOME_TONE[t.outcome] ?? "text-zinc-400"}>{t.outcome.replace(/_/g, " ")}</span>
                    {t.modelHint && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{t.modelHint}</span>
                      </>
                    )}
                  </div>
                  <span className="text-zinc-500">{t.generatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                </div>
                {t.question && (
                  <div className="mb-3">
                    <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">you</p>
                    <p className="text-[13px] text-zinc-100 leading-relaxed whitespace-pre-line">{t.question}</p>
                  </div>
                )}
                <div>
                  <p className="text-[9.5px] font-mono uppercase tracking-wider text-violet-300 mb-1">{engineer.displayName}</p>
                  <p className="text-[13.5px] text-zinc-100 leading-relaxed whitespace-pre-line">{t.answer}</p>
                </div>
                {t.errorMessage && (
                  <p className="mt-2 text-[10.5px] font-mono text-rose-300/80">↳ {t.errorMessage}</p>
                )}
                <Link
                  href={`/dashboard/agi-memory/${encodeURIComponent(`engineer_qa:${t.targetId}`)}`}
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                >
                  permalink →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
