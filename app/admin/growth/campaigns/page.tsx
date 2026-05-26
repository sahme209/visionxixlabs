/**
 * /admin/growth/campaigns — campaign list + per-campaign draft counts.
 *
 * Scaffold: lists every GrowthCampaign row with status, theme, and the
 * count of LinkedInPostDraft rows attached. Creating campaigns happens
 * via /api/admin/growth/campaigns (POST — wired below as a tiny form).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MegaphoneIcon, ArrowRightIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Campaigns · VisionXIXLabs internal",
  description: "Internal growth campaigns + post allocation.",
};

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.growthCampaign.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { drafts: true } } },
  }).catch(() => [] as never[]);

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
            <MegaphoneIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Growth campaigns</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Weekly themes, grouped posts.
          </h1>
          <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
            Each campaign is a topic theme + date window. Drafts can be attached so the calendar and analytics roll up per-campaign.
          </p>
        </div>
        <form action="/api/admin/growth/campaigns" method="post" className="flex flex-wrap items-center gap-2">
          <input name="name" placeholder="Campaign name" required className="text-[11px] bg-transparent border border-white/[0.10] rounded px-2 py-1 text-zinc-200 w-48" />
          <input name="theme" placeholder="theme (e.g. product_education)" defaultValue="product_education" className="text-[11px] bg-transparent border border-white/[0.10] rounded px-2 py-1 text-zinc-200 w-56" />
          <input type="date" name="startsAt" required className="text-[11px] bg-transparent border border-white/[0.10] rounded px-2 py-1 text-zinc-200" />
          <input type="date" name="endsAt" required className="text-[11px] bg-transparent border border-white/[0.10] rounded px-2 py-1 text-zinc-200" />
          <button className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25">
            Create campaign
          </button>
        </form>
      </div>

      {campaigns.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-[14px] font-semibold text-white mb-1">No campaigns yet</p>
          <p className="text-[12px] text-zinc-400 max-w-md mx-auto">Use the form above to create the first campaign theme. Generated drafts can then be attached via the API or post-drafts editor.</p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {campaigns.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <header className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[13px] font-semibold text-white truncate">{c.name}</p>
                <span className="text-[9.5px] font-mono uppercase tracking-wider text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-full px-1.5 py-px">
                  {c.status}
                </span>
              </header>
              <p className="text-[11px] text-zinc-400 mb-2">Theme · <span className="font-mono text-zinc-300">{c.theme}</span></p>
              <p className="text-[11px] text-zinc-400 mb-2 inline-flex items-center gap-1">
                <CalendarDaysIcon className="h-3 w-3" />
                {c.startsAt.toISOString().slice(0, 10)} → {c.endsAt.toISOString().slice(0, 10)}
              </p>
              <p className="text-[11px] text-zinc-400">{c._count.drafts} draft{c._count.drafts === 1 ? "" : "s"} attached</p>
              {c.hypothesis && <p className="text-[11.5px] text-zinc-300 mt-2 leading-snug">{c.hypothesis}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
