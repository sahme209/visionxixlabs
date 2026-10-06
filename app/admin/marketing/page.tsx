/**
 * /admin/marketing — VisionXIXLabs INTERNAL marketing cockpit.
 *
 * This surface is for the VisionXIXLabs operator team only. It runs
 * the company's own LinkedIn / X content pipeline — it is NOT shown
 * to client tenants. Access is gated by isAdminEmail() in the parent
 * /admin layout.
 *
 * Drafts queue + approval gate + schedule preview + outbound history.
 * Pure server component. Live publishing (LinkedIn / X) is staged via
 * the approval engine in a follow-up — this page only previews what
 * WOULD be posted and at what schedule.
 *
 * Layer separation: a client business signed into /dashboard/* never
 * sees this. They get their own client-scoped surfaces — none of
 * which include outbound social posting on behalf of VisionXIXLabs.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  ClockIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import {
  draftMarketingPosts,
  type MarketingEvent,
  type SocialDraft,
  type RiskTier,
} from "@/lib/agents/marketingContentDrafter";
import {
  schedulePosts,
  DEFAULT_POLICY,
  type ScheduleRequestItem,
} from "@/lib/agents/socialPostScheduler";
import { buildLinkedInPost } from "@/lib/connectors/linkedin/linkedinPostBuilder";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { PlatformHero } from "@/components/platform/PlatformHero";

export const metadata: Metadata = {
  title: "VisionXIXLabs marketing · Admin",
  description:
    "Internal-only cockpit for VisionXIXLabs operator team. Drafts LinkedIn / X content for the company's own channels with risk-tier review + approval gating. Not exposed to client tenants.",
  robots: { index: false, follow: false },
};

const RISK_TONE: Record<RiskTier, string> = {
  low:      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium:   "border-white/30   bg-white/10   text-zinc-300",
  high:     "border-rose-500/30    bg-rose-500/10    text-rose-300",
  critical: "border-rose-500/40    bg-rose-500/15    text-rose-200",
};

// Seed events so the cockpit always has something to preview against.
const SEED_EVENTS: readonly MarketingEvent[] = [
  {
    kind: "phase_shipped",
    summary: "Phase 301–307 shipped — AGI marketing operations + desktop script catalog.",
    facts: [
      "Two new agent kernels: marketingContentDrafter + socialPostScheduler.",
      "Typed LinkedIn UGC post builder with OAuth scope guardrails.",
      "Desktop script catalog wired for macOS / Windows / Linux runtimes.",
    ],
    references: ["lib/agents/marketingContentDrafter", "lib/agents/socialPostScheduler", "lib/connectors/linkedin/linkedinPostBuilder"],
  },
  {
    kind: "feature_launch",
    summary: "Public /capabilities surface now lists every shipped agent kernel.",
    facts: [
      "15 agent kernels grouped by role.",
      "Each card links to the lib/agents/* file that implements it.",
    ],
  },
  {
    kind: "thought_leadership",
    summary: "Approval-only-no-execution: the only safe shape for AGI IT operations.",
    facts: [
      "Every action is staged as an approval packet.",
      "Every decision writes a sha-256 rationale row.",
    ],
  },
];

export default function MarketingPage() {
  // Generate drafts for every seed event × both default channels.
  const allDrafts: SocialDraft[] = [];
  for (const event of SEED_EVENTS) {
    const r = draftMarketingPosts(event, ["linkedin", "x"]);
    for (const d of r.drafts) allDrafts.push(d);
  }

  // Mock approval state: first 2 approved, rest pending — gives the
  // scheduler something to chew on so the schedule preview renders.
  const now = new Date();
  const items: ScheduleRequestItem[] = allDrafts.map((d, i) => ({
    draft: d,
    approval: i < 2 ? { state: "approved", approvedAt: now } : { state: "pending" },
    desiredPublishAt: new Date(now.getTime() + i * 30 * 60 * 1000),
  }));

  const { plan, summary } = schedulePosts(items, [], DEFAULT_POLICY, now);

  // Build a sample LinkedIn payload from the first linkedin draft so
  // the operator can preview the actual bytes that would POST.
  const firstLinkedin = allDrafts.find((d) => d.channel === "linkedin");
  const linkedinPreview = firstLinkedin
    ? buildLinkedInPost(firstLinkedin, { kind: "organization", urn: "urn:li:organization:visionxixlabs" })
    : null;

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="visionxixlabs admin · internal marketing"
        eyebrowTone="fuchsia"
        title="VisionXIXLabs marketing"
        description="Internal cockpit for the VisionXIXLabs operator team. Agent kernels draft posts for OUR LinkedIn / X channels, classify risk, and stage for approval. Not visible to client tenants. Nothing goes out without an operator signature."
        gradientFromColor="radial-gradient(900px 320px at 14% 0%, rgba(217,70,239,0.10), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(99,102,241,0.08), transparent 60%)"
        right={
          <>
            <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 px-2.5 py-1 text-[11px] font-mono">
              {allDrafts.length} drafts
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px] font-mono">
              {summary.ready} ready
            </span>
            <span className="rounded-full border border-white/30 bg-white/10 text-zinc-300 px-2.5 py-1 text-[11px] font-mono">
              {summary.needs_approval} awaiting approval
            </span>
            <DemoBadge />
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Drafts"          value={allDrafts.length} />
        <Stat label="Ready"           value={summary.ready} sub="approved + within caps" />
        <Stat label="Awaiting approval" value={summary.needs_approval} />
        <Stat label="Blocked"         value={summary.blocked} sub="rejected or dual-approval required" />
        <Stat label="Channels live"   value={2} sub="LinkedIn + X · blog scoped" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Drafts queue — 2 cols */}
        <section className="lg:col-span-2 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
          <header className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
              Drafts queue
              <DemoBadge />
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              {allDrafts.length} entries
            </span>
          </header>

          <ul className="space-y-2.5">
            {allDrafts.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest mb-1">
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300">
                        {d.channel}
                      </span>
                      <span className={["rounded-full px-2 py-0.5 border whitespace-nowrap", RISK_TONE[d.riskTier]].join(" ")}>
                        risk · {d.riskTier}
                      </span>
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-300 whitespace-nowrap">
                        gate · {d.recommendedGate.replace("_", " ")}
                      </span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-400">
                        {d.charCount} chars
                      </span>
                    </div>
                    <p className="text-[12.5px] text-white leading-relaxed whitespace-pre-wrap">
                      {d.body}
                    </p>
                    {d.hashtags.length > 0 ? (
                      <p className="mt-2 text-[11px] font-mono text-fuchsia-300/80">
                        {d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10.5px] text-zinc-500 italic">
                      Why this risk: {d.riskReasons[0]}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Schedule + LinkedIn preview */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
            <header className="flex items-center gap-2 mb-3">
              <ClockIcon className="h-4 w-4 text-zinc-400" />
              <h2 className="text-[13px] font-semibold text-zinc-200">Schedule preview</h2>
              <DemoBadge />
            </header>
            <ul className="space-y-2">
              {plan.slice(0, 6).map((p) => (
                <li key={p.draftId} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-[11.5px] text-white font-medium">{p.channel}</p>
                    <span className={[
                      "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap",
                      p.verdict === "ready"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : p.verdict === "needs_approval"
                          ? "border-white/30 bg-white/10 text-zinc-300"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                    ].join(" ")}>
                      {p.verdict.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] font-mono text-zinc-500">
                    {p.publishAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{p.rationale}</p>
                </li>
              ))}
            </ul>
          </section>

          {linkedinPreview?.ok ? (
            <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 md:p-5">
              <header className="flex items-center gap-2 mb-2">
                <RocketLaunchIcon className="h-4 w-4 text-cyan-300" />
                <h2 className="text-[13px] font-semibold text-cyan-100">LinkedIn payload preview</h2>
              </header>
              <p className="text-[10.5px] font-mono uppercase tracking-widest text-cyan-300/80 mb-2">
                exact bytes that would POST
              </p>
              <pre className="text-[10.5px] text-cyan-100 leading-snug overflow-x-auto whitespace-pre-wrap font-mono">
{JSON.stringify(linkedinPreview.payload, null, 2)}
              </pre>
              <p className="mt-2 text-[10.5px] font-mono text-cyan-300/80">
                required scopes: {linkedinPreview.requiredScopes.join(", ")}
              </p>
            </section>
          ) : null}
        </aside>
      </div>

      {/* Safety contract */}
      <section className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <h2 className="text-[13px] font-semibold text-emerald-100">Marketing safety contract</h2>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>No outbound post is published without an operator-signed approval packet.</li>
          <li>Customer-name mentions auto-tier to <span className="font-mono">high</span> + dual approval.</li>
          <li>Incident mentions auto-tier to <span className="font-mono">critical</span> + dual approval.</li>
          <li>Per-channel daily caps + minimum gaps + UTC blackout windows enforced by <span className="font-mono">socialPostScheduler</span>.</li>
          <li>72-hour dedup window prevents the same body re-shipping.</li>
          <li>Every send writes a <span className="font-mono">SecureAuditRecord</span> with the exact bytes that went to LinkedIn / X.</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/approvals"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/15 transition"
          >
            Approve drafts
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link
            href="/dashboard/audit"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Audit log
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link
            href="/dashboard/connectors"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            LinkedIn connector
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <p className="mt-8 text-[12px] text-zinc-500 max-w-3xl leading-relaxed">
        Drafts shown today are generated against three seeded events so the
        cockpit is never empty. Per-tenant drafts will appear here when the
        MarketingDraft Prisma model lands and an event source (changelog
        webhook, milestone trigger) feeds <span className="font-mono">marketingContentDrafter</span> live.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-[20px] font-semibold text-white tabular-nums">{value}</p>
      {sub ? <p className="text-[10.5px] text-zinc-500 mt-0.5">{sub}</p> : null}
    </div>
  );
}
