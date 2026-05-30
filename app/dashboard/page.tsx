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
  ArrowRightIcon,
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
import { RunScanButton } from "./RunScanButton";

type ConnectorStatus = {
  provider: string;
  status: string;
  accountId?: string;
  lastScan?: string;
};

const PROVIDER_LABEL: Record<string, string> = {
  aws:   "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp:   "Google Cloud",
};

export default function DashboardPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDesktop } = useDesktopRuntime();

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((r) => r.json())
      .then((data) => setConnectors(Array.isArray(data?.connectors) ? data.connectors : []))
      .catch(() => {})
      .finally(() => setLoading(false));
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
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="mb-14">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">workspace · live</p>
        </div>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Welcome back.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          One workspace for cloud operations, governance, and execution-plan
          approval — every action explainable, reversible, audited.
        </p>
      </header>

      {/* ─── Next best action ────────────────────────────────────────────── */}
      <section className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">next</p>
        <Link
          href={nextAction.cta.href}
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-7"
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-[22px] font-semibold text-white tracking-[-0.02em] mb-2">
                {nextAction.cta.label}
              </h2>
              <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
                {nextAction.reason}
              </p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1.5 shrink-0" />
          </div>
        </Link>
        {onboarding.nextStep && (
          <p className="mt-3 text-[12px] text-zinc-600 leading-relaxed pl-1">
            {onboarding.nextStep.label} · {onboarding.nextStep.detail}
          </p>
        )}
      </section>

      {/* ─── Connected accounts ──────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">cloud accounts</p>
          {connected.length > 0 && (
            <Link href="/dashboard/connect-cloud" className="text-[11px] text-zinc-500 hover:text-white transition-colors">
              Manage
            </Link>
          )}
        </div>

        {connected.length === 0 ? (
          <Link
            href="/dashboard/connect-cloud"
            className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-7"
          >
            <div className="flex items-center gap-5">
              <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                <CloudIcon className="h-5 w-5 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-white mb-1">Connect your first cloud</p>
                <p className="text-[12px] text-zinc-500 leading-relaxed">
                  AWS, Azure, or Google — read-only by default, revoke anytime.
                </p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </Link>
        ) : (
          <>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
              {connected.map((c) => (
                <div key={c.accountId || c.provider} className="px-6 py-4 flex items-center gap-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white">
                      {PROVIDER_LABEL[c.provider] ?? c.provider}
                    </p>
                    {c.accountId && (
                      <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{c.accountId}</p>
                    )}
                  </div>
                  {c.lastScan && (
                    <span className="text-[11px] text-zinc-500 shrink-0">
                      {new Date(c.lastScan).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Real-action control — first time this button does
                anything, the platform stops feeling like a mock. */}
            <div className="mt-4">
              <RunScanButton />
            </div>
          </>
        )}
      </section>

      {/* ─── Workspace ──────────────────────────────────────────────────── */}
      <section className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-5">workspace</p>
        <div className="grid md:grid-cols-3 gap-x-10 gap-y-8">
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
              { href: "/dashboard/approvals",  icon: SparklesIcon,    label: "Approvals",  sub: "Human-in-the-loop plans" },
              { href: "/dashboard/governance", icon: ShieldCheckIcon, label: "Governance", sub: "Policy + autonomy ladder" },
              { href: "/dashboard/security",   icon: KeyIcon,         label: "Security",   sub: "RBAC + credentials" },
              { href: "/dashboard/releaseops", icon: ServerStackIcon, label: "ReleaseOps", sub: "Deployment readiness" },
            ]}
          />
          <CapabilityGroup
            title="Inspect"
            items={[
              { href: "/dashboard/findings",    icon: CloudIcon,          label: "Findings",    sub: "What your latest scan found" },
              { href: "/dashboard/audit",       icon: DocumentTextIcon,   label: "Audit",       sub: "Evidence-backed stories" },
              { href: "/dashboard/traces",      icon: ChartBarSquareIcon, label: "Traces",      sub: "Operation span timelines" },
              { href: "/dashboard/reliability", icon: BoltIcon,           label: "Reliability", sub: "Circuits + retries" },
            ]}
          />
        </div>
      </section>

      {/* ─── Desktop footer — only when relevant ────────────────────────── */}
      {!isDesktop && (
        <section className="mb-8">
          <Link
            href="/download"
            className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-5"
          >
            <div className="flex items-center gap-5">
              <CommandLineIcon className="h-5 w-5 text-zinc-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white mb-0.5">Run Axiom on your workstation</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Receive signed handoffs, review Terraform locally, keep credentials in the keychain.
                </p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </Link>
        </section>
      )}
    </div>
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
      <p className="text-[11px] text-zinc-500 mb-3.5">{title}</p>
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 py-1"
            >
              <Icon className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors">{item.label}</p>
                <p className="text-[11px] text-zinc-600 leading-relaxed">{item.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
