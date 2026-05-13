"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CloudIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowRightIcon,
  CommandLineIcon,
  CpuChipIcon,
  ArrowsPointingOutIcon,
  ClockIcon,
  ArrowPathIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { resolveNextAction } from "@/lib/product/nextAction";
import { useDesktopRuntime } from "@/lib/desktop/useDesktopRuntime";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type ConnectorStatus = {
  provider: string;
  status: string;
  accountId?: string;
  lastScan?: string;
};

export default function DashboardPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((r) => r.json())
      .then((data) => {
        setConnectors(data.connectors || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  const connected = connectors.filter((c) => c.status === "connected");

  return (
    <>
      <NextActionBanner connectedClouds={connected.length} />
      <Reveal direction="up" blur delay={0.05}>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
              Live · Agent operational
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Axiom <span className="text-gradient">Dashboard.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-2xl leading-relaxed">
            Manage your cloud connections, run scans, and review execution plans. <span className="dim-1">Every action is reversible. Every reasoning trace is auditable.</span>
          </p>
        </div>
      </Reveal>

      {/* Command Center spotlight */}
      <Reveal direction="up" delay={0.08}>
        <Link
          href="/dashboard/command-center"
          className="block mb-6 relative rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.03] p-6 hover:border-violet-500/30 transition-all group overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-violet-500/[0.08] blur-[60px] pointer-events-none" aria-hidden />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-fuchsia-500/[0.05] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <CpuChipIcon className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-bold text-white">Operational Command Center</p>
                  <span className="text-[9px] font-semibold text-violet-400 bg-violet-500/15 border border-violet-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">New</span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Live activity feed, agent reasoning traces, and execution-plan inspection — all in one place.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
              Open command center
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      </Reveal>

      <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link
          href="/operator/onboarding"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <CloudIcon className="h-5 w-5 text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Connect Cloud</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Link your AWS, Azure, or GCP account with a read-only IAM role.
          </p>
        </Link>

        <Link
          href="/dashboard/topology"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <ArrowsPointingOutIcon className="h-5 w-5 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Topology</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Live map of every provider, region, and resource Axiom is operating.
          </p>
        </Link>

        <Link
          href="/dashboard/memory"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ClockIcon className="h-5 w-5 text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Memory</h2>
          </div>
          <p className="text-xs text-zinc-500">
            90-day operational history · scans · plans · approvals · confidence shifts.
          </p>
        </Link>

        <Link
          href="/dashboard/workflows"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ArrowPathIcon className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Workflows</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Continuous operations · recurring scans · drift monitoring · execution queues.
          </p>
        </Link>

        <Link
          href="/dashboard/approvals"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group relative overflow-hidden"
        >
          <span aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-500/[0.08] blur-[30px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <SparklesIcon className="h-5 w-5 text-amber-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">Approvals</h2>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Human-in-the-loop approval center · pending execution plans · rollback readiness.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/governance"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group relative overflow-hidden"
        >
          <span aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-500/[0.08] blur-[30px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheckIcon className="h-5 w-5 text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">Governance</h2>
            </div>
            <p className="text-xs text-zinc-500">
              Policy engine · autonomy level · 15-rule default pack · enterprise trust guarantees.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/releaseops"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group relative overflow-hidden"
        >
          <span aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-violet-500/[0.08] blur-[30px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <ShieldCheckIcon className="h-5 w-5 text-violet-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">ReleaseOps</h2>
              </div>
              <span className="text-[9px] font-semibold text-violet-400 bg-violet-500/15 border border-violet-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">New</span>
            </div>
            <p className="text-xs text-zinc-500">
              Deployment governance · readiness scoring · approval orchestration · drift detection.
            </p>
          </div>
        </Link>

        <Link
          href="/axiom/operations"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BoltIcon className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Operations</h2>
          </div>
          <p className="text-xs text-zinc-500">
            View scan results, findings, execution plans, and audit trail.
          </p>
        </Link>

        <Link
          href="/dashboard/resilience"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-fuchsia-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Resilience</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Architecture analysis, Terraform generation, and deployment safety.
          </p>
        </Link>

        <Link
          href="/download"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CommandLineIcon className="h-5 w-5 text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Desktop Agent</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Install Axiom locally for secure workstation mode and background scans.
          </p>
        </Link>
      </Stagger>

      {/* Connected accounts */}
      <Reveal direction="up" blur delay={0.15}>
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 tracking-[-0.04em]">
            Connected accounts
          </h2>
          {connected.length === 0 ? (
            <div className="text-center py-8">
              <CloudIcon className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-4">No cloud accounts connected yet.</p>
              <Link
                href="/operator/onboarding"
                className="btn-huly inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-900 rounded-full text-sm font-semibold hover:bg-zinc-100 transition-all"
              >
                Connect your first account
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {connected.map((c) => (
                <div
                  key={c.accountId || c.provider}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{c.provider}</p>
                      {c.accountId && (
                        <p className="text-xs text-zinc-500">{c.accountId}</p>
                      )}
                    </div>
                  </div>
                  {c.lastScan && (
                    <span className="text-xs text-zinc-500">
                      Last scan: {new Date(c.lastScan).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      <div className="section-divider my-8" />

      <Reveal direction="up" blur delay={0.2}>
        <div className="glass-card card-hover rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2 tracking-[-0.04em]">
            Getting started
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-zinc-400">
            <li>Connect a cloud account with a read-only IAM role</li>
            <li>Run your first scan to discover infrastructure and findings</li>
            <li>Review execution plans and approve changes</li>
          </ol>
        </div>
      </Reveal>
    </>
  );
}

function NextActionBanner({ connectedClouds }: { connectedClouds: number }) {
  const { isDesktop } = useDesktopRuntime();
  const action = resolveNextAction({
    connectedClouds,
    primaryLifecycle: connectedClouds > 0 ? "lifecycle.idle" : undefined,
    pendingApprovals: 0,
    readyPlans: 0,
    releaseopsConnected: false,
    releaseopsServicesAtRisk: 0,
    desktopAvailable: isDesktop,
    hasRunScan: connectedClouds > 0,
    isAuthenticated: true,
  });

  const severityClass =
    action.severity === "critical" ? "border-red-500/20 bg-red-500/[0.04]" :
    action.severity === "warning" ? "border-amber-500/20 bg-amber-500/[0.04]" :
    action.severity === "success" ? "border-emerald-500/20 bg-emerald-500/[0.04]" :
    "border-violet-500/20 bg-violet-500/[0.04]";

  return (
    <Reveal direction="up">
      <Link
        href={action.cta.href}
        className={`mb-6 block rounded-2xl border ${severityClass} p-5 hover:border-white/[0.18] transition-all group relative overflow-hidden`}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/[0.06] blur-[40px] pointer-events-none" aria-hidden />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <SparklesIcon className="h-5 w-5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-0.5">
                Next best action
              </p>
              <p className="text-sm font-bold text-white mb-0.5">{action.cta.label}</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{action.reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-violet-300 font-semibold text-sm shrink-0">
            Go
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
