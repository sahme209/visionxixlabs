/**
 * /admin/growth — internal VisionXIXLabs marketing automation index.
 *
 * Admin-only (gated by /admin/layout.tsx via isAdminEmail). NEVER
 * surfaces inside the client SaaS portal. Index of every internal
 * marketing workflow with status + last-run summary.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  MegaphoneIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  ChartBarSquareIcon,
  UserGroupIcon,
  GlobeAltIcon,
  CommandLineIcon,
  ArrowRightIcon,
  SparklesIcon,
  CloudIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Growth automation · VisionXIXLabs internal",
  description:
    "Internal-only marketing automation cockpit — content planner, campaign calendar, approval queue, analytics. Never visible to clients.",
};

export const dynamic = "force-dynamic";

const WORKFLOWS: ReadonlyArray<{
  slug: string;
  name: string;
  cadence: string;
  description: string;
  icon: typeof MegaphoneIcon;
  tone: string;
  status: "live" | "scaffold" | "planned";
}> = [
  { slug: "linkedin",       name: "LinkedIn integration",        cadence: "On-demand + daily cron",  description: "Connect LinkedIn, review drafts, schedule + publish via the official OAuth + Posts API. Draft-only until you flip LINKEDIN_POSTING_ENABLED.", icon: CloudIcon,        tone: "text-violet-300",  status: "live" },
  { slug: "launch-kit",     name: "Launch kit",                  cadence: "Reference",               description: "Copy-paste brand kit — X.com bio + pinned tweet + first 12 daily posts + LICENSE/README content for the Axiom repo. Everything ready to paste.", icon: SparklesIcon,     tone: "text-rose-300",    status: "live" },
  { slug: "post-drafts",    name: "Post drafts",                 cadence: "Daily generation",        description: "Every persisted LinkedIn draft, grouped by status. Approve, schedule, or publish each one inline.", icon: PencilSquareIcon, tone: "text-violet-300", status: "live" },
  { slug: "content-calendar", name: "Content calendar",          cadence: "Rolling 7 days",          description: "Week view of scheduled + published posts. Highlights gaps where the week needs another post.",      icon: CalendarDaysIcon, tone: "text-cyan-300",   status: "live" },
  { slug: "campaigns",      name: "Campaigns",                   cadence: "Weekly themes",           description: "Group drafts under a named campaign + date window — used by analytics roll-ups.",                    icon: MegaphoneIcon,    tone: "text-cyan-300",   status: "live" },
  { slug: "content",        name: "Daily content planner",       cadence: "Every weekday 09:00 UTC", description: "Generates 3–5 post ideas + drafts a LinkedIn + X post per cycle. Always goes to approval queue.", icon: PencilSquareIcon,   tone: "text-violet-300",  status: "live" },
  { slug: "approval-queue", name: "Publishing approval queue",   cadence: "On-demand",               description: "Human review surface — approve / edit / reject every external publish before it goes live.",         icon: ShieldCheckIcon,     tone: "text-emerald-300", status: "live" },
  { slug: "outreach",       name: "Outreach drafter",            cadence: "Ad-hoc",                  description: "Drafts personalized email / LinkedIn DM outreach. Approval-gated; never auto-sent.",                  icon: UserGroupIcon,       tone: "text-fuchsia-300", status: "planned" },
  { slug: "leads",          name: "Lead research",               cadence: "Weekly",                  description: "Identifies target verticals + buyer personas, captures pain points + outreach angles.",                icon: UserGroupIcon,       tone: "text-zinc-300",   status: "planned" },
  { slug: "website-demo",   name: "Homepage demo sequence",      cadence: "Manual",                  description: "Authors the animated walkthrough on the public homepage. Edit the step-list, ship after review.",      icon: GlobeAltIcon,        tone: "text-violet-300",  status: "scaffold" },
  { slug: "analytics",      name: "Campaign performance",        cadence: "Daily",                   description: "Summarises post + campaign engagement. Recommends the next content strategy step.",                     icon: ChartBarSquareIcon,  tone: "text-cyan-300",    status: "planned" },
  { slug: "scripts",        name: "Python automation scripts",   cadence: "Cron",                    description: "Backend Python workers — content generation, LinkedIn API, X.com API, analytics ingest.",              icon: CommandLineIcon,     tone: "text-zinc-300",    status: "planned" },
];

const STATUS_DISPLAY: Record<"live" | "scaffold" | "planned", string> = {
  live:     "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  scaffold: "text-cyan-300    bg-cyan-500/10    border-cyan-500/30",
  planned:  "text-zinc-400    bg-white/[0.04]   border-white/[0.10]",
};

export default function GrowthIndexPage() {
  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <MegaphoneIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Growth automation · internal</p>
          <span className="text-[9px] font-mono uppercase tracking-wider text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-full px-2 py-0.5">
            NOT visible to clients
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Our private AI marketing engine.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Drafts content, plans campaigns, prepares outreach, and ships homepage demo updates. Every external publish stays approval-gated until we explicitly opt into auto-posting.
        </p>
      </div>

      {/* Safety rail — most visible reminder */}
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 mb-8">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-rose-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">Hard rules</p>
        </header>
        <ul className="text-[12.5px] text-rose-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-rose-400/80">
          <li>Nothing publishes to LinkedIn / X / website / blog without explicit human approval.</li>
          <li>No outreach message sends without explicit human approval.</li>
          <li>Workflows draft; humans publish. Always.</li>
          <li>Every draft + approval + publish is audit-logged.</li>
          <li>This surface lives only at <span className="font-mono text-rose-200">/admin/growth/*</span> — never at <span className="font-mono text-rose-200">/dashboard/*</span>.</li>
        </ul>
      </section>

      {/* Workflow grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {WORKFLOWS.map((w) => {
          const Icon = w.icon;
          return (
            <article key={w.slug} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col">
              <header className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 ${w.tone} shrink-0`} />
                  <p className="text-[13px] font-semibold text-white truncate">{w.name}</p>
                </div>
                <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${STATUS_DISPLAY[w.status]}`}>{w.status}</span>
              </header>
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 mb-2">{w.cadence}</p>
              <p className="text-[11.5px] text-zinc-400 leading-snug mb-3 flex-1">{w.description}</p>
              <Link
                href={`/admin/growth/${w.slug}`}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-300 hover:text-violet-200 self-start"
              >
                Open
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5">
        <header className="flex items-center gap-2 mb-3">
          <SparklesIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Where this is going</p>
        </header>
        <ul className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {[
            ["Auto-post once explicitly enabled.", "Each channel gets a per-tenant policy switch with audit row + revoke."],
            ["Per-campaign performance loop.",     "Engagement metrics flow back into the planner to bias next content."],
            ["Lead research → outreach pipeline.", "Vertical → persona → angle → personalized draft → approval → send."],
            ["Auto-changelog social posts.",        "GitHub releases → LinkedIn + X drafts within minutes of a tag."],
          ].map(([q, a]) => (
            <li key={q} className="flex items-start gap-2">
              <ArrowRightIcon className="h-3 w-3 text-violet-400 shrink-0 mt-1" />
              <span><span className="font-semibold text-zinc-100">{q}</span> <span className="text-zinc-400">— {a}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
