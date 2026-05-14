"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BoltIcon,
  CurrencyDollarIcon,
  ShieldExclamationIcon,
  CheckBadgeIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  CloudIcon,
  EyeIcon,
  CpuChipIcon,
  LockClosedIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { ShieldCheckIcon, SignalIcon, ChartBarSquareIcon } from "@heroicons/react/24/outline";
import { ActivityFeed } from "@/components/operations/ActivityFeed";
import { ReasoningTrace } from "@/components/operations/ReasoningTrace";
import { ExecutionPlanCard } from "@/components/operations/ExecutionPlanCard";
import { InfrastructureTopology } from "@/components/operations/InfrastructureTopology";
import { buildSecurityPosture } from "@/lib/security/securityPosture";
import { buildReliabilityPosture } from "@/lib/reliability/reliabilityPosture";
import { buildObservabilityPosture } from "@/lib/observability/observabilityPosture";
import { DEFAULT_DESKTOP_SHELL_STATE, summarizeShell } from "@/lib/desktop/desktopShellState";
import { ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { assessOnboarding, progressPercent } from "@/lib/onboarding/onboardingState";
import type { OnboardingProgress } from "@/lib/onboarding/onboardingState";

interface KpiTile {
  label: string;
  value: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  icon: typeof BoltIcon;
  iconClass: string;
  bgClass: string;
}

const KPIs: KpiTile[] = [
  {
    label: "Cost saved this month",
    value: "$12,840",
    trend: "+18% vs last month",
    trendDirection: "up",
    icon: CurrencyDollarIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    label: "Findings resolved",
    value: "47",
    trend: "12 pending",
    trendDirection: "flat",
    icon: CheckBadgeIcon,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10 border-violet-500/20",
  },
  {
    label: "Critical risks open",
    value: "3",
    trend: "1 awaiting approval",
    trendDirection: "flat",
    icon: ShieldExclamationIcon,
    iconClass: "text-red-400",
    bgClass: "bg-red-500/10 border-red-500/20",
  },
  {
    label: "Agent confidence",
    value: "92%",
    trend: "+4 pts this week",
    trendDirection: "up",
    icon: ArrowTrendingUpIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10 border-amber-500/20",
  },
];

interface ProviderHealth {
  name: string;
  shortName: "AWS" | "Azure" | "GCP";
  status: "operational" | "scanning" | "degraded" | "disconnected";
  lastScan: string;
  resources: number;
  findings: number;
  region: string;
  accountId: string;
}

const PROVIDERS: ProviderHealth[] = [
  {
    name: "Production AWS",
    shortName: "AWS",
    status: "operational",
    lastScan: "47s ago",
    resources: 142,
    findings: 14,
    region: "us-east-1",
    accountId: "123456789012",
  },
  {
    name: "Staging AWS",
    shortName: "AWS",
    status: "scanning",
    lastScan: "running now",
    resources: 38,
    findings: 2,
    region: "us-west-2",
    accountId: "234567890123",
  },
  {
    name: "Azure EU",
    shortName: "Azure",
    status: "operational",
    lastScan: "12m ago",
    resources: 84,
    findings: 6,
    region: "westeurope",
    accountId: "sub-prod-eu",
  },
];

const STATUS_CONFIG = {
  operational: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Operational" },
  scanning: { dot: "bg-blue-400 animate-pulse", text: "text-blue-400", label: "Scanning" },
  degraded: { dot: "bg-amber-400", text: "text-amber-400", label: "Degraded" },
  disconnected: { dot: "bg-zinc-600", text: "text-zinc-500", label: "Disconnected" },
} as const;

const PROVIDER_COLOR = {
  AWS: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Azure: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  GCP: "text-red-400 bg-red-500/10 border-red-500/20",
} as const;

interface PendingApproval {
  id: string;
  title: string;
  provider: "AWS" | "Azure" | "GCP";
  blastRadius: "contained" | "moderate" | "broad";
  monthlySavings?: number;
  riskLevel: "low" | "medium" | "high";
}

const PENDING_APPROVALS: PendingApproval[] = [
  {
    id: "approval_01",
    title: "IAM policy modification · prod-api-role",
    provider: "AWS",
    blastRadius: "broad",
    riskLevel: "high",
  },
  {
    id: "approval_02",
    title: "Right-size 3 EC2 instances · phase 3 of 4",
    provider: "AWS",
    blastRadius: "contained",
    monthlySavings: 800,
    riskLevel: "low",
  },
  {
    id: "approval_03",
    title: "Delete 7 unused EBS volumes",
    provider: "AWS",
    blastRadius: "contained",
    monthlySavings: 380,
    riskLevel: "low",
  },
];

const APPROVAL_RISK = {
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function CommandCenterPage() {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const update = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      {/* Hero header */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
                Live · Agent operational
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {currentTime || "—:—:—"} · auto-refresh on
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Operational <span className="text-gradient">Command Center.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-2xl leading-relaxed">
            Real-time view of every scan, finding, plan, and execution. <span className="dim-1">Agent reasoning is auditable. Every action is reversible.</span>
          </p>
        </div>
      </Reveal>

      {/* KPI row */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {KPIs.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${kpi.bgClass} border flex items-center justify-center`}>
                  <Icon className={`h-4.5 w-4.5 ${kpi.iconClass}`} />
                </div>
                {kpi.trendDirection === "up" && (
                  <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-1">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
              {kpi.trend && (
                <p className={`text-[10px] mt-2 font-medium ${
                  kpi.trendDirection === "up" ? "text-emerald-400" :
                  kpi.trendDirection === "down" ? "text-red-400" :
                  "text-zinc-500"
                }`}>{kpi.trend}</p>
              )}
            </div>
          );
        })}
      </Stagger>

      {/* Security + Reliability + Observability strips — canonical posture aggregators */}
      <Reveal direction="up" delay={0.055}>
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <SecurityPostureStrip />
          <ReliabilityPostureStrip />
          <ObservabilityPostureStrip />
        </div>
      </Reveal>

      {/* Executive summary banner — memory-driven */}
      <Reveal direction="up" delay={0.06}>
        <ExecutiveSummaryBanner />
      </Reveal>

      {/* Full-width topology row */}
      <Reveal direction="up" delay={0.08}>
        <div className="mb-6">
          <InfrastructureTopology />
        </div>
      </Reveal>

      {/* Main grid: feed on left, sidebars on right */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Left: Activity Feed (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          <Reveal direction="up" delay={0.1}>
            <ActivityFeed liveFetch />
          </Reveal>

          {/* Agent Reasoning Trace */}
          <Reveal direction="up" delay={0.15}>
            <ReasoningTrace />
          </Reveal>

          {/* Execution Plan */}
          <Reveal direction="up" delay={0.2}>
            <ExecutionPlanCard />
          </Reveal>
        </div>

        {/* Right: Sidebar (1 col) */}
        <div className="space-y-5">
          {/* Provider Health */}
          <Reveal direction="up" delay={0.1}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Provider health</h3>
                  <Link href="/dashboard" className="text-[10px] text-zinc-500 hover:text-white transition-colors">View all</Link>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {PROVIDERS.map((p) => {
                  const config = STATUS_CONFIG[p.status];
                  return (
                    <div key={p.accountId} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-white/[0.08] transition-colors">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[p.shortName]}`}>
                          {p.shortName}
                        </span>
                        <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                        <span className="font-mono">{p.region} · {p.accountId.slice(0, 12)}{p.accountId.length > 12 ? "…" : ""}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                          <span className={`font-semibold uppercase tracking-wider ${config.text}`}>{config.label}</span>
                        </div>
                        <span className="text-zinc-500">{p.lastScan}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                        <span className="text-[10px] text-zinc-500">{p.resources} resources</span>
                        <span className={`text-[10px] font-semibold ${p.findings > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                          {p.findings} findings
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-3 pb-3">
                <Link
                  href="/operator/onboarding"
                  className="flex items-center justify-center gap-1.5 w-full text-[11px] text-zinc-400 hover:text-white border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl py-2.5 transition-colors"
                >
                  + Connect provider
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Pending Approvals */}
          <Reveal direction="up" delay={0.15}>
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.02] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-amber-500/15 bg-amber-500/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="h-3.5 w-3.5 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Pending approvals</h3>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px">
                    {PENDING_APPROVALS.length}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {PENDING_APPROVALS.map((a) => (
                  <button
                    key={a.id}
                    className="w-full text-left rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[a.provider]}`}>
                        {a.provider}
                      </span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${APPROVAL_RISK[a.riskLevel]}`}>
                        {a.riskLevel} risk
                      </span>
                    </div>
                    <p className="text-xs text-white font-medium leading-snug mb-1.5">{a.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 capitalize">{a.blastRadius} blast</span>
                      {a.monthlySavings && (
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          +${a.monthlySavings}/mo
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Quick Actions */}
          <Reveal direction="up" delay={0.2}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Quick actions</h3>
              <div className="space-y-1.5">
                {[
                  { href: "/operator/onboarding", icon: CloudIcon, label: "Run new scan" },
                  { href: "/dashboard/releaseops", icon: LockClosedIcon, label: "ReleaseOps command center" },
                  { href: "/dashboard/topology", icon: EyeIcon, label: "View topology" },
                  { href: "/dashboard/workflows", icon: ChartBarIcon, label: "Continuous workflows" },
                  { href: "/dashboard/memory", icon: CpuChipIcon, label: "Operational memory" },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors" />
                        <span className="text-xs text-zinc-300 group-hover:text-white transition-colors">{action.label}</span>
                      </div>
                      <ArrowRightIcon className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </Reveal>

          {/* Agent status */}
          <Reveal direction="up" delay={0.25}>
            <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.03] p-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/[0.08] blur-[40px] pointer-events-none" aria-hidden />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <CpuChipIcon className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Agent status</h3>
                </div>
                <div className="space-y-2 text-[11px]">
                  {[
                    { label: "Reasoning loop", value: "Active", color: "text-emerald-400", dot: "bg-emerald-400 animate-pulse" },
                    { label: "Confidence", value: "0.92", color: "text-emerald-400", dot: "bg-emerald-400" },
                    { label: "Memory", value: "1,847 events", color: "text-zinc-300", dot: "bg-violet-400" },
                    { label: "Outcome safety", value: "Learning", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />
                        <span className="text-zinc-500">{row.label}</span>
                      </div>
                      <span className={`font-medium ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Onboarding progress — observation-driven journey */}
          <Reveal direction="up" delay={0.26}>
            <OnboardingPanel />
          </Reveal>

          {/* Desktop runtime panel — typed shell state */}
          <Reveal direction="up" delay={0.28}>
            <DesktopRuntimePanel />
          </Reveal>

          {/* Documentation links */}
          <Reveal direction="up" delay={0.3}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Learn how this works</span>
              </div>
              <div className="space-y-1">
                {[
                  { href: "/docs/scanning", label: "How scans work" },
                  { href: "/docs/approval-workflow", label: "Approval workflow" },
                  { href: "/docs/execution-plans", label: "Execution plans" },
                  { href: "/docs/rollback", label: "Rollback strategy" },
                  { href: "/docs/security-model", label: "Security model" },
                ].map((doc) => (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/[0.04] transition-colors group"
                  >
                    <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">{doc.label}</span>
                    <ArrowRightIcon className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Executive summary banner — memory-driven, demo-state for now
// ---------------------------------------------------------------------------

function ExecutiveSummaryBanner() {
  // Demo data — will be replaced by real summary fetch when /api/operations/summary is wired.
  const summary = {
    opener: "26 operational events this week — 4 scans observed, 6 changes applied.",
    highlights: [
      { headline: "$4,200/mo in savings locked", detail: "Confirmed by post-execution verification.", severity: "success" as const, link: { label: "Open Memory", href: "/dashboard/memory" } },
      { headline: "1 service requires attention", detail: "auth-gateway recurring in finding queue — investigate root cause.", severity: "warning" as const, link: { label: "Open Topology", href: "/dashboard/topology" } },
      { headline: "Agent confidence trending up", detail: "+4 pts week over week — outcomes validating the reasoning.", severity: "info" as const, link: { label: "Why?", href: "/docs/architecture#layers" } },
    ],
    recommended: "Address auth-gateway recurring findings before approving new high-risk plans.",
  };

  return (
    <div className="mb-6 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-fuchsia-500/[0.03] p-5 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <CpuChipIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Executive summary · this week</p>
          <span className="text-[9px] font-semibold text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded-full px-1.5 py-px uppercase tracking-wider">Memory-driven</span>
        </div>
        <p className="text-sm font-semibold text-white mb-4 leading-relaxed">{summary.opener}</p>
        <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
          {summary.highlights.map((h, i) => {
            const tint =
              h.severity === "success" ? "border-emerald-500/15 bg-emerald-500/[0.03]" :
              h.severity === "warning" ? "border-amber-500/15 bg-amber-500/[0.03]" :
              "border-blue-500/15 bg-blue-500/[0.03]";
            return (
              <Link key={i} href={h.link.href} className={`rounded-xl border ${tint} p-3 hover:border-white/[0.18] transition-colors group`}>
                <p className="text-xs font-bold text-white mb-1 leading-snug">{h.headline}</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{h.detail}</p>
                <p className="text-[10px] text-zinc-500 mt-2 group-hover:text-white transition-colors">{h.link.label} →</p>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Next best action:</span>
          <span className="text-zinc-300">{summary.recommended}</span>
        </div>
      </div>
    </div>
  );
}

function SecurityPostureStrip() {
  const posture = buildSecurityPosture({
    source: "preview",
    credentials: [],
    pairedDesktops: [],
    crossTenantAttempts30d: 0,
    policyBlocks30d: 2,
    openHighRiskFindings: 1,
    redactionEnabled: true,
    auditStoreConfigured: true,
    copilotContextSafe: true,
  });
  const tone =
    posture.semantic === "success" ? "border-emerald-500/15 bg-emerald-500/[0.03]" :
    posture.semantic === "warning" ? "border-amber-500/15 bg-amber-500/[0.03]" :
    posture.semantic === "error"   ? "border-red-500/15 bg-red-500/[0.03]" :
                                     "border-white/[0.06] bg-white/[0.02]";
  const scorePct = Math.round(posture.score * 100);
  const headlineCheck = posture.checks.find((c) => c.semantic === "error") ?? posture.checks.find((c) => c.semantic === "warning") ?? posture.checks[0];
  return (
    <Link href="/dashboard/security" className={`block rounded-2xl border ${tone} p-5 hover:border-emerald-500/30 transition-colors group`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Security posture</p>
              <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">
                Preview
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{scorePct}% baseline · {headlineCheck?.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{headlineCheck?.detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Stat label="Redaction" value={`${posture.redaction.patterns.length}`} />
            <Stat label="Credentials" value={`${posture.credentialSummary.total}`} />
            <Stat label="Desktops" value={`${posture.desktopSummary.trusted}/${posture.desktopSummary.paired}`} />
          </div>
          <ArrowRightIcon className="h-4 w-4 text-zinc-500 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center min-w-[3.5rem]">
      <p className="text-base font-bold text-white tracking-tight leading-none">{value}</p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function ReliabilityPostureStrip() {
  const posture = buildReliabilityPosture({
    source: "preview",
    components: [
      { id: "web_app",          label: "Web app",          status: "healthy"   },
      { id: "database",         label: "Database",         status: "healthy"   },
      { id: "connector.aws",    label: "AWS connector",    status: "healthy"   },
      { id: "connector.azure",  label: "Azure connector",  status: "degraded"  },
      { id: "connector.github", label: "GitHub connector", status: "healthy"   },
      { id: "copilot_llm",      label: "Copilot / LLM",    status: "healthy"   },
      { id: "workflow_engine",  label: "Workflow engine",  status: "healthy"   },
    ],
    circuits: [],
    deadLetters: [],
    fleet: { total: 12, healthy: 11, stalled: 1, stuck: 0, failed: 0, partial: 0, actionable: [] },
    retryingJobs: 3,
    successfulRetries24h: 17,
    rateLimitPauses24h: 4,
  });
  const tone =
    posture.semantic === "success" ? "border-cyan-500/15 bg-cyan-500/[0.03]" :
    posture.semantic === "warning" ? "border-amber-500/15 bg-amber-500/[0.03]" :
    posture.semantic === "error"   ? "border-red-500/15 bg-red-500/[0.03]" :
                                     "border-white/[0.06] bg-white/[0.02]";
  const scorePct = Math.round(posture.score * 100);
  const headlineCheck = posture.checks.find((c) => c.semantic === "error") ?? posture.checks.find((c) => c.semantic === "warning") ?? posture.checks[0];
  return (
    <Link href="/dashboard/reliability" className={`block rounded-2xl border ${tone} p-5 hover:border-cyan-500/30 transition-colors group`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <SignalIcon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">Reliability posture</p>
              <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">
                Preview
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{scorePct}% healthy · {headlineCheck?.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{headlineCheck?.detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Stat label="Retrying" value={`${posture.retryingJobs}`} />
            <Stat label="Open circ." value={`${posture.openCircuits.length}`} />
            <Stat label="DLQ" value={`${posture.unresolvedDeadLetters.length}`} />
          </div>
          <ArrowRightIcon className="h-4 w-4 text-zinc-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function ObservabilityPostureStrip() {
  const posture = buildObservabilityPosture({
    source: "preview",
    traces24h: 287,
    auditRecords24h: 612,
    bundlesExported30d: 4,
    loggerActive: true,
    auditStoreConfigured: true,
    copilotAuditActive: true,
  });
  const errors = posture.checks.filter((c) => c.semantic === "error").length;
  const warnings = posture.checks.filter((c) => c.semantic === "warning").length;
  const tone =
    errors > 0   ? "border-red-500/15 bg-red-500/[0.03]"     :
    warnings > 0 ? "border-amber-500/15 bg-amber-500/[0.03]" :
                   "border-violet-500/15 bg-violet-500/[0.03]";
  const headlineCheck =
    posture.checks.find((c) => c.semantic === "error") ??
    posture.checks.find((c) => c.semantic === "warning") ??
    posture.checks[0];
  return (
    <Link href="/dashboard/traces" className={`block rounded-2xl border ${tone} p-5 hover:border-violet-500/30 transition-colors group`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <ChartBarSquareIcon className="h-5 w-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Observability</p>
              <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">Preview</span>
            </div>
            <p className="text-sm font-semibold text-white">Every action traceable · {headlineCheck?.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{headlineCheck?.detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Stat label="Traces" value="287" />
            <Stat label="Audit" value="612" />
            <Stat label="Bundles" value="4" />
          </div>
          <ArrowRightIcon className="h-4 w-4 text-zinc-500 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function DesktopRuntimePanel() {
  // Honest preview state — when desktop pairing wires up, this reads from the
  // useDesktopRuntime hook + canonical shell state.
  const summary = summarizeShell({
    ...DEFAULT_DESKTOP_SHELL_STATE,
    runtimeState: "offline",
    platform: "unknown",
    appVersion: "0.1.0",
    capabilities: ["review", "preview", "verify", "audit_sync"],
    connection: "offline",
    auditSync: "unknown",
  });
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ComputerDesktopIcon className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-white">Desktop runtime</h3>
        </div>
        <Link href="/download" className="text-[10px] text-zinc-500 hover:text-white transition-colors">View</Link>
      </div>
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <p className="text-[12px] text-zinc-200 font-semibold">{summary.headline}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">No paired desktop. Download the preview to enable local execution-plan review.</p>
      </div>
      <div className="p-3 space-y-1.5">
        {summary.checks.slice(0, 4).map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
              c.semantic === "success" ? "bg-emerald-400" :
              c.semantic === "warning" ? "bg-amber-400" :
              c.semantic === "error"   ? "bg-red-400"   :
                                          "bg-zinc-500"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-200">{c.label}</p>
              <p className="text-[10px] text-zinc-500 leading-snug">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 pt-1 flex items-center gap-2">
        <Link href="/download" className="flex-1 text-center text-[11px] font-semibold text-violet-300 hover:text-violet-200 rounded-md border border-violet-500/20 bg-violet-500/[0.06] hover:border-violet-500/40 px-2 py-1.5 transition-colors">
          Download desktop
        </Link>
        <Link href="/dashboard/security" className="text-[11px] text-zinc-400 hover:text-white rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] px-2 py-1.5 transition-colors">
          Security
        </Link>
      </div>
    </div>
  );
}

function OnboardingPanel() {
  // Honest preview state — a freshly-onboarding tenant. Real implementation
  // pulls observations from the orgContext + memory + audit aggregators.
  const progress: OnboardingProgress = assessOnboarding({
    hasAccount: true,
    providerSelected: true,
    credentialsSubmitted: true,
    credentialsValidated: true,
    scansStarted: 1,
    snapshotsPersisted: 1,
    recommendationsViewed: 0,
    plansBuilt: 0,
    approvalsGranted: 0,
    plansExecutedOrExported: 0,
    auditBundlesExported: 0,
  });
  const pct = progressPercent(progress);
  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-cyan-500/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BoltIcon className="h-4 w-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">Getting Axiom productive</h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">{pct}%</span>
      </div>
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progress.nextStep ? (
          <>
            <p className="text-[12px] font-semibold text-white">Next: {progress.nextStep.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{progress.nextStep.detail}</p>
          </>
        ) : (
          <p className="text-[12px] font-semibold text-emerald-300">You're operating in steady state.</p>
        )}
      </div>
      <div className="p-3 space-y-1.5 max-h-56 overflow-y-auto">
        {progress.milestones.map((m) => (
          <div key={m.stage} className="flex items-start gap-2.5">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${m.done ? "bg-emerald-400" : "bg-zinc-700"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-semibold ${m.done ? "text-zinc-200 line-through decoration-zinc-600" : "text-zinc-300"}`}>
                {m.label}
              </p>
              {!m.done && <p className="text-[10px] text-zinc-500 leading-snug">{m.detail}</p>}
            </div>
          </div>
        ))}
      </div>
      {progress.nextStep && (
        <div className="px-3 pb-3 pt-1">
          <Link
            href={progress.nextStep.href}
            className="block w-full text-center text-[11px] font-semibold text-emerald-200 hover:text-emerald-100 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] hover:border-emerald-500/40 px-2 py-1.5 transition-colors"
          >
            {progress.nextStep.label} →
          </Link>
        </div>
      )}
    </div>
  );
}
