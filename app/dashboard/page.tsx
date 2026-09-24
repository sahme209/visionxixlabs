"use client";

/**
 * /dashboard — calmed-down landing surface.
 *
 * The earlier version put 7 competing sections on screen: header badges,
 * gradient hero with glow orbs, three preview posture scores, a 12-cell
 * capability rail in three columns, connected accounts, empty state,
 * desktop pitch. That made the page hard to read.
 *
 * Huly.io / Jony Ive pass: subtract until each section earns its place.
 *   1. Header — workspace label, welcome, two quiet CTAs. No mode badges,
 *      no gradient text.
 *   2. Next best action — single calm card, no orbs, no glow. The most
 *      important thing on the page lives here.
 *   3. Connected accounts (or empty state) — live data, plain rows.
 *   4. Capability list — one tidy three-column rail, no badges, no
 *      arrows on every row, more whitespace between groups.
 *   5. Desktop pitch — small footer banner only when not on desktop.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CloudIcon,
  CommandLineIcon,
  CpuChipIcon,
  ArrowsPointingOutIcon,
  ClockIcon,
  ArrowPathIcon,
  SparklesIcon,
  DocumentTextIcon,
  ServerStackIcon,
  ChartBarSquareIcon,
  KeyIcon,
  ShieldCheckIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { resolveNextAction } from "@/lib/product/nextAction";
import { useDesktopRuntime } from "@/lib/desktop/useDesktopRuntime";
import { assessOnboarding } from "@/lib/onboarding/onboardingState";
import { computeHonestyCounts } from "@/lib/actions/actionRegistry";
import { RunScanButton } from "./RunScanButton";
import { DisconnectButton } from "./DisconnectButton";
import { ConnectionHealth } from "./ConnectionHealth";
import { RecentActivity } from "./RecentActivity";
import { Sparkline } from "./Sparkline";
import { AxiomBootSequence } from "@/components/workforce/AxiomBootSequence";

type ConnectorStatus = {
  provider: string;
  status: string;
  accountId?: string;
  lastScan?: string;
};

interface DashboardSummary {
  findingCount: number;
  pendingApprovals: number;
  highRiskApprovals: number;
  monthlyLow: number;
  monthlyHigh: number;
  lastScanIso: string | null;
  findingsTrend7d: number[];
  scansTrend7d: number[];
}

const PROVIDER_LABEL: Record<string, string> = {
  aws:   "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp:   "Google Cloud",
};

function timeAgoFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function DashboardPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDesktop } = useDesktopRuntime();

  async function refresh() {
    await Promise.all([
      fetch("/api/connectors/status")
        .then((r) => r.json())
        .then((data) => setConnectors(Array.isArray(data?.connectors) ? data.connectors : []))
        .catch(() => {}),
      fetch("/api/dashboard/summary")
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok) setSummary(data as DashboardSummary);
        })
        .catch(() => {}),
    ]);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
      </div>
    );
  }

  const connected = connectors.filter((c) => c.status === "connected" || c.status === "linked");
  const onboarding = assessOnboarding({
    hasAccount: true,
    providerSelected: connected.length > 0,
    credentialsSubmitted: connected.length > 0,
    credentialsValidated: connected.length > 0,
    scansStarted: connected.length > 0 ? 1 : 0,
    snapshotsPersisted: connected.length > 0 ? 1 : 0,
    recommendationsViewed: 0,
    plansBuilt: 0,
    approvalsGranted: 0,
    plansExecutedOrExported: 0,
    auditBundlesExported: 0,
  });

  const nextAction = resolveNextAction({
    connectedClouds: connected.length,
    primaryLifecycle: connected.length > 0 ? "lifecycle.idle" : undefined,
    pendingApprovals: 0,
    readyPlans: 0,
    releaseopsConnected: false,
    releaseopsServicesAtRisk: 0,
    desktopAvailable: isDesktop,
    hasRunScan: connected.length > 0,
    isAuthenticated: true,
  });

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2 relative">
      {/* Robotic boot sequence — letter-by-letter glitch entry. Plays
          once per session via sessionStorage; honors prefers-reduced-motion. */}
      <AxiomBootSequence text="VISIONXIXLABS" subtitle="AI workforce online" />

      {/* Subtle scan-grid backdrop — pure CSS, behind everything.
          Robotic without overwhelming. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* ─── Terminal header banner ──────────────────────────────────────── */}
      <header className="mb-12 border-b border-emerald-500/15 pb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/80 mb-5 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
            session.established
          </span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">workspace · live</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">runtime · v1</span>
        </div>
        <h1 className="font-mono text-[26px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.01em] mb-3">
          <span className="text-emerald-300">&gt;</span>{" "}
          welcome back<span className="text-emerald-300/60">_</span>
        </h1>
        <p className="text-[13.5px] text-zinc-400 leading-relaxed max-w-xl font-mono">
          one workspace · cloud ops · governance · execution-plan approval —
          every action <span className="text-zinc-300">explainable</span>,{" "}
          <span className="text-zinc-300">reversible</span>,{" "}
          <span className="text-zinc-300">audited</span>.
        </p>
      </header>

      {/* ─── Phase 658: honest action-surface chip — answered above the fold ─ */}
      <ActionSurfaceChip />

      {/* ─── Next best action — real-state aware ──────────────────────────── */}
      <section className="mb-10">
        <SectionKicker label="next-action" status="primary" />
        {(() => {
          // Live summary trumps the heuristic nextAction whenever it
          // can answer concretely. Order from most-urgent to least.
          const live = summary && (() => {
            if (summary.highRiskApprovals > 0) {
              return {
                href: "/dashboard/approvals",
                label: `Review ${summary.highRiskApprovals} high-risk approval${summary.highRiskApprovals === 1 ? "" : "s"}`,
                reason: "High-risk recommendations stop scans from making cross-cuts. Approve or reject to keep the queue moving.",
              };
            }
            if (summary.pendingApprovals > 0) {
              return {
                href: "/dashboard/approvals",
                label: summary.monthlyHigh > 0
                  ? `Approve ~$${Math.round(summary.monthlyHigh).toLocaleString()}/mo in pending changes`
                  : `Decide on ${summary.pendingApprovals} pending recommendation${summary.pendingApprovals === 1 ? "" : "s"}`,
                reason: "Each approval emits a Terraform plan you can review and apply in your own environment.",
              };
            }
            if (summary.findingCount > 0) {
              return {
                href: "/dashboard/findings",
                label: `Investigate ${summary.findingCount} finding${summary.findingCount === 1 ? "" : "s"}`,
                reason: "The scanner found real signals in your last scan. Open the list to drill into severity, resources, and the recommendation chain.",
              };
            }
            if (summary.lastScanIso) {
              return {
                href: "/dashboard/scans",
                label: "Clean — review the scan history",
                reason: "Nothing actionable in the latest scan. The cron keeps re-running daily; history is on /dashboard/scans.",
              };
            }
            return null;
          })();
          const action = live ?? { href: nextAction.cta.href, label: nextAction.cta.label, reason: nextAction.reason };
          return (
            <Link
              href={action.href}
              className="group block border border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-400/40 hover:bg-emerald-500/[0.06] transition-colors px-6 py-6 rounded-md"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300/70 mb-2.5">
                    exec :: priority-1
                  </p>
                  <h2 className="text-[20px] font-semibold text-white tracking-[-0.01em] mb-2 leading-snug">
                    <span className="text-emerald-300 font-mono">&gt;</span>{" "}
                    {action.label}
                  </h2>
                  <p className="text-[13px] text-zinc-400 leading-relaxed max-w-xl">
                    {action.reason}
                  </p>
                </div>
                <span className="font-mono text-[14px] text-emerald-300/60 group-hover:text-emerald-200 group-hover:translate-x-0.5 transition-all mt-1.5 shrink-0">
                  →
                </span>
              </div>
            </Link>
          );
        })()}
        {onboarding.nextStep && !summary?.findingCount && (
          <p className="mt-3 text-[11px] text-zinc-600 leading-relaxed pl-1 font-mono">
            <span className="text-zinc-700">$</span> {onboarding.nextStep.label} · {onboarding.nextStep.detail}
          </p>
        )}
        {summary && summary.lastScanIso && (
          <Link
            href="/dashboard/briefing"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-emerald-300 transition-colors pl-1"
          >
            <SparklesIcon className="h-3 w-3" />
            read.briefing.today
            <span aria-hidden>→</span>
          </Link>
        )}
      </section>

      {/* ─── First-run journey — only while the user hasn't completed it yet ─ */}
      {summary && summary.findingCount === 0 && !summary.lastScanIso && (
        <JourneyChecklist
          connected={connected.length > 0}
          scanned={!!summary.lastScanIso}
          findings={summary.findingCount}
          approved={false}
        />
      )}

      {/* ─── Live stats — only shows when there's signal ──────────────────── */}
      {summary && (summary.findingCount > 0 || summary.pendingApprovals > 0 || summary.lastScanIso) && (
        <section className="mb-10">
          <SectionKicker label="telemetry" status="live" />
          <div className="border border-white/[0.06] bg-white/[0.012] grid grid-cols-2 sm:grid-cols-4 divide-x sm:divide-y-0 divide-y divide-white/[0.04] overflow-hidden rounded-md">
            <Stat label="findings"     value={summary.findingCount.toString()} href="/dashboard/findings"
                  spark={summary.findingsTrend7d} sparkTone="text-zinc-400" />
            <Stat label="pending"      value={summary.pendingApprovals.toString()} href="/dashboard/approvals"
                  tone={summary.highRiskApprovals > 0 ? "text-amber-300" : undefined} />
            <Stat label="potential/mo" value={summary.monthlyHigh > 0 ? `$${Math.round(summary.monthlyHigh).toLocaleString()}` : "—"} href="/dashboard/approvals" />
            <Stat label="last.scan"    value={timeAgoFromIso(summary.lastScanIso) ?? "—"} href="/dashboard/scans"
                  spark={summary.scansTrend7d} sparkTone="text-emerald-400/70" />
          </div>
        </section>
      )}

      {/* ─── Connected accounts ──────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <SectionKicker label="cloud-accounts" status={connected.length > 0 ? "ok" : "empty"} count={connected.length} inline />
          {connected.length > 0 && (
            <Link href="/dashboard/connect-cloud" className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 hover:text-emerald-300 transition-colors">
              manage →
            </Link>
          )}
        </div>

        {connected.length === 0 ? (
          <Link
            href="/dashboard/connect-cloud"
            className="group block border border-dashed border-emerald-500/25 bg-emerald-500/[0.02] hover:border-emerald-400/50 hover:bg-emerald-500/[0.05] transition-colors px-6 py-6 rounded-md"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-emerald-500/30 bg-emerald-500/[0.06] flex items-center justify-center shrink-0 rounded-sm">
                <CloudIcon className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white mb-1 font-mono">
                  <span className="text-emerald-300">&gt;</span> connect.first_cloud
                </p>
                <p className="text-[11.5px] text-zinc-500 leading-relaxed font-mono">
                  aws · azure · gcp — read-only by default, revoke anytime
                </p>
              </div>
              <span className="font-mono text-[14px] text-emerald-300/60 group-hover:text-emerald-200 group-hover:translate-x-0.5 transition-all shrink-0">→</span>
            </div>
          </Link>
        ) : (
          <>
            <div className="border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden rounded-md">
              {connected.map((c) => (
                <div key={c.accountId || c.provider}>
                  <div className="px-5 py-3.5 flex items-center gap-4">
                    <span className="w-1.5 h-1.5 bg-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-white font-mono">
                        {PROVIDER_LABEL[c.provider] ?? c.provider}
                      </p>
                      {c.accountId && (
                        <p className="text-[10.5px] font-mono text-zinc-500 mt-0.5">
                          <span className="text-zinc-700">0x</span>{c.accountId}
                        </p>
                      )}
                    </div>
                    {c.lastScan && (
                      <span className="text-[10.5px] font-mono text-zinc-500 shrink-0">
                        {new Date(c.lastScan).toISOString().slice(0, 10)}
                      </span>
                    )}
                    {(c.provider === "aws" || c.provider === "azure" || c.provider === "gcp") && (
                      <DisconnectButton
                        provider={c.provider}
                        onComplete={() => { void refresh(); }}
                      />
                    )}
                  </div>
                  {(c.provider === "aws" || c.provider === "azure" || c.provider === "gcp") && (
                    <ConnectionHealth provider={c.provider} />
                  )}
                </div>
              ))}
            </div>
            {/* Real-action controls. Single-region default for fast
                feedback; multi-region for the thorough sweep. onComplete
                refreshes the live stats row above so 'findings' and
                'last scan' tick up the moment the scan returns. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <RunScanButton label="Run scan now" onComplete={() => { void refresh(); }} />
              <RunScanButton
                label="Scan all regions"
                multiRegion
                onComplete={() => { void refresh(); }}
              />
            </div>
          </>
        )}
      </section>

      {/* ─── Recent activity — hidden when empty ──────────────────────────── */}
      <RecentActivity />

      {/* ─── Workspace ──────────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionKicker label="workspace" status="catalog" />
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-6 border border-white/[0.06] bg-white/[0.012] rounded-md p-6">
          <CapabilityGroup
            title="Operate"
            items={[
              { href: "/dashboard/command-center", icon: CpuChipIcon,           label: "Command Center",  sub: "Live activity + reasoning" },
              { href: "/dashboard/topology",       icon: ArrowsPointingOutIcon, label: "Topology",        sub: "Map every resource" },
              { href: "/dashboard/workflows",      icon: ArrowPathIcon,         label: "Workflows",       sub: "Recurring scans + jobs" },
              { href: "/dashboard/jobs",           icon: ClockIcon,             label: "Jobs",            sub: "Durable retry-aware tasks" },
            ]}
          />
          <CapabilityGroup
            title="Govern"
            items={[
              { href: "/dashboard/approvals",       icon: SparklesIcon,    label: "Approvals",       sub: "Human-in-the-loop plans" },
              { href: "/dashboard/recommendations", icon: BoltIcon,        label: "Recommendations", sub: "Every action proposed" },
              { href: "/dashboard/governance",      icon: ShieldCheckIcon, label: "Governance",      sub: "Policy + autonomy ladder" },
              { href: "/dashboard/security",        icon: KeyIcon,         label: "Security",        sub: "RBAC + credentials" },
            ]}
          />
          <CapabilityGroup
            title="Inspect"
            items={[
              { href: "/dashboard/findings",     icon: CloudIcon,          label: "Findings",     sub: "What your latest scan found" },
              { href: "/dashboard/scans",        icon: ArrowPathIcon,      label: "Scans",        sub: "History of every run" },
              { href: "/dashboard/audit",        icon: DocumentTextIcon,   label: "Audit",        sub: "Every meaningful event" },
              { href: "/dashboard/capabilities", icon: CommandLineIcon,    label: "Capabilities", sub: "What Axiom can do right now" },
            ]}
          />
        </div>
      </section>

      {/* ─── Desktop footer — only when relevant ────────────────────────── */}
      {!isDesktop && (
        <section className="mb-8">
          <Link
            href="/download"
            className="group block border border-cyan-500/15 bg-cyan-500/[0.02] hover:border-cyan-400/40 hover:bg-cyan-500/[0.05] transition-colors px-6 py-5 rounded-md"
          >
            <div className="flex items-center gap-4">
              <CommandLineIcon className="h-5 w-5 text-cyan-300/80 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-white mb-0.5 font-mono">
                  <span className="text-cyan-300">$</span> axiom.runtime --desktop
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
                  signed handoffs · review terraform locally · credentials in keychain
                </p>
              </div>
              <span className="font-mono text-[14px] text-cyan-300/60 group-hover:text-cyan-200 group-hover:translate-x-0.5 transition-all shrink-0">→</span>
            </div>
          </Link>
        </section>
      )}

      {/* ─── Robotic footer — terminal-style status line ─────────────────── */}
      <footer className="mt-16 pt-6 border-t border-white/[0.04] font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600 flex items-center justify-between flex-wrap gap-3">
        <span>
          <span className="text-emerald-400">●</span> uptime.session :: {new Date().toISOString().slice(0, 10)}
        </span>
        <span className="text-zinc-700">visionxixlabs.runtime/v1</span>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Robotic helpers — terminal-style section kickers used across the page.
// One source of truth for the kicker idiom so every section reads the same.
// ────────────────────────────────────────────────────────────────────────────

function SectionKicker({
  label,
  status,
  count,
  inline,
}: {
  label: string;
  status: "primary" | "live" | "ok" | "empty" | "catalog";
  count?: number;
  inline?: boolean;
}) {
  const statusTone: Record<string, string> = {
    primary: "text-emerald-300",
    live: "text-emerald-300",
    ok: "text-emerald-300",
    empty: "text-zinc-500",
    catalog: "text-cyan-300/80",
  };
  const dot = status === "empty" ? null : (
    <span className={`w-1 h-1 ${status === "live" ? "bg-emerald-400 animate-pulse" : "bg-emerald-400/70"}`} />
  );
  return (
    <p className={`font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2 ${inline ? "" : "block"}`}>
      <span className="text-zinc-700">//</span>
      <span className={statusTone[status]}>{label}</span>
      {count !== undefined && (
        <>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400 tabular-nums">{count}</span>
        </>
      )}
      {dot && (
        <>
          <span className="text-zinc-700">::</span>
          {dot}
          <span className={statusTone[status]}>{status}</span>
        </>
      )}
    </p>
  );
}

/**
 * Phase 658: honest action-surface chip rendered above the fold on
 * /dashboard. Pulls live counts from lib/actions/actionRegistry —
 * answers the founder question ("what can Axiom do right now?")
 * without requiring a click into /dashboard/command-center or
 * /dashboard/capabilities. Pure typed metadata, no fetch.
 */
function ActionSurfaceChip() {
  const counts = computeHonestyCounts();
  return (
    <section className="mb-6 -mt-2">
      <Link
        href="/dashboard/capabilities"
        className="block rounded-md border border-emerald-500/20 bg-emerald-500/[0.025] px-4 py-3 hover:border-emerald-500/40 hover:bg-emerald-500/[0.05] transition-colors group"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-1.5 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>action-surface</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">{counts.total} typed actions</span>
        </p>
        <p className="text-[13px] text-zinc-200 leading-relaxed">
          <span className="text-emerald-300 font-semibold">{counts.live} live</span>
          <span className="text-zinc-500"> · </span>
          <span className="text-sky-300 font-semibold">{counts.preview} preview</span>
          <span className="text-zinc-500"> · </span>
          <span className="text-emerald-300 font-semibold">{counts.governed} governed</span>
          <span className="text-zinc-500"> · </span>
          <span className="text-amber-300 font-semibold">{counts.needs_setup} need setup</span>
          <span className="text-zinc-500"> · </span>
          <span className="text-rose-300 font-semibold">{counts.unsafe} unsafe blocked by design</span>
          <span className="text-zinc-500"> — </span>
          <span className="text-emerald-300 group-hover:text-white transition-colors underline underline-offset-2">audit every action →</span>
        </p>
      </Link>
    </section>
  );
}

function JourneyChecklist({
  connected,
  scanned,
  findings,
  approved,
}: {
  connected: boolean;
  scanned: boolean;
  findings: number;
  approved: boolean;
}) {
  const steps: Array<{ label: string; done: boolean; href: string; hint: string }> = [
    {
      label: "Connect a cloud",
      done: connected,
      href: "/dashboard/connect-cloud",
      hint: "AWS via CloudFormation, Azure via Cloud Shell, GCP via service account.",
    },
    {
      label: "Run your first scan",
      done: scanned,
      href: "/dashboard/findings",
      hint: "Broker AssumeRoles into your account and reads inventory + posture.",
    },
    {
      label: "Review findings",
      done: findings > 0,
      href: "/dashboard/findings",
      hint: "Every finding traces back to the resource and the rule that produced it.",
    },
    {
      label: "Approve a recommendation",
      done: approved,
      href: "/dashboard/approvals",
      hint: "Approval emits a downloadable Terraform plan — nothing applies automatically.",
    },
  ];
  return (
    <section className="mb-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
        <span className="text-zinc-700">//</span>
        <span className="text-emerald-300">first-run</span>
        <span className="text-zinc-700">::</span>
        <span className="text-zinc-500">setup-sequence</span>
      </p>
      <ol className="border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden rounded-md">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="group flex items-start gap-4 px-5 py-3.5 hover:bg-emerald-500/[0.04] transition-colors"
            >
              <span className={`mt-1 w-4 h-4 border flex items-center justify-center shrink-0 rounded-sm font-mono text-[9px] ${
                s.done ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : "border-white/[0.12] text-zinc-700"
              }`}>
                {s.done ? "✓" : (i + 1).toString().padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium font-mono ${s.done ? "text-zinc-500 line-through decoration-zinc-700" : "text-white"}`}>
                  step.{(i + 1).toString().padStart(2, "0")} — {s.label.toLowerCase()}
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{s.hint}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({
  label,
  value,
  href,
  tone,
  spark,
  sparkTone,
}: {
  label: string;
  value: string;
  href: string;
  tone?: string;
  spark?: number[];
  sparkTone?: string;
}) {
  return (
    <Link
      href={href}
      className="group block px-4 py-4 hover:bg-emerald-500/[0.04] transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className={`text-[22px] font-mono font-semibold tabular-nums leading-none ${tone ?? "text-white"}`}>{value}</p>
        {spark && spark.length > 0 && (
          <Sparkline values={spark} tone={sparkTone ?? "text-zinc-500"} />
        )}
      </div>
      <p className="text-[9.5px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1 group-hover:text-emerald-300 transition-colors">
        <span className="text-zinc-700">▸</span> {label}
      </p>
    </Link>
  );
}

function CapabilityGroup({
  title,
  items,
}: {
  title: string;
  items: { href: string; icon: typeof CloudIcon; label: string; sub: string }[];
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300/70 mb-4 inline-flex items-center gap-2">
        <span className="text-zinc-700">[</span>
        <span>{title.toLowerCase()}</span>
        <span className="text-zinc-700">]</span>
      </p>
      <div className="space-y-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 py-1 hover:translate-x-0.5 transition-transform"
            >
              <Icon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-emerald-300 transition-colors mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium font-mono text-zinc-200 group-hover:text-white transition-colors">
                  {item.label.toLowerCase().replace(/ /g, "_")}
                </p>
                <p className="text-[10.5px] text-zinc-600 leading-relaxed font-mono">{item.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
