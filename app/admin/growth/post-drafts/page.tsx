/**
 * /admin/growth/post-drafts — full list of persisted LinkedIn drafts.
 *
 * Server-rendered list of LinkedInPostDraft rows grouped by status.
 * Each row exposes Approve / Reject / Schedule / Publish forms that hit
 * /api/admin/growth/drafts/[id]/... endpoints. No client JS required.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  PencilSquareIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarDaysIcon,
  CloudIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";
import { isPostingEnabled, isLinkedInConfigured } from "@/lib/growth/linkedin/oauth";

export const metadata: Metadata = {
  title: "LinkedIn drafts · VisionXIXLabs internal",
  description: "Persisted LinkedIn drafts with approval / schedule / publish controls.",
};

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["drafted", "in_review", "approved", "scheduled", "failed", "needs_revision", "published", "rejected"] as const;

export default async function PostDraftsPage() {
  const drafts = await prisma.linkedInPostDraft.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  }).catch(() => [] as Awaited<ReturnType<typeof prisma.linkedInPostDraft.findMany>>);

  const grouped = groupBy(drafts, (d) => d.status);
  const postingEnabled = isPostingEnabled();
  const connectionConfigured = isLinkedInConfigured();
  const connection = await prisma.linkedInAccountConnection.findFirst({
    where: { status: "connected" },
  }).catch(() => null);
  const canPublishNow = postingEnabled && connectionConfigured && Boolean(connection);

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/admin/growth" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Growth
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <PencilSquareIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">All LinkedIn drafts</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Review, approve, schedule, publish.
          </h1>
          <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
            {drafts.length} drafts in the store. Approval is required before scheduling. Posting is gated by env + a live LinkedIn connection.
          </p>
        </div>
        <form action="/api/admin/growth/drafts" method="post">
          <input type="hidden" name="category" value="product_education" />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25"
          >
            Generate 3 new drafts
          </button>
        </form>
      </div>

      {drafts.length === 0 && (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-[14px] font-semibold text-white mb-1">No drafts yet</p>
          <p className="text-[12px] text-zinc-400 max-w-md mx-auto">
            Click "Generate 3 new drafts" above, or wait for the daily cron at /api/cron/linkedin-daily-drafts.
          </p>
        </section>
      )}

      {STATUS_ORDER.filter((s) => grouped[s]?.length).map((status) => (
        <section key={status} className="mb-6">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">{status} · {grouped[status]?.length ?? 0}</h2>
          <ul className="space-y-3">
            {(grouped[status] ?? []).map((d) => (
              <DraftCard key={d.id} draft={d} canPublishNow={canPublishNow} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupBy<T, K extends string>(rows: T[], key: (t: T) => K): Partial<Record<K, T[]>> {
  const out: Partial<Record<K, T[]>> = {};
  for (const r of rows) {
    const k = key(r);
    (out[k] ??= []).push(r);
  }
  return out;
}

function DraftCard({ draft, canPublishNow }: {
  draft: {
    id: string; title: string; hook: string; body: string; cta: string | null; hashtags: string[];
    status: string; category: string; scheduledFor: Date | null; publishedAt: Date | null;
    linkedinPostUrl: string | null; linkedinPostUrn: string | null; createdByAgent: string;
  };
  canPublishNow: boolean;
}) {
  const fullText = [draft.hook, draft.body, draft.cta ?? "", draft.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")].filter(Boolean).join("\n\n");
  const isOpen = draft.status === "drafted" || draft.status === "in_review" || draft.status === "approved" || draft.status === "scheduled" || draft.status === "failed" || draft.status === "needs_revision";

  return (
    <li id={draft.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <header className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{draft.id.slice(0, 12)}</span>
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-violet-300/90 bg-violet-500/10 border border-violet-500/20 rounded-full px-1.5 py-px">
            {draft.category}
          </span>
          {draft.scheduledFor && (
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-400">
              scheduled · {draft.scheduledFor.toISOString().slice(0, 16).replace("T", " ")}
            </span>
          )}
        </div>
        <span className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-300">{draft.status}</span>
      </header>

      <div className="px-5 py-3">
        <pre className="whitespace-pre-wrap text-[13px] text-zinc-100 leading-relaxed font-sans">
{fullText}
        </pre>
      </div>

      {isOpen && (
        <footer className="px-5 py-3 bg-white/[0.01] border-t border-white/[0.04] flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10.5px] font-mono text-zinc-500">drafted by {draft.createdByAgent}</span>
          <div className="flex flex-wrap items-center gap-2">
            {draft.status !== "approved" && draft.status !== "scheduled" && draft.status !== "rejected" && (
              <TransitionForm draftId={draft.id} to="approved" label="Approve" icon={<CheckCircleIcon className="h-3.5 w-3.5" />} tone="emerald" />
            )}
            {draft.status === "approved" && (
              <ScheduleForm draftId={draft.id} />
            )}
            {(draft.status === "approved" || draft.status === "scheduled" || draft.status === "failed") && canPublishNow && (
              <form action={`/api/admin/growth/drafts/${draft.id}/publish`} method="post" className="inline">
                <button className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25">
                  <CloudIcon className="h-3.5 w-3.5" />
                  Publish now
                </button>
              </form>
            )}
            <a
              href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullText)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg bg-white/[0.04] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.08]"
            >
              Open LinkedIn
            </a>
            <TransitionForm draftId={draft.id} to="rejected" label="Reject" icon={<XCircleIcon className="h-3.5 w-3.5" />} tone="rose" needsReason />
          </div>
        </footer>
      )}

      {draft.linkedinPostUrl && (
        <footer className="px-5 py-2 border-t border-white/[0.04] text-[10.5px] text-emerald-300">
          Published → <a href={draft.linkedinPostUrl} target="_blank" rel="noopener noreferrer" className="underline">{draft.linkedinPostUrl}</a>
        </footer>
      )}
      {draft.linkedinPostUrn && !draft.linkedinPostUrl && (
        <footer className="px-5 py-2 border-t border-white/[0.04] text-[10.5px] text-emerald-300/80 font-mono">
          urn: {draft.linkedinPostUrn}
        </footer>
      )}
    </li>
  );
}

function TransitionForm({
  draftId, to, label, icon, tone, needsReason,
}: {
  draftId: string; to: string; label: string; icon: React.ReactNode;
  tone: "emerald" | "rose" | "violet"; needsReason?: boolean;
}) {
  const palette = tone === "emerald"
    ? "bg-emerald-500/15 text-emerald-100 border-emerald-500/30 hover:bg-emerald-500/25"
    : tone === "rose"
      ? "bg-rose-500/10 text-rose-200 border-rose-500/30 hover:bg-rose-500/20"
      : "bg-violet-500/15 text-violet-100 border-violet-500/30 hover:bg-violet-500/25";
  return (
    <form action={`/api/admin/growth/drafts/${draftId}/transition`} method="post" className="inline-flex items-center gap-1">
      <input type="hidden" name="to" value={to} />
      {needsReason && (
        <input
          name="rejectionReason"
          placeholder="reason"
          className="text-[10.5px] font-mono bg-transparent border border-white/[0.10] rounded px-1.5 py-0.5 text-zinc-200 w-24"
        />
      )}
      <button className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg border ${palette}`}>
        {icon} {label}
      </button>
    </form>
  );
}

function ScheduleForm({ draftId }: { draftId: string }) {
  return (
    <form action={`/api/admin/growth/drafts/${draftId}/transition`} method="post" className="inline-flex items-center gap-1">
      <input type="hidden" name="to" value="scheduled" />
      <input
        type="datetime-local"
        name="scheduledFor"
        className="text-[10.5px] font-mono bg-transparent border border-white/[0.10] rounded px-1.5 py-0.5 text-zinc-200"
      />
      <button className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-100 border border-cyan-500/30 hover:bg-cyan-500/25">
        <CalendarDaysIcon className="h-3.5 w-3.5" /> Schedule
      </button>
    </form>
  );
}
