/**
 * /dashboard/automation — automation engine.
 *
 * Surfaces the script + workflow registry, recent runs, and per-script
 * risk / approval / execution-mode metadata. Two filter pills cut the
 * view: execution mode (cloud / desktop) and risk level.
 *
 * Reads from lib/platform/platformSeedData.ts today. When AutomationScript
 * + AutomationRun Prisma rows land, swap the read calls in this file —
 * consumers already use the same shapes.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  PlayCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ComputerDesktopIcon,
  CloudIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import {
  DEMO_SCRIPTS,
  DEMO_AUTOMATION_RUNS,
  type AutomationRunStatus,
  type RiskLevel,
} from "@/lib/platform/platformSeedData";
import { getSubTool } from "@/lib/platform/subToolCatalog";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { LiveBadge } from "@/components/platform/LiveBadge";
import {
  getLiveAutomationState,
  relativeTime,
} from "@/lib/platform/livePlatformState";
import { PlatformHero } from "@/components/platform/PlatformHero";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Automation engine · Axiom",
  description:
    "Python + workflow registry with risk levels, dry-run support, approval gates, and execution mode (cloud / desktop).",
};

const RISK_TONE: Record<RiskLevel, string> = {
  low:      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium:   "border-amber-500/30   bg-amber-500/10   text-amber-300",
  high:     "border-rose-500/30    bg-rose-500/10    text-rose-300",
  critical: "border-rose-500/40    bg-rose-500/15    text-rose-200",
};

const RUN_STATUS_TONE: Record<AutomationRunStatus, string> = {
  succeeded:         "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  running:           "border-cyan-500/30    bg-cyan-500/10    text-cyan-300",
  failed:            "border-rose-500/30    bg-rose-500/10    text-rose-300",
  dry_run:           "border-zinc-500/30    bg-zinc-500/10    text-zinc-300",
  awaiting_approval: "border-amber-500/30   bg-amber-500/10   text-amber-300",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}m`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function AutomationPage() {
  const cloudScripts   = DEMO_SCRIPTS.filter((s) => s.executionMode === "cloud");
  const desktopScripts = DEMO_SCRIPTS.filter((s) => s.executionMode === "desktop");
  const approvalQueue  = DEMO_AUTOMATION_RUNS.filter((r) => r.status === "awaiting_approval");
  const [live, freshness] = await Promise.all([getLiveAutomationState(), getTenantFreshness()]);
  const showSampleData = !freshness.freshTenant;

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="AI ops · automation"
        eyebrowTone="cyan"
        title="Automation engine"
        description="Every script and workflow Axiom can run, with risk level, dry-run support, approval gates, and execution mode. Cloud-mode scripts run from the platform; desktop-mode scripts run from the registered desktop agent."
        gradientFromColor="radial-gradient(900px 320px at 14% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(124,58,237,0.08), transparent 60%)"
        right={
          <>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2.5 py-1 text-[11px] font-mono">
              {cloudScripts.length} cloud
            </span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-2.5 py-1 text-[11px] font-mono">
              {desktopScripts.length} desktop
            </span>
            {showSampleData && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2.5 py-1 text-[11px] font-mono">
                {approvalQueue.length} awaiting approval
              </span>
            )}
            {live.ok ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-2.5 py-1 text-[11px] font-mono inline-flex items-center gap-1.5">
                <LiveBadge />
                {live.totalRuns24h} runs · 24h
              </span>
            ) : null}
            {showSampleData && <DemoBadge />}
          </>
        }
      />

      {!showSampleData && (
        <div className="mb-6">
          <TenantEmptyState
            icon={BoltIcon}
            tone="cyan"
            eyebrow="Automation engine"
            title="Your script registry and runs appear once a connector is wired."
            description="The automation engine runs Python scripts and workflows across cloud and desktop targets. Every risky action carries a dry-run, an approval gate, and a rollback plan."
            agiNote="AGI will recommend the first safe automations the moment we can see your environment — no scripting required to get started."
            actions={[
              { href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" },
              { href: "/dashboard/desktop-agents", label: "Set up desktop runtime", variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Top-level metric strip */}
      {showSampleData && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Registered scripts" value={DEMO_SCRIPTS.length} />
        <Stat
          label={live.ok ? "Runs · 24h · live" : "Recent runs · demo"}
          value={live.ok ? live.totalRuns24h : DEMO_AUTOMATION_RUNS.length}
          sub={live.ok ? `${live.pendingApprovals} approvals pending` : undefined}
        />
        <Stat label="Approval-gated" value={DEMO_SCRIPTS.filter((s) => s.approvalRequired).length} />
        <Stat label="Dry-run capable" value={DEMO_SCRIPTS.filter((s) => s.dryRunSupported).length} sub="every risky script supports dry-run" />
      </div>
      )}

      {live.ok && live.recent.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 md:p-5">
          <header className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[13px] font-semibold text-emerald-100 flex items-center gap-2">
              <LiveBadge />
              Live runs · your tenant
            </h2>
            <Link
              href="/dashboard/agent-activity"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-white transition"
            >
              Full activity
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </header>
          <ul className="space-y-2">
            {live.recent.map((r) => (
              <li key={r.id} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-[12.5px] font-medium text-white">
                    <span className="font-mono uppercase tracking-widest text-[10px] text-emerald-300/80 mr-1.5">
                      {r.trigger.replace("_", " ")}
                    </span>
                    {r.summary ?? `Agent run ${r.id.slice(0, 8)}`}
                  </p>
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-200 whitespace-nowrap">
                    {r.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] font-mono text-zinc-500">
                  started {relativeTime(r.startedAt ?? r.createdAt)}
                  {r.completedAt ? ` · completed ${relativeTime(r.completedAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showSampleData && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scripts table — spans 2 cols */}
        <section className="lg:col-span-2 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
          <header className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
              Script registry
              <DemoBadge />
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              {DEMO_SCRIPTS.length} entries
            </span>
          </header>

          <div className="space-y-2">
            {DEMO_SCRIPTS.map((s) => {
              const tool = getSubTool(s.subToolSlug);
              const ModeIcon = s.executionMode === "desktop" ? ComputerDesktopIcon : CloudIcon;
              return (
                <article
                  key={s.id}
                  className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-3.5 py-3 hover:border-violet-500/30 hover:bg-white/[0.035] transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white">{s.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-zinc-500">{s.purpose}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
                        <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300">
                          {s.language}
                        </span>
                        <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300 inline-flex items-center gap-1">
                          <ModeIcon className="h-3 w-3" />
                          {s.executionMode}
                        </span>
                        <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300">
                          connector: {s.requiredConnector}
                        </span>
                        {tool ? (
                          <Link
                            href={`/dashboard/sub-tools/${tool.slug}`}
                            className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-300 hover:bg-violet-500/15 transition"
                          >
                            {tool.name}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", RISK_TONE[s.riskLevel]].join(" ")}>
                        risk · {s.riskLevel}
                      </span>
                      <span className={[
                        "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap",
                        s.approvalRequired
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                      ].join(" ")}>
                        {s.approvalRequired ? "approval-gated" : "autorunnable"}
                      </span>
                    </div>
                  </div>
                  {s.lastRunAt && s.lastRunStatus ? (
                    <p className="mt-2 text-[10.5px] font-mono text-zinc-500 flex items-center gap-2">
                      <ClockIcon className="h-3 w-3" />
                      last run {formatRelative(s.lastRunAt)} · {s.lastRunStatus.replace("_", " ")}
                    </p>
                  ) : (
                    <p className="mt-2 text-[10.5px] font-mono text-zinc-600 italic">
                      never run
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* RIGHT: approval queue + recent runs */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 md:p-5">
            <header className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-[13px] font-semibold text-amber-100 flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-amber-300" />
                Awaiting approval
                <DemoBadge />
              </h2>
              <Link
                href="/dashboard/approvals"
                className="text-[11px] text-amber-200 hover:text-white transition inline-flex items-center gap-1"
              >
                Approvals
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </header>
            {approvalQueue.length === 0 ? (
              <p className="text-[12px] text-zinc-500 italic">No staged actions awaiting approval.</p>
            ) : (
              <ul className="space-y-2">
                {approvalQueue.map((r) => (
                  <li key={r.id} className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
                    <p className="text-[12.5px] font-medium text-white">{r.scriptName}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">{r.outputSummary}</p>
                    {r.rollbackNote ? (
                      <p className="mt-1 text-[10.5px] font-mono text-zinc-500">rollback: {r.rollbackNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
            <header className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
                <PlayCircleIcon className="h-4 w-4 text-zinc-400" />
                Recent runs
                <DemoBadge />
              </h2>
            </header>
            <ul className="space-y-2">
              {DEMO_AUTOMATION_RUNS.slice(0, 6).map((r) => (
                <li key={r.id} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-[12px] font-medium text-white truncate">{r.scriptName}</p>
                    <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", RUN_STATUS_TONE[r.status]].join(" ")}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] font-mono text-zinc-500">
                    {formatRelative(r.startedAt)} · {formatDuration(r.durationMs)} · risk {r.riskLevel}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
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
