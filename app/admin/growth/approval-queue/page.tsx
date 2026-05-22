/**
 * /admin/growth/approval-queue — internal publishing approval queue.
 *
 * Lists every PublishingApproval awaiting decision. Today the queue
 * is empty — drafts get created above this in the content/campaigns
 * pages, then route here for approval. Approval actions wire to the
 * audit log + (eventually) the publish workers.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Approval queue · VisionXIXLabs internal",
  description: "Human approval before any external publish.",
};

export const dynamic = "force-dynamic";

export default function ApprovalQueuePage() {
  // Pending approvals would be loaded server-side here.
  // For now: empty state — drafts haven't been wired to a persistent
  // approval store. The UI contract is fixed.
  const pending: ReadonlyArray<{ id: string }> = [];

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
          <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Approval queue</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Human in the loop · always.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Social posts, outreach messages, blog posts, and website updates land here for explicit approval before anything goes live. Editable inline. Audit-logged. Revocable.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 mb-8">
        {pending.length === 0 ? (
          <div className="text-center">
            <ClockIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-white mb-1">Queue empty</p>
            <p className="text-[12px] text-zinc-400 max-w-md mx-auto">
              When drafts land here, you'll see one row per pending publish with: channel, target, body preview, requested-at timestamp, and Approve / Edit / Reject actions.
            </p>
            <Link
              href="/admin/growth/content"
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-100 border border-emerald-500/30 hover:bg-emerald-500/25"
            >
              Generate drafts
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <ul>{/* queue rows would render here */}</ul>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Approval rules</p>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>Two-step approval required for outreach + paid campaigns.</li>
          <li>Single approval for organic social + blog updates.</li>
          <li>Auto-expire approvals after 7 days if undecided — drafts go back to <span className="font-mono text-emerald-200">needs_revision</span>.</li>
          <li>Rejections require a free-text reason (the planner learns from it).</li>
          <li>Every decision writes a row to the growth audit log with the decider's email + timestamp.</li>
        </ul>
      </section>

      <section className="mt-6 grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <CheckCircleIcon className="h-4 w-4 text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-white">Approved · last 7 days</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <XCircleIcon className="h-4 w-4 text-rose-400 mb-2" />
          <p className="text-sm font-semibold text-white">Rejected · last 7 days</p>
          <p className="text-2xl font-bold text-white mt-1">0</p>
        </div>
      </section>
    </div>
  );
}
