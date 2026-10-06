/**
 * /admin/growth/content — daily content planner.
 *
 * Internal-only. Renders sample LinkedIn + X drafts for review and
 * routing to the approval queue. Drafts come from
 * lib/growth/contentPlanner.ts which uses Claude when the API key is
 * set and falls back to deterministic placeholders otherwise.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  PencilSquareIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { planContent } from "@/lib/growth/contentPlanner";
import type { SocialPostDraft } from "@/lib/growth/growthModels";

export const metadata: Metadata = {
  title: "Content planner · VisionXIXLabs internal",
  description: "Daily LinkedIn + X drafts. Approval-gated.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ContentPlannerPage() {
  const [linkedinResult, xResult] = await Promise.all([
    planContent({ channel: "linkedin", category: "product_education", maxDrafts: 2 }),
    planContent({ channel: "x",        category: "thought_leadership", maxDrafts: 2 }),
  ]);

  const allDrafts: SocialPostDraft[] = [...linkedinResult.drafts, ...xResult.drafts];
  const llmActive = linkedinResult.usedLlm || xResult.usedLlm;

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/admin/growth" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Growth
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <PencilSquareIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Daily content planner</p>
          <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px ${
            llmActive
              ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
              : "text-zinc-300 bg-white/10 border-white/30"
          }`}>
            {llmActive ? "Claude active" : "Placeholder · set ANTHROPIC_API_KEY"}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Today's drafts.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          {allDrafts.length} drafts ready for review. Edit inline, approve, schedule, or send back for revision. Nothing posts externally until the approval queue says go.
        </p>
      </div>

      {/* Drafts list */}
      <div className="space-y-4 mb-8">
        {allDrafts.map((d) => (
          <DraftCard key={d.id} draft={d} />
        ))}
      </div>

      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Why nothing autoposts</p>
        </header>
        <p className="text-[12px] text-zinc-300 leading-relaxed">
          Drafts move from <span className="font-mono text-emerald-200">drafted</span> → <span className="font-mono text-emerald-200">in_review</span> → <span className="font-mono text-emerald-200">approved</span> →
          <span className="font-mono text-emerald-200"> scheduled</span> → <span className="font-mono text-emerald-200">published</span>. Each transition is audit-logged. The publishing step requires a logged-in admin to click "Approve" in the queue — no agent has the credential to post on its own.
        </p>
      </section>
    </div>
  );
}

function DraftCard({ draft }: { draft: SocialPostDraft }) {
  const channelLabel = draft.channel === "linkedin" ? "LinkedIn" : draft.channel === "x" ? "X / Twitter" : draft.channel;
  return (
    <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <header className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px text-violet-300 bg-violet-500/10 border-violet-500/30">
            {channelLabel}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">draft · {draft.id.slice(0, 20)}</span>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-300 bg-white/10 border border-white/30 rounded-full px-1.5 py-px">
          {draft.status}
        </span>
      </header>

      <div className="px-5 py-3">
        <pre className="whitespace-pre-wrap text-[13px] text-zinc-100 leading-relaxed font-sans">{draft.body}</pre>
        {draft.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {draft.hashtags.map((tag) => (
              <span key={tag} className="text-[10.5px] font-mono text-violet-300/90 bg-violet-500/10 border border-violet-500/20 rounded-full px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
        {draft.cta && (
          <p className="mt-3 text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-200">CTA:</span> {draft.cta}
          </p>
        )}
      </div>

      <footer className="px-5 py-3 bg-white/[0.01] border-t border-white/[0.04] flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-500">drafted by {draft.draftedByAgent}</span>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 disabled:opacity-60"
            title="Send to approval queue — wiring lands in next phase."
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Send to approval
          </button>
          <button
            disabled
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-200 border border-white/[0.08] disabled:opacity-60"
            title="Inline editor lands in next phase."
          >
            Edit
          </button>
          <button
            disabled
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 disabled:opacity-60"
            title="Reject + ask for revision."
          >
            Reject
          </button>
        </div>
      </footer>
    </article>
  );
}
