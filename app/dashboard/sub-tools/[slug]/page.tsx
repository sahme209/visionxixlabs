/**
 * /dashboard/sub-tools/[slug] — dynamic sub-tool detail page.
 *
 * One template serves every sub-tool. Renders: overview, owned routes,
 * assigned agents, connected connectors, automation owned by this
 * sub-tool, gap findings, learning events, and a "not covered yet"
 * scope-honesty section.
 *
 * Data sources today:
 * - Sub-tool metadata: lib/platform/subToolCatalog.ts (real config)
 * - Automation, gaps, learning: lib/platform/platformSeedData.ts
 *   (seeded demo, every row tagged with <DemoBadge/>)
 *
 * When the corresponding Prisma rows arrive, swap the read calls —
 * consumers are already typed against the shared shapes.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import {
  clientSubTools,
  getSubTool,
  getSubToolLayer,
  SUB_TOOL_CATEGORY_META,
  SUB_TOOL_MATURITY_META,
} from "@/lib/platform/subToolCatalog";
import {
  DEMO_SCRIPTS,
  DEMO_GAPS,
  DEMO_LEARNING_EVENTS,
  DEMO_AUTOMATION_RUNS,
  type GapSeverity,
  type RiskLevel,
} from "@/lib/platform/platformSeedData";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { PlatformHero } from "@/components/platform/PlatformHero";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Only pre-render client-layer slugs. Internal admin sub-tools have
  // their own /admin/* routes and must not be reachable from this path.
  return clientSubTools().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tool = getSubTool(slug);
  if (!tool) return { title: "Sub-tool not found · Axiom" };
  return {
    title: `${tool.name} · Axiom`,
    description: tool.description,
  };
}

const SEVERITY_TONE: Record<GapSeverity, string> = {
  info:     "border-zinc-500/30    bg-zinc-500/10    text-zinc-300",
  warn:     "border-amber-500/30   bg-amber-500/10   text-amber-300",
  high:     "border-rose-500/30    bg-rose-500/10    text-rose-300",
  critical: "border-rose-500/40    bg-rose-500/15    text-rose-200",
};

const RISK_TONE: Record<RiskLevel, string> = {
  low:      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium:   "border-amber-500/30   bg-amber-500/10   text-amber-300",
  high:     "border-rose-500/30    bg-rose-500/10    text-rose-300",
  critical: "border-rose-500/40    bg-rose-500/15    text-rose-200",
};

const EYEBROW_BY_CATEGORY = {
  technical_ops: "cyan",
  business_ops:  "fuchsia",
  ai_ops:        "emerald",
} as const;

export default async function SubToolDetailPage({ params }: Params) {
  const { slug } = await params;
  const tool = getSubTool(slug);
  if (!tool) notFound();
  // Defense in depth: a client navigating directly to an internal slug
  // sees a not-found, never the page. The /admin layout's
  // isAdminEmail() guard is the canonical access check; this is
  // belt-and-braces in case a stale link is shared.
  if (getSubToolLayer(tool) !== "client") notFound();

  const scripts = DEMO_SCRIPTS.filter((s) => s.subToolSlug === tool.slug);
  const gaps    = DEMO_GAPS.filter((g) => g.subToolSlug === tool.slug);
  const runs    = DEMO_AUTOMATION_RUNS.filter((r) => scripts.some((s) => s.id === r.scriptId));
  const learning = DEMO_LEARNING_EVENTS.filter((l) => l.subToolSlug === tool.slug);

  const categoryMeta = SUB_TOOL_CATEGORY_META[tool.category];
  const maturity = SUB_TOOL_MATURITY_META[tool.maturity];

  return (
    <div className="relative">
      <Link
        href="/dashboard/sub-tools"
        className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white mb-4 transition"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Sub-tools center
      </Link>

      <PlatformHero
        eyebrow={`Sub-tool · ${categoryMeta.label.toLowerCase()}`}
        eyebrowTone={EYEBROW_BY_CATEGORY[tool.category]}
        title={tool.name}
        description={tool.description}
        right={
          <>
            <span className={["text-[11px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border", maturity.tone].join(" ")}>
              {maturity.label}
            </span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
              {tool.purpose}
            </span>
          </>
        }
      />

      {/* Top stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Owned routes" value={tool.ownedRoutes.length} />
        <Stat label="Agent kernels" value={tool.agentKernels.length} />
        <Stat label="Connectors" value={tool.connectors.length} />
        <Stat label="Open gaps" value={gaps.filter((g) => g.status === "open").length} sub={`${gaps.length} total`} />
        <Stat label="Automation scripts" value={scripts.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: routes + connectors + agents */}
        <aside className="space-y-4">
          <Panel title="Owned routes">
            {tool.ownedRoutes.length === 0 ? (
              <p className="text-[12px] text-zinc-500 italic">
                No dedicated cockpit routes yet — sub-tool is in the planning stage.
              </p>
            ) : (
              <ul className="space-y-1">
                {tool.ownedRoutes.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 hover:border-white/[0.12] hover:bg-white/[0.04] transition"
                    >
                      <span className="text-[12.5px] text-zinc-200">{r.label}</span>
                      <ArrowTopRightOnSquareIcon className="h-3 w-3 text-zinc-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Agent kernels">
            <ul className="space-y-1">
              {tool.agentKernels.map((k) => (
                <li
                  key={k}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[11.5px] font-mono text-zinc-300"
                  title={`lib/agents/${k}.ts`}
                >
                  lib/agents/{k}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Connectors">
            <ul className="space-y-1">
              {tool.connectors.map((c) => (
                <li
                  key={c}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  <span className="text-[12.5px] text-zinc-200">{c}</span>
                  <Link
                    href="/dashboard/connectors"
                    className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition"
                  >
                    hub →
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>

        {/* CENTER + RIGHT: automation, gaps, learning, scope */}
        <div className="lg:col-span-2 space-y-4">
          {tool.notCoveredYet ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 mb-1">
                Not covered yet
              </p>
              <p className="text-[12.5px] text-amber-200 leading-relaxed">{tool.notCoveredYet}</p>
            </div>
          ) : null}

          <Panel
            title="Automation scripts"
            right={scripts.length > 0 ? <DemoBadge /> : null}
            link={{ href: "/dashboard/automation", label: "Automation engine" }}
          >
            {scripts.length === 0 ? (
              <p className="text-[12px] text-zinc-500 italic">
                No scripts registered for this sub-tool yet.
              </p>
            ) : (
              <div className="space-y-2">
                {scripts.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 flex flex-wrap items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-white truncate">{s.name}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {s.language} · {s.executionMode === "desktop" ? "desktop" : "cloud"} · {s.purpose}
                      </p>
                    </div>
                    <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", RISK_TONE[s.riskLevel]].join(" ")}>
                      risk · {s.riskLevel}
                    </span>
                    {s.approvalRequired ? (
                      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 whitespace-nowrap">
                        approval-gated
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-zinc-500/30 bg-zinc-500/10 text-zinc-400 whitespace-nowrap">
                        autorunnable
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Gap findings"
            right={gaps.length > 0 ? <DemoBadge /> : null}
            link={{ href: "/dashboard/gaps", label: "Gap detection" }}
          >
            {gaps.length === 0 ? (
              <p className="text-[12px] text-zinc-500 italic">
                No gap findings recorded for this sub-tool.
              </p>
            ) : (
              <ul className="space-y-2">
                {gaps.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="text-[12.5px] font-medium text-white">{g.title}</p>
                      <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", SEVERITY_TONE[g.severity]].join(" ")}>
                        {g.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-zinc-500">{g.recommendation}</p>
                    <p className="mt-1 text-[10.5px] font-mono text-zinc-600">
                      detected by {g.detectedByAgent} · status: {g.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent automation runs"
            right={runs.length > 0 ? <DemoBadge /> : null}
            link={{ href: "/dashboard/automation", label: "Run history" }}
          >
            {runs.length === 0 ? (
              <p className="text-[12px] text-zinc-500 italic">No recent runs for this sub-tool.</p>
            ) : (
              <ul className="space-y-2">
                {runs.map((r) => (
                  <li key={r.id} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="text-[12.5px] font-medium text-white">{r.scriptName}</p>
                      <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/[0.12] bg-violet-500/10 text-violet-300 whitespace-nowrap">
                        {r.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-zinc-400">{r.outputSummary}</p>
                    {r.rollbackNote ? (
                      <p className="mt-1 text-[10.5px] font-mono text-zinc-500">rollback: {r.rollbackNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Learning events"
            right={learning.length > 0 ? <DemoBadge /> : null}
            link={{ href: "/dashboard/learning", label: "Learning center" }}
          >
            {learning.length === 0 ? (
              <p className="text-[12px] text-zinc-500 italic">No learning events tied to this sub-tool yet.</p>
            ) : (
              <ul className="space-y-2">
                {learning.map((l) => (
                  <li key={l.id} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    <p className="text-[12.5px] font-medium text-white">{l.recommendation}</p>
                    <p className="mt-1 text-[11.5px] text-zinc-500">{l.evidence}</p>
                    <p className="mt-1 text-[10.5px] font-mono text-zinc-600">
                      source: {l.source} · confidence {(l.confidence * 100).toFixed(0)}% · {l.applied ? "applied" : "staged only"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Categories">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
                  Gap categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tool.gapCategories.map((c) => (
                    <span key={c} className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-0.5 text-[11px] font-mono text-zinc-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
                  Automation categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tool.automationCategories.map((c) => (
                    <span key={c} className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-0.5 text-[11px] font-mono text-zinc-300">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <footer className="mt-10 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Catalog entry: <span className="font-mono">lib/platform/subToolCatalog.ts</span> · slug{" "}
          <span className="font-mono">{tool.slug}</span>
        </span>
        <Link
          href="/dashboard/sub-tools"
          className="inline-flex items-center gap-1 hover:text-zinc-300 transition"
        >
          All sub-tools
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </footer>
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

function Panel({
  title,
  right,
  link,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
          {title}
          {right}
        </h3>
        {link ? (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white transition"
          >
            {link.label}
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}
