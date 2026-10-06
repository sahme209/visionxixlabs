/**
 * /dashboard/workforce/spec_writer_engineer/specs — Phase 584.
 *
 * Dedicated surface for the Spec Writer Engineer. Different from
 * compliance_engineer's surface because spec writing needs operator
 * INPUT — a feature request — before the engineer can produce a
 * draft. This page handles that input loop:
 *
 *   1. Form at the top: title + problem statement + audience +
 *      constraints. Submits to /api/workforce/spec_writer_engineer/
 *      run-domain.
 *   2. List of previously-written specs (50 most-recent for the
 *      workspace, by updatedAt desc). Each row deep-links to its
 *      AGI memory permalink.
 *
 * Operator never has to leave this page to submit + browse. The
 * engineer detail page links here via the domain registry.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { SPEC_WRITER_TARGET_KIND } from "@/lib/workforce/domains/specWriterEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated:   "text-emerald-300",
  fallback_rules: "text-zinc-300",
  error:          "text-rose-300",
};

export default async function SpecWriterSpecsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/spec_writer_engineer/specs");
  }

  const specs = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: SPEC_WRITER_TARGET_KIND,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      targetId: true,
      narrative: true,
      outcome: true,
      modelHint: true,
      updatedAt: true,
      nextActionsJson: true,
    },
  }).catch(() => []);

  // Decode title from the first payload entry — persistWrittenSpec
  // unshifts a "title|<actual title>" record so we can reconstruct
  // the human label without storing it separately.
  const decoded = specs.map((s) => {
    let title = s.targetId;
    if (Array.isArray(s.nextActionsJson)) {
      for (const entry of s.nextActionsJson as unknown[]) {
        if (typeof entry === "string" && entry.startsWith("title|")) {
          title = entry.slice("title|".length);
          break;
        }
      }
    }
    return {
      targetId: s.targetId,
      title,
      narrative: s.narrative,
      outcome: s.outcome,
      modelHint: s.modelHint,
      updatedAt: s.updatedAt,
    };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce/spec_writer_engineer" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Spec Writer Engineer
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">specs · spec writer engineer</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Write a spec
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Submit a feature request; the Spec Writer Engineer turns it into a
          short technical spec — exec summary, user stories, acceptance criteria,
          out-of-scope, open questions. Every draft persists as an AGI memory
          entry you can share or revisit.
        </p>
      </header>

      {/* Input form */}
      <section className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/spec_writer_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">
              title
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={200}
              placeholder="e.g. Add CSV export to the engineer compliance report"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="problem" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">
              problem statement
            </label>
            <textarea
              id="problem"
              name="problem"
              required
              rows={4}
              maxLength={2000}
              placeholder="What's the problem? Who feels it? Why does it matter now?"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="audience" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">
                target audience (optional)
              </label>
              <input
                id="audience"
                name="audience"
                maxLength={400}
                placeholder="e.g. Workspace admins running quarterly audits"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="constraints" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">
                known constraints (optional)
              </label>
              <input
                id="constraints"
                name="constraints"
                maxLength={2000}
                placeholder="e.g. Must work without schema migration"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500">Same engineer-AGI pipeline as every other engineer — circuit breaker, AiCallLog, billable usage.</p>
            <button
              type="submit"
              className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors"
            >
              write the spec →
            </button>
          </div>
        </form>
      </section>

      {/* History */}
      {decoded.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No specs written yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">Submit the form above to draft your first spec.</p>
        </div>
      ) : (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">recent specs · {decoded.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((s) => (
              <li key={s.targetId}>
                <Link
                  href={`/dashboard/agi-memory/${encodeURIComponent(`${SPEC_WRITER_TARGET_KIND}:${s.targetId}`)}`}
                  className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    <span className={OUTCOME_TONE[s.outcome] ?? "text-zinc-400"}>{s.outcome.replace(/_/g, " ")}</span>
                    {s.modelHint && (
                      <>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{s.modelHint}</span>
                      </>
                    )}
                    <span className="text-zinc-500 ml-auto">{s.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                  </div>
                  <p className="text-[14px] font-medium text-white">{s.title}</p>
                  <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{s.narrative}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
