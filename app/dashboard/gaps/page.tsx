/**
 * /dashboard/gaps — gap detection center.
 *
 * Cross-sub-tool inventory of detected gaps. Each row carries severity,
 * evidence, detected-by-agent, recommended action, and whether
 * automation is available to remediate.
 *
 * Reads from lib/platform/platformSeedData.ts. When a GapFinding Prisma
 * model lands, swap the read in this file — the shape is already typed.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  DEMO_GAPS,
  type GapSeverity,
} from "@/lib/platform/platformSeedData";
import { getSubTool } from "@/lib/platform/subToolCatalog";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { PlatformHero } from "@/components/platform/PlatformHero";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Gap detection · Axiom",
  description:
    "Detected gaps across cloud, security, DevOps, observability, databases, HR, customer support, finance, procurement, and documentation. Each finding ships with evidence and a recommended action.",
};

// Reads per-tenant freshness via currentContext(); must run per-request.
export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<GapSeverity, string> = {
  info:     "border-zinc-500/30    bg-zinc-500/10    text-zinc-300",
  warn:     "border-amber-500/30   bg-amber-500/10   text-amber-300",
  high:     "border-rose-500/30    bg-rose-500/10    text-rose-300",
  critical: "border-rose-500/40    bg-rose-500/15    text-rose-200",
};

const SEVERITY_ORDER: GapSeverity[] = ["critical", "high", "warn", "info"];

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

export default async function GapsPage() {
  const freshness = await getTenantFreshness();
  const showSampleData = !freshness.freshTenant;
  const counts = DEMO_GAPS.reduce<Record<GapSeverity, number>>(
    (acc, g) => {
      acc[g.severity] += 1;
      return acc;
    },
    { info: 0, warn: 0, high: 0, critical: 0 },
  );
  const openGaps = DEMO_GAPS.filter((g) => g.status === "open");
  const automatableGaps = DEMO_GAPS.filter((g) => g.automationAvailable);

  const grouped = [...DEMO_GAPS].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity);
    const sb = SEVERITY_ORDER.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="AI ops · gap detection"
        eyebrowTone="amber"
        title="Gap detection"
        description="Continuous gap inventory across every sub-tool. Each finding is detected by an agent kernel, carries operator-readable evidence, and links to the automation that can remediate it. Risky remediations require an approval packet."
        gradientFromColor="radial-gradient(900px 320px at 14% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(244,63,94,0.08), transparent 60%)"
        right={
          <>
            {showSampleData && (
              <>
                <span className="rounded-full border border-rose-500/40 bg-rose-500/15 text-rose-200 px-2.5 py-1 text-[11px] font-mono">
                  {counts.critical} critical
                </span>
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 px-2.5 py-1 text-[11px] font-mono">
                  {counts.high} high
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2.5 py-1 text-[11px] font-mono">
                  {counts.warn} warn
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
            icon={ExclamationTriangleIcon}
            tone="fuchsia"
            eyebrow="No gaps detected yet"
            title="Gap detection starts the moment your environment is visible."
            description="Axiom scans for missing backups, weak pipelines, public resources, unmonitored services, stale runbooks, and unanswered tickets — across every connector you add. Each finding ships with evidence, a recommended action, and an automation when one is safe to offer."
            agiNote="AGI prioritises the gaps that are both highest-impact and lowest-risk to fix — you only see actionable findings, not noise."
            actions={[
              { href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" },
              { href: "/dashboard/automation", label: "Browse automations", variant: "ghost" },
            ]}
          />
        </div>
      )}

      {showSampleData && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total findings" value={DEMO_GAPS.length} />
        <Stat label="Open"        value={openGaps.length}      sub={`${DEMO_GAPS.length - openGaps.length} resolved or scheduled`} />
        <Stat label="Automatable" value={automatableGaps.length} sub="auto-staged remediation available" />
        <Stat label="Approval-gated remediations" value={DEMO_GAPS.filter((g) => g.approvalRequired).length} />
      </div>
      )}

      {/* Findings list */}
      {showSampleData && (
      <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
        <header className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
            Findings
            <DemoBadge />
          </h2>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            sorted by severity · most recent first
          </span>
        </header>

        <ul className="space-y-2">
          {grouped.map((g) => {
            const tool = getSubTool(g.subToolSlug);
            return (
              <li
                key={g.id}
                className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 hover:border-violet-500/30 transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white flex items-center gap-2">
                      {g.severity === "critical" || g.severity === "high" ? (
                        <ExclamationTriangleIcon className="h-3.5 w-3.5 text-rose-300 flex-shrink-0" />
                      ) : null}
                      {g.title}
                    </p>
                    <p className="mt-1 text-[11.5px] text-zinc-500">{g.evidence}</p>
                    <p className="mt-1.5 text-[12px] text-zinc-300">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300/80 mr-1.5">
                        recommendation
                      </span>
                      {g.recommendation}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
                      {tool ? (
                        <Link
                          href={`/dashboard/sub-tools/${tool.slug}`}
                          className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-300 hover:bg-violet-500/15 transition"
                        >
                          {tool.name}
                        </Link>
                      ) : null}
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300">
                        {g.category}
                      </span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-400">
                        {g.detectedByAgent}
                      </span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-400">
                        detected {formatRelative(g.detectedAt)}
                      </span>
                      {g.automationAvailable ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                          automation available
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-zinc-500">
                          manual remediation
                        </span>
                      )}
                      {g.approvalRequired ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                          approval-gated
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", SEVERITY_TONE[g.severity]].join(" ")}>
                      {g.severity}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                      {g.status}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      )}
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
