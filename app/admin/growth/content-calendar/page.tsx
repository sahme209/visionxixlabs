/**
 * /admin/growth/content-calendar — week-view of LinkedIn drafts.
 *
 * Server-rendered. Picks the next 7 days (incl. today) and buckets each
 * scheduled draft into its day. Surfaces gaps — days with no scheduled
 * post yet — so the operator can see at a glance where to fill in.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ArrowRightIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Content calendar · VisionXIXLabs internal",
  description: "7-day LinkedIn posting calendar.",
};

export const dynamic = "force-dynamic";

interface DayBucket {
  isoDate: string;       // YYYY-MM-DD
  label: string;         // "Mon May 26"
  scheduled: Array<{ id: string; hook: string; scheduledFor: Date; status: string }>;
  published:  Array<{ id: string; hook: string; publishedAt: Date | null; linkedinPostUrl: string | null }>;
}

export default async function ContentCalendarPage() {
  const days = nextNDays(7);
  const start = new Date(`${days[0].isoDate}T00:00:00.000Z`);
  const end   = new Date(`${days[days.length - 1].isoDate}T23:59:59.999Z`);

  const [scheduled, published] = await Promise.all([
    prisma.linkedInPostDraft.findMany({
      where: { status: "scheduled", scheduledFor: { gte: start, lte: end } },
      orderBy: { scheduledFor: "asc" },
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.linkedInPostDraft.findMany>>),
    prisma.linkedInPostDraft.findMany({
      where: { status: "published", publishedAt: { gte: start, lte: end } },
      orderBy: { publishedAt: "desc" },
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.linkedInPostDraft.findMany>>),
  ]);

  const byDay: Record<string, DayBucket> = Object.fromEntries(days.map((d) => [d.isoDate, { ...d, scheduled: [], published: [] }]));
  for (const d of scheduled) {
    if (!d.scheduledFor) continue;
    const key = d.scheduledFor.toISOString().slice(0, 10);
    byDay[key]?.scheduled.push({ id: d.id, hook: d.hook, scheduledFor: d.scheduledFor, status: d.status });
  }
  for (const d of published) {
    const at = d.publishedAt ?? d.updatedAt;
    const key = at.toISOString().slice(0, 10);
    byDay[key]?.published.push({ id: d.id, hook: d.hook, publishedAt: d.publishedAt, linkedinPostUrl: d.linkedinPostUrl });
  }

  const readyToReview = await prisma.linkedInPostDraft.count({
    where: { status: { in: ["drafted", "in_review"] } },
  }).catch(() => 0);

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
          <CalendarDaysIcon className="h-4 w-4 text-cyan-400" />
          <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">Content calendar · 7 days</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          The week ahead.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Approved + scheduled LinkedIn posts grouped by day. Empty cells flag gaps to fill — head to{" "}
          <Link href="/admin/growth/post-drafts" className="text-cyan-300 hover:text-cyan-200">post-drafts</Link>{" "}
          to schedule. {readyToReview > 0 && <> · {readyToReview} draft{readyToReview === 1 ? "" : "s"} awaiting approval.</>}
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((day) => {
          const bucket = byDay[day.isoDate];
          const totalCount = (bucket?.scheduled.length ?? 0) + (bucket?.published.length ?? 0);
          return (
            <li
              key={day.isoDate}
              className={`rounded-2xl border p-3 ${
                totalCount === 0
                  ? "border-white/15 bg-white/[0.03]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <header className="mb-2">
                <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-400">{day.label}</p>
              </header>
              {totalCount === 0 ? (
                <Link
                  href="/admin/growth/post-drafts"
                  className="inline-flex items-center gap-1 text-[10.5px] text-zinc-200 hover:text-zinc-100"
                >
                  <PlusCircleIcon className="h-3.5 w-3.5" />
                  Gap — schedule a post
                </Link>
              ) : (
                <ul className="space-y-1.5">
                  {bucket?.published.map((p) => (
                    <li key={p.id} className="text-[10.5px]">
                      <span className="text-emerald-300/90 font-mono mr-1">PUB</span>
                      {p.linkedinPostUrl
                        ? <a href={p.linkedinPostUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-100 hover:underline">{p.hook.slice(0, 60)}</a>
                        : <span className="text-emerald-100">{p.hook.slice(0, 60)}</span>}
                    </li>
                  ))}
                  {bucket?.scheduled.map((s) => (
                    <li key={s.id} className="text-[10.5px]">
                      <span className="text-violet-300/90 font-mono mr-1">{s.scheduledFor.toISOString().slice(11, 16)}</span>
                      <Link href={`/admin/growth/post-drafts#${s.id}`} className="text-violet-100 hover:underline">
                        {s.hook.slice(0, 60)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function nextNDays(n: number): Array<{ isoDate: string; label: string }> {
  const out: Array<{ isoDate: string; label: string }> = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    const isoDate = d.toISOString().slice(0, 10);
    const label = `${dayNames[d.getUTCDay()]} ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
    out.push({ isoDate, label });
  }
  return out;
}
