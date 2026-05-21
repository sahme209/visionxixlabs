/**
 * /dashboard/learning — agent learning events.
 *
 * What the agent kernels learned, when, from what source, and whether
 * the operator approved the proposed behaviour change. Learning that
 * isn't operator-approved is staged only; nothing here mutates
 * production behaviour without a signed off-the-record.
 *
 * Reads from lib/platform/platformSeedData.ts. When LearningEvent
 * Prisma rows arrive, the consumers stay the same.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  CpuChipIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import {
  DEMO_LEARNING_EVENTS,
  type LearningSource,
} from "@/lib/platform/platformSeedData";
import { getSubTool } from "@/lib/platform/subToolCatalog";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { PlatformHero } from "@/components/platform/PlatformHero";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Learning events · Axiom",
  description:
    "What the agent kernels learned from operator approvals, rejections, incidents, and automation outcomes — with confidence, evidence, and an approval gate before any behaviour change.",
};

// Reads per-tenant freshness via currentContext(); must run per-request.
export const dynamic = "force-dynamic";

const SOURCE_META: Record<
  LearningSource,
  { label: string; tone: string; icon: typeof AcademicCapIcon }
> = {
  approval_accepted:   { label: "Approval accepted",   tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: CheckCircleIcon },
  approval_rejected:   { label: "Approval rejected",   tone: "border-rose-500/30    bg-rose-500/10    text-rose-300",    icon: XCircleIcon },
  incident_resolved:   { label: "Incident resolved",   tone: "border-cyan-500/30    bg-cyan-500/10    text-cyan-300",    icon: WrenchScrewdriverIcon },
  automation_failed:   { label: "Automation failed",   tone: "border-amber-500/30   bg-amber-500/10   text-amber-300",   icon: WrenchScrewdriverIcon },
  user_correction:     { label: "User correction",     tone: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300", icon: ChatBubbleLeftEllipsisIcon },
  agent_collaboration: { label: "Agent collaboration", tone: "border-indigo-500/30  bg-indigo-500/10  text-indigo-300",  icon: CpuChipIcon },
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((Date.now() - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function LearningPage() {
  const freshness = await getTenantFreshness();
  const showSampleData = !freshness.freshTenant;
  const sorted = [...DEMO_LEARNING_EVENTS].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const applied = sorted.filter((l) => l.applied).length;
  const stagedOnly = sorted.length - applied;

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="AI ops · learning"
        eyebrowTone="fuchsia"
        title="Learning events"
        description="The agents learn from every operator decision — what was approved, what was rejected, what corrections were made. A learning event becomes a behavioural change only after explicit operator approval; everything else stays staged as suggestion."
        gradientFromColor="radial-gradient(900px 320px at 14% 0%, rgba(217,70,239,0.10), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(99,102,241,0.08), transparent 60%)"
        right={
          <>
            {showSampleData && (
              <>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px] font-mono">
                  {applied} applied
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2.5 py-1 text-[11px] font-mono">
                  {stagedOnly} staged only
                </span>
                <DemoBadge />
              </>
            )}
          </>
        }
      />

      {!showSampleData && (
        <div className="mb-6">
          <TenantEmptyState
            icon={AcademicCapIcon}
            tone="fuchsia"
            eyebrow="No learning events yet"
            title="AGI starts learning the moment your agents take their first action."
            description="Every approval, rejection, correction, and incident resolution feeds back into the kernels — turning each operator decision into a calibrated suggestion. Nothing changes behaviour without your sign-off."
            agiNote="Your team's preferences shape the agents. Reject a suggestion once and AGI remembers; approve a pattern twice and it gets proposed first next time."
            actions={[
              { href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" },
              { href: "/dashboard/approvals", label: "Approval center", variant: "ghost" },
            ]}
          />
        </div>
      )}

      {showSampleData && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Events" value={sorted.length} />
        <Stat label="Applied" value={applied} sub="behaviour change live" />
        <Stat label="Staged" value={stagedOnly} sub="awaiting operator confirmation" />
        <Stat
          label="Avg confidence"
          value={Math.round(
            (sorted.reduce((acc, l) => acc + l.confidence, 0) / Math.max(sorted.length, 1)) * 100,
          )}
          sub="%"
        />
      </div>
      )}

      {showSampleData && (
      <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
        <header className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
            <AcademicCapIcon className="h-4 w-4 text-zinc-400" />
            Recent learning
            <DemoBadge />
          </h2>
        </header>

        <ul className="space-y-2">
          {sorted.map((l) => {
            const source = SOURCE_META[l.source];
            const SourceIcon = source.icon;
            const tool = getSubTool(l.subToolSlug);
            return (
              <li key={l.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white">{l.recommendation}</p>
                    <p className="mt-1 text-[11.5px] text-zinc-500">{l.evidence}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
                      <span className={["rounded-full px-2 py-0.5 border whitespace-nowrap inline-flex items-center gap-1", source.tone].join(" ")}>
                        <SourceIcon className="h-3 w-3" />
                        {source.label}
                      </span>
                      {tool ? (
                        <Link
                          href={`/dashboard/sub-tools/${tool.slug}`}
                          className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-300 hover:bg-violet-500/15 transition"
                        >
                          {tool.name}
                        </Link>
                      ) : null}
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-400">
                        {l.agentModule}
                      </span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-400">
                        confidence {(l.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-400">
                        {formatRelative(l.occurredAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={[
                      "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap",
                      l.applied
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                    ].join(" ")}>
                      {l.applied ? "applied" : "staged"}
                    </span>
                    <span className={[
                      "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap",
                      l.humanApproved
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
                    ].join(" ")}>
                      {l.humanApproved ? "operator approved" : "awaiting operator"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      )}

      {/* Learning rules */}
      <section className="mt-6 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <AcademicCapIcon className="h-4 w-4 text-fuchsia-300" />
          <h2 className="text-[13px] font-semibold text-fuchsia-100">Learning safety rules</h2>
        </header>
        <ul className="text-[12.5px] text-fuchsia-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-fuchsia-400/80">
          <li>A learning event never changes production behaviour on its own — it is a <em>proposal</em>.</li>
          <li>Behaviour-change events route through the same approval engine as actions.</li>
          <li>Style + tone learning (e.g. preferred phrasing) is applied to drafts only — operator-edits-and-sends remains the contract.</li>
          <li>Rejected proposals stay on the durable rationale ledger so the same suggestion isn't re-surfaced without new evidence.</li>
          <li>Cross-agent learning (council agreement → auto-stage) requires explicit operator opt-in per sub-tool.</li>
        </ul>
        <Link
          href="/dashboard/approvals"
          className="mt-4 inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-[12px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/15 transition"
        >
          Approve a proposal
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </section>
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
