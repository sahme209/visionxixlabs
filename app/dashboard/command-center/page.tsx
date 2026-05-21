"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BoltIcon,
  ShieldExclamationIcon,
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
import { OperatingGraphPanel } from "@/components/dashboard/OperatingGraphPanel";
import { buildObservabilityPosture } from "@/lib/observability/observabilityPosture";
import { ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { assessOnboarding, progressPercent } from "@/lib/onboarding/onboardingState";
import type { OnboardingProgress } from "@/lib/onboarding/onboardingState";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";
import { useTenantFreshness } from "@/components/platform/useTenantFreshness";
import { SparklesIcon } from "@heroicons/react/24/outline";

const PROVIDER_COLOR = {
  AWS: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Azure: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  GCP: "text-red-400 bg-red-500/10 border-red-500/20",
  GitHub: "text-violet-400 bg-violet-500/10 border-violet-500/20",
} as const;

const APPROVAL_RISK: Record<"low" | "medium" | "high" | "critical", string> = {
  low:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high:     "text-rose-400 bg-rose-500/10 border-rose-500/20",
  critical: "text-rose-400 bg-rose-500/15 border-rose-500/30",
};

export default function CommandCenterPage() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const { isFreshOrLoading, loaded } = useTenantFreshness();
  const isFreshTenant = loaded && isFreshOrLoading;

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
      {/* Hero header — premium operator zone. Calm radial depth, honest
          source-mode eyebrow from canonical state, refined typography. */}
      <Reveal direction="up" blur>
        <div className="relative mb-10 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
          {/* Calm depth — radial glow behind the heading, never on top of content */}
          <div
            className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

          <div className="grid md:grid-cols-[1fr_auto] items-end gap-6">
            <div className="min-w-0">
              <HeroEyebrow currentTime={currentTime} />
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
                Operational <span className="text-gradient">Command Center.</span>
              </h1>
              <p className="text-dim-paragraph text-[15px] max-w-2xl leading-relaxed">
                One canonical view of every source, finding, plan, and execution. <span className="dim-1">Agent reasoning is auditable. Every action is approval-gated. Execution is disabled by default.</span>
              </p>
            </div>
            <HeroStateRibbon />
          </div>
        </div>
      </Reveal>

      {/* Welcome card for fresh tenants — replaces noisy KPIs/demo links until
          the first connector lands. Goal: calm, one clear next step. */}
      {isFreshTenant && (
        <Reveal direction="up" delay={0.03}>
          <div className="mb-8">
            <TenantEmptyState
              icon={SparklesIcon}
              tone="violet"
              eyebrow={`Welcome — let's get you to value`}
              title="Connect a cloud and AGI takes the first action for you."
              description="Pick AWS, Azure, or GCP. Axiom validates the credential, runs the first inventory, surfaces the highest-confidence wins, and assembles your audit story — all before you finish your coffee."
              agiNote="No SDKs to install, no agents to deploy. One click connects the source, and the loop starts producing real recommendations within minutes."
              actions={[
                { href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" },
                { href: "/operator/onboarding", label: "Open guided setup", variant: "ghost" },
              ]}
            />
          </div>
        </Reveal>
      )}

      {/* KPI row — real values from /api/axiom-os/state, no fabricated dollar savings */}
      {!isFreshTenant && <LiveKpiRow />}

      {/* Demo journey card — entry into the canonical 7-step AWS narrative */}
      {!isFreshTenant && (
        <Reveal direction="up" delay={0.04}>
          <DemoJourneyCard />
        </Reveal>
      )}

      {/* Axiom OS strip — unified product state from /api/axiom-os/state */}
      <Reveal direction="up" delay={0.045}>
        <AxiomOSStrip />
      </Reveal>

      {/* Production-readiness strip — canonical /api/readiness consumer */}
      <Reveal direction="up" delay={0.05}>
        <ReadinessStrip />
      </Reveal>

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

      {/* Operating Graph — every connected production node */}
      <Reveal direction="up" delay={0.09}>
        <div className="mb-6">
          <OperatingGraphPanel
            title="Operating Graph"
            subtitle="Every production node, every relationship. Pure read-only projection over canonical state — the graph never executes."
          />
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
          {/* Provider Health — real provider posture from /api/axiom-os/state */}
          <Reveal direction="up" delay={0.1}>
            <LiveProvidersStrip />
          </Reveal>

          {/* Pending Approvals — live fetch from /api/orchestration/approvals */}
          <Reveal direction="up" delay={0.15}>
            <LivePendingApprovals />
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

          {/* Agent status — honest values from canonical AxiomOSState */}
          <Reveal direction="up" delay={0.25}>
            <LiveAgentStatusPanel />
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
// Executive summary banner — honest values from canonical AxiomOSState. No
// fabricated dollar savings, no fabricated confidence percentages, no fake
// "this week" event counts. Surfaces the same shape as before (opener +
// 3 highlights + next-action) but every value is read from a real source.
// ---------------------------------------------------------------------------

function ExecutiveSummaryBanner() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const liveProviders = state?.providers?.filter((p) => p.mode === "live").length ?? 0;
  const totalProviders = state?.providers?.length ?? 0;
  const blockers = state?.criticalBlockers ?? [];
  const limitations = state?.limitations ?? [];
  const pendingApprovals = state?.approvalPosture?.data?.pendingCount ?? 0;
  const topAction = state?.nextBestActions?.[0];
  const readinessPct = state ? Math.round(state.readinessScore * 100) : null;
  const trustPct = state ? Math.round(state.trustScore * 100) : null;
  const sourceMode = state?.sourceMode ?? "preview";

  const opener = state
    ? `${liveProviders}/${totalProviders} providers live · ${pendingApprovals} pending approvals · readiness ${readinessPct ?? "—"}% · trust ${trustPct ?? "—"}%.`
    : loading
      ? "Composing operator summary from canonical state…"
      : "Sign in to load canonical operator summary.";

  const highlights: { headline: string; detail: string; severity: "success" | "warning" | "info"; link: { label: string; href: string } }[] = [];
  if (state) {
    highlights.push({
      headline: blockers.length === 0 ? "No critical blockers" : `${blockers.length} critical blocker${blockers.length === 1 ? "" : "s"}`,
      detail: blockers.length === 0 ? "All canonical sections report green for the current source mode." : `${blockers[0].area}: ${blockers[0].reason}`,
      severity: blockers.length === 0 ? "success" : "warning",
      link: { label: blockers.length === 0 ? "Open Axiom OS" : "Resolve blocker", href: blockers[0]?.safeNextAction?.href ?? "/dashboard" },
    });
    highlights.push({
      headline: `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} awaiting operator`,
      detail: pendingApprovals === 0 ? "Approval queue is empty — agent has no proposed changes pending." : "Open the approval center to review change summaries, blast radius, and rollback plans.",
      severity: pendingApprovals > 0 ? "warning" : "info",
      link: { label: "Open approvals", href: "/dashboard/approvals" },
    });
    highlights.push({
      headline: `Source mode: ${sourceMode.replace(/_/g, " ")}`,
      detail: limitations[0] ?? "Every section reports its source honestly — no live claims without backing.",
      severity: sourceMode === "live" ? "success" : "info",
      link: { label: "Why?", href: "/docs/architecture#source-modes" },
    });
  }

  const recommended = topAction?.title ?? (state ? "All next-best actions complete — agent is idle." : "—");
  const recommendedHref = topAction?.route ?? "/dashboard";

  return (
    <div className="mb-6 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-fuchsia-500/[0.03] p-5 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <CpuChipIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Executive summary</p>
          <span className="text-[9px] font-semibold text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-1.5 py-px uppercase tracking-wider">
            from /api/axiom-os/state
          </span>
        </div>
        <p className="text-sm font-semibold text-white mb-4 leading-relaxed">{opener}</p>
        {highlights.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
            {highlights.map((h, i) => {
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
        )}
        <Link href={recommendedHref} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors group">
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Next best action:</span>
          <span className="text-zinc-300 group-hover:text-white transition-colors">{recommended}</span>
          <ArrowRightIcon className="h-3 w-3 text-zinc-600 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </div>
  );
}

interface ReadinessReportLite {
  overallScore: number;
  generatedAt: string;
  categoryScores: { category: string; score: number; total: number; passing: number; partial: number; preview: number; failing: number; blocked: number }[];
  criticalFailures: { id: string; title: string; nextFix?: string }[];
  recommendedNextFixes: { id: string; title: string; reason: string; href?: string }[];
}

// ---------------------------------------------------------------------------
// DemoJourneyCard — entry into the canonical 7-step AWS demo journey at
// /dashboard/aws. Renders the current step count + AWS provider mode so
// the operator can pick up wherever they left off. Pulls only what is
// needed from canonical state.
// ---------------------------------------------------------------------------

function DemoJourneyCard() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const aws = state?.providers.find((p) => p.provider === "aws");
  const awsLoop = state?.operatingLoops.find((l) => l.provider === "aws");
  const awsMode = aws?.mode ?? "preview";

  // Compute step completion (mirrors the JourneyTimeline logic at a glance).
  let stepsDone = 0;
  if (state) {
    if (aws?.mode === "live") stepsDone++;
    if (awsLoop?.status === "completed") stepsDone++;
    if (state.securityPosture.data.criticalCount === 0 && state.securityPosture.data.highCount === 0) stepsDone++;
    if (state.remediationPosture.data.candidateCount > 0) stepsDone++;
    if (state.approvalPosture.data.pendingCount === 0 && state.approvalPosture.data.expiredCount === 0) stepsDone++;
    if (state.desktopPosture.data.pairedSessions > 0) stepsDone++;
    if (state.evidencePosture.data.verifiedRecords > 0) stepsDone++;
  }

  const tone =
    awsMode === "live"         ? { border: "border-emerald-500/[0.22]", bg: "from-emerald-500/[0.06] via-white/[0.015] to-transparent", text: "text-emerald-300", dot: "bg-emerald-400 animate-pulse" } :
    awsMode === "partial_live" ? { border: "border-cyan-500/[0.22]",    bg: "from-cyan-500/[0.06] via-white/[0.015] to-transparent",    text: "text-cyan-300",    dot: "bg-cyan-400 animate-pulse"    } :
    awsMode === "blocked"      ? { border: "border-rose-500/[0.22]",    bg: "from-rose-500/[0.06] via-white/[0.015] to-transparent",    text: "text-rose-300",    dot: "bg-rose-400"                  } :
                                  { border: "border-amber-500/[0.18]",  bg: "from-amber-500/[0.06] via-white/[0.015] to-transparent",   text: "text-amber-300",   dot: "bg-amber-400"                 };

  return (
    <Link
      href="/dashboard/aws"
      className={`group block rounded-2xl border ${tone.border} bg-gradient-to-br ${tone.bg} p-5 mb-6 relative overflow-hidden hover:-translate-y-0.5 transition-all`}
    >
      <div
        className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px 200px at 90% 0%, rgba(99,102,241,0.08), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${tone.text}`}>AWS demo journey · {awsMode.replace(/_/g, " ")}</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {state ? `${stepsDone}/7 steps complete` : "composing…"}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-1">
            Connect → Scan → Find → Remediate → Approve → Review → Evidence
          </h2>
          <p className="text-[12.5px] text-zinc-400 leading-relaxed">
            One canonical 7-step narrative. Every step reads from /api/axiom-os/state and shows real status, sourceMode, and safe-next-action.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Mini-step indicators */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${i < stepsDone ? "bg-emerald-400" : "bg-white/[0.08]"}`}
              />
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 group-hover:text-white border border-white/[0.08] group-hover:border-white/[0.2] rounded-md px-3 py-1.5 transition-colors">
            Open journey
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// HeroEyebrow — honest source-mode pill driven by /api/axiom-os/state. Never
// claims "Live · Agent operational" unconditionally. Falls back to a calm
// "preview" pill until canonical state arrives.
// ---------------------------------------------------------------------------

function HeroEyebrow({ currentTime }: { currentTime: string }) {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const sourceMode = state?.sourceMode ?? "preview";
  const tone =
    sourceMode === "live"           ? { dot: "bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.5)]", text: "text-emerald-300", pill: "border-emerald-500/[0.25]" } :
    sourceMode === "partial_live"   ? { dot: "bg-cyan-400 animate-pulse",     text: "text-cyan-300",    pill: "border-cyan-500/[0.25]"    } :
    sourceMode === "expanding"      ? { dot: "bg-amber-400 animate-pulse",    text: "text-amber-300",   pill: "border-amber-500/[0.25]"   } :
    sourceMode === "blocked"        ? { dot: "bg-rose-400",                   text: "text-rose-300",    pill: "border-rose-500/[0.25]"    } :
    sourceMode === "disabled"       ? { dot: "bg-zinc-600",                   text: "text-zinc-400",    pill: "border-zinc-700/40"        } :
                                      { dot: "bg-amber-400",                  text: "text-amber-300",   pill: "border-amber-500/[0.18]"   };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className={`inline-flex items-center gap-2 rounded-full border ${tone.pill} bg-white/[0.02] px-2.5 py-1`}>
        <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${tone.text}`}>
          {sourceMode === "live" ? "Live · canonical state" :
           sourceMode === "partial_live" ? "Partial · live signals" :
           sourceMode === "expanding" ? "Expanding · adapter foundation" :
           sourceMode === "blocked" ? "Blocked · operator action required" :
           sourceMode === "disabled" ? "Disabled" :
           "Preview · awaiting provider connect"}
        </span>
      </span>
      <span className="text-[10px] font-mono text-zinc-500">{currentTime || "—:—:—"} local</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroStateRibbon — premium readiness / trust / safety stat trio. All values
// derived from canonical state. Safety is a literal — never derived.
// ---------------------------------------------------------------------------

function HeroStateRibbon() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const readinessPct = state ? Math.round(state.readinessScore * 100) : null;
  const trustPct = state ? Math.round(state.trustScore * 100) : null;

  const RibbonStat = ({ label, value, tone }: { label: string; value: string; tone: string }) => (
    <div className="text-right min-w-[5rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );

  return (
    <div className="hidden md:flex items-end gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
      <RibbonStat label="Readiness" value={readinessPct !== null ? `${readinessPct}%` : "—"} tone="text-white" />
      <div className="w-px h-9 bg-white/[0.08]" />
      <RibbonStat label="Trust" value={trustPct !== null ? `${trustPct}%` : "—"} tone="text-white" />
      <div className="w-px h-9 bg-white/[0.08]" />
      <div className="text-right min-w-[8rem]">
        <p className="text-[12px] font-semibold leading-none text-emerald-300">Approval-gated</p>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">Safety</p>
      </div>
    </div>
  );
}

/** Client-driven KPI strip — consumes /api/axiom-os/state. Replaces the
 *  prior static KPIs array which had fabricated dollar-savings claims. */
function LiveKpiRow() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Honest values: never fabricate "$12,840 cost saved".
  const liveProviders = state?.providers?.filter((p) => p.mode === "live").length ?? 0;
  const totalProviders = state?.providers?.length ?? 0;
  const nextActions = state?.nextBestActions?.length ?? 0;
  const blockers = state?.criticalBlockers?.length ?? 0;
  const sourceMode = state?.sourceMode ?? "preview";

  const tiles: { label: string; value: string; trend?: string; icon: typeof BoltIcon; iconClass: string; bgClass: string }[] = [
    {
      label: "Live providers",
      value: state ? `${liveProviders} / ${totalProviders}` : (loading ? "…" : "—"),
      trend: state ? (liveProviders > 0 ? `${sourceMode}` : "configure a provider") : undefined,
      icon: CloudIcon,
      iconClass: "text-cyan-400",
      bgClass: "bg-cyan-500/10 border-cyan-500/20",
    },
    {
      label: "Next safe actions",
      value: state ? String(nextActions) : (loading ? "…" : "—"),
      trend: nextActions > 0 ? "ready for operator" : undefined,
      icon: BoltIcon,
      iconClass: "text-violet-400",
      bgClass: "bg-violet-500/10 border-violet-500/20",
    },
    {
      label: "Critical blockers",
      value: state ? String(blockers) : (loading ? "…" : "—"),
      trend: blockers > 0 ? "needs attention" : "none",
      icon: ShieldExclamationIcon,
      iconClass: blockers > 0 ? "text-rose-400" : "text-emerald-400",
      bgClass: blockers > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Safety status",
      value: "Read-only · approval-gated",
      trend: "execution disabled by default",
      icon: ShieldCheckIcon,
      iconClass: "text-emerald-400",
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {tiles.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${kpi.bgClass} border flex items-center justify-center`}>
                <Icon className={`h-4.5 w-4.5 ${kpi.iconClass}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-white tracking-tight mb-1">{kpi.value}</p>
            <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
            {kpi.trend && (
              <p className="text-[10px] mt-2 font-medium text-zinc-400">{kpi.trend}</p>
            )}
          </div>
        );
      })}
    </Stagger>
  );
}

interface AxiomOSStateLite {
  overallStatus: string;
  sourceMode: string;
  readinessScore: number;
  trustScore: number;
  safetyStatus: string;
  generatedAt: string;
  providers: {
    provider: string;
    mode: string;
    headline: string;
    connectionStatus: string;
    missingRequirements: string[];
    resourceCount?: number;
    findingCount?: number;
    remediationCount?: number;
    lastScannedAt?: string;
    safeNextAction?: { label: string; href: string };
  }[];
  operatingLoops: {
    provider: string;
    currentStage: string;
    status: string;
    sourceMode: string;
    attentionRequiredCount: number;
  }[];
  securityPosture: {
    status: string;
    sourceMode: string;
    data: {
      totalFindings: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      compoundedRiskCount: number;
      affectedSystems: string[];
    };
    limitations: string[];
  };
  desktopPosture: {
    status: string;
    sourceMode: string;
    data: {
      binaryAvailable: boolean;
      signingStatus: string;
      pairedSessions: number;
      localExecutionDisabled: true;
    };
    limitations: string[];
  };
  evidencePosture: {
    status: string;
    sourceMode: string;
    data: { totalRecords: number; verifiedRecords: number; coverageScore: number };
    limitations: string[];
  };
  approvalPosture: {
    status: string;
    sourceMode: string;
    data: { pendingCount: number; highRiskCount: number; expiredCount: number };
    limitations: string[];
  };
  remediationPosture: {
    status: string;
    sourceMode: string;
    data: { candidateCount: number; simulatedCount: number; approvalGatedCount: number; desktopReviewEligibleCount: number };
    limitations: string[];
  };
  auditPosture: {
    status: string;
    sourceMode: string;
    data: { recentEventCount: number; persistent: boolean };
    limitations: string[];
  };
  memoryPosture: {
    status: string;
    sourceMode: string;
    data: { recordCount: number; persistent: boolean };
    limitations: string[];
  };
  nextBestActions: { id: string; title: string; description: string; category: string; route?: string }[];
  criticalBlockers: { area: string; reason: string; safeNextAction?: { label: string; href: string } }[];
  limitations: string[];
}

interface ApprovalRequestLite {
  id: string;
  provider: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  changeSummary: string;
  status: string;
  blastRadius?: string;
  expiresAt: string;
  affectedResources?: string[];
}

function AxiomOSStrip() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Axiom OS state unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// axiom os</p>
        <p className="text-sm text-zinc-400 mt-2">Composing unified product state…</p>
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="rounded-xl border border-zinc-700/30 bg-white/[0.02] p-5 mb-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// axiom os · preview</p>
        <p className="text-sm text-zinc-400 mt-2">{error ?? "Sign in to load unified state."}</p>
      </div>
    );
  }

  const readinessPct = Math.round(state.readinessScore * 100);
  const trustPct = Math.round(state.trustScore * 100);
  const tone =
    state.overallStatus === "all_systems_live" ? "emerald" :
    state.overallStatus === "partial_live"     ? "cyan"    :
    state.overallStatus === "preview_mode"     ? "amber"   :
    state.overallStatus === "blocked"          ? "rose"    : "zinc";
  const toneClasses: Record<string, { border: string; bg: string; text: string; pill: string }> = {
    emerald: { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.05]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300" },
    cyan:    { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.05]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300"    },
    amber:   { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.05]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300"   },
    rose:    { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.05]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300"    },
    zinc:    { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-300",    pill: "bg-zinc-700/40 text-zinc-300"     },
  };
  const t = toneClasses[tone];
  const statusLabel = state.overallStatus.replace(/_/g, " ");

  const providerToneOf = (mode: string): string =>
    mode === "live" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" :
    mode === "partial_live" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" :
    mode === "preview" || mode === "expanding" ? "bg-amber-500/15 text-amber-300 border-amber-500/20" :
    "bg-zinc-700/40 text-zinc-400 border-zinc-700/30";

  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-5 mb-6`}>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// axiom os</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={`text-2xl font-bold tracking-tight ${t.text} capitalize`}>{statusLabel}</span>
            <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${t.pill}`}>
              {state.sourceMode}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              · last sync {new Date(state.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5">{state.safetyStatus.replace(/_/g, " ")}</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className={`text-2xl font-bold ${t.text}`}>{readinessPct}%</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Readiness</p>
          </div>
          <div className="w-px h-10 bg-white/[0.06]" />
          <div>
            <p className={`text-2xl font-bold ${t.text}`}>{trustPct}%</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Trust</p>
          </div>
        </div>
      </div>

      {/* Provider chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {state.providers.map((p) => (
          <Link
            key={p.provider}
            href={p.safeNextAction?.href ?? "#"}
            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono uppercase tracking-wider ${providerToneOf(p.mode)} hover:brightness-110 transition`}
          >
            <span className="font-semibold">{p.provider}</span>
            <span className="opacity-70">·</span>
            <span className="opacity-90">{p.mode.replace(/_/g, " ")}</span>
          </Link>
        ))}
      </div>

      {/* Critical blockers */}
      {state.criticalBlockers.length > 0 && (
        <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-2 mb-3">
          <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-[0.18em] mb-1">
            // {state.criticalBlockers.length} critical blocker{state.criticalBlockers.length === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-rose-200/90">
            {state.criticalBlockers[0].area}: {state.criticalBlockers[0].reason}
          </p>
        </div>
      )}

      {/* Next best actions */}
      {state.nextBestActions.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// next best actions</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {state.nextBestActions.slice(0, 4).map((a) => (
              <Link
                key={a.id}
                href={a.route ?? "#"}
                className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition"
              >
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{a.title}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadinessStrip() {
  const [report, setReport] = useState<ReadinessReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/readiness", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReadinessReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) {
          setReport(json.data);
        } else {
          setError(json.error?.userMessage ?? "Readiness report unavailable.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// production readiness</p>
        <p className="text-sm text-zinc-400 mt-2">Composing readiness report…</p>
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="rounded-xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
        <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em]">// production readiness · preview</p>
        <p className="text-sm text-amber-200/80 mt-2">{error ?? "Readiness report not yet available — sign in to load."}</p>
      </div>
    );
  }

  const pct = Math.round(report.overallScore * 100);
  const tone = pct >= 80 ? "emerald" : pct >= 60 ? "cyan" : pct >= 40 ? "amber" : "rose";
  const toneClasses: Record<string, { border: string; bg: string; text: string }> = {
    emerald: { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.06]", text: "text-emerald-300" },
    cyan:    { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.06]",    text: "text-cyan-300"    },
    amber:   { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.06]",   text: "text-amber-300"   },
    rose:    { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.06]",    text: "text-rose-300"    },
  };
  const t = toneClasses[tone];

  const totalsRollup = report.categoryScores.reduce(
    (acc, c) => ({
      passing: acc.passing + c.passing,
      partial: acc.partial + c.partial,
      preview: acc.preview + c.preview,
      blocked: acc.blocked + c.blocked,
      failing: acc.failing + c.failing,
    }),
    { passing: 0, partial: 0, preview: 0, blocked: 0, failing: 0 },
  );

  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-5 mb-6`}>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// production readiness</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className={`text-3xl font-bold tracking-tight ${t.text}`}>{pct}%</span>
            <span className="text-xs text-zinc-500 font-mono">
              {report.categoryScores.length} categories · last sync {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
          <span className="text-emerald-400">{totalsRollup.passing} pass</span>
          <span className="text-cyan-400">{totalsRollup.partial} partial</span>
          <span className="text-zinc-400">{totalsRollup.preview} preview</span>
          <span className="text-amber-400">{totalsRollup.blocked} blocked</span>
          <span className="text-rose-400">{totalsRollup.failing} failing</span>
        </div>
      </div>

      {report.criticalFailures.length > 0 && (
        <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-2 mb-3">
          <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-[0.18em] mb-1">
            // {report.criticalFailures.length} critical failure{report.criticalFailures.length === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-rose-200/90 truncate">{report.criticalFailures[0].title}</p>
        </div>
      )}

      {report.recommendedNextFixes.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// next focused fixes</p>
          <ul className="space-y-1.5">
            {report.recommendedNextFixes.slice(0, 3).map((fix) => (
              <li key={fix.id} className="flex items-start gap-2 text-[12px]">
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-zinc-200">{fix.title}</span>
                  <span className="text-zinc-500"> — {fix.reason}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SecurityPostureStrip() {
  // Canonical security posture from /api/axiom-os/state. Replaces a panel
  // that called buildSecurityPosture() with hardcoded demo inputs
  // (policyBlocks30d: 2, openHighRiskFindings: 1). Honest stats only.
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const sec = state?.securityPosture;
  const desk = state?.desktopPosture;
  const totalFindings = sec?.data.totalFindings ?? 0;
  const criticalCount = sec?.data.criticalCount ?? 0;
  const highCount = sec?.data.highCount ?? 0;
  const compoundedRiskCount = sec?.data.compoundedRiskCount ?? 0;
  const sourceMode = sec?.sourceMode ?? "preview";

  const semantic: "success" | "warning" | "error" =
    !state ? "warning" :
    (criticalCount > 0 || highCount > 2) ? "error" :
    (highCount > 0 || totalFindings > 5)  ? "warning" :
                                             "success";

  const tone =
    semantic === "success" ? "border-emerald-500/15 bg-emerald-500/[0.03]" :
    semantic === "warning" ? "border-amber-500/15 bg-amber-500/[0.03]"   :
                             "border-rose-500/15 bg-rose-500/[0.03]";

  const headline =
    !state ? "Composing security posture…" :
    criticalCount > 0 ? `${criticalCount} critical finding${criticalCount === 1 ? "" : "s"} require operator attention` :
    highCount > 0     ? `${highCount} high-risk finding${highCount === 1 ? "" : "s"} pending review` :
    totalFindings > 0 ? `${totalFindings} finding${totalFindings === 1 ? "" : "s"} from canonical scanners` :
                        "No high-risk findings — security baseline holding";

  const labelTone =
    sourceMode === "live" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    sourceMode === "partial_live" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" :
    "bg-amber-500/15 text-amber-300 border-amber-500/30";

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
              <span className={`text-[9px] font-semibold ${labelTone} border rounded-full px-1.5 py-px uppercase tracking-wider`}>
                {sourceMode.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{headline}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              {sec?.limitations[0] ?? "Findings emitted by the canonical scanner — every finding carries evidence or a limitation."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Stat label="Findings" value={state ? String(totalFindings) : "—"} />
            <Stat label="Critical" value={state ? String(criticalCount) : "—"} />
            <Stat label="Compound" value={state ? String(compoundedRiskCount) : "—"} />
            <Stat label="Desktops" value={state ? String(desk?.data.pairedSessions ?? 0) : "—"} />
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
  // Canonical reliability rollup — derived from operatingLoops + critical
  // blockers + provider modes in AxiomOSState. Replaces a panel that called
  // buildReliabilityPosture() with hardcoded { retryingJobs: 3,
  // successfulRetries24h: 17, rateLimitPauses24h: 4 } demo values.
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Health is a function of: how many operating loops are non-failed +
  // how many providers are connected vs blocked + how many critical
  // blockers exist. No fabricated retry counts.
  const loops = state?.operatingLoops ?? [];
  const providers = state?.providers ?? [];
  const blockers = state?.criticalBlockers ?? [];

  const totalLoops = loops.length;
  const failedLoops = loops.filter((l) => l.status === "failed" || l.status === "blocked").length;
  const pausedLoops = loops.filter((l) => l.status === "paused_for_approval" || l.status === "paused_for_user_input").length;
  const inProgressLoops = loops.filter((l) => l.status === "in_progress").length;
  const completedLoops = loops.filter((l) => l.status === "completed").length;
  const connectedProviders = providers.filter((p) => p.mode === "live" || p.mode === "partial_live").length;
  const totalProviders = providers.length;

  const semantic: "success" | "warning" | "error" =
    !state ? "warning" :
    (failedLoops > 0 || blockers.length > 0) ? "error" :
    (pausedLoops > 0 || (totalProviders > 0 && connectedProviders === 0)) ? "warning" :
                                                                              "success";

  const tone =
    semantic === "success" ? "border-cyan-500/15 bg-cyan-500/[0.03]" :
    semantic === "warning" ? "border-amber-500/15 bg-amber-500/[0.03]" :
                             "border-rose-500/15 bg-rose-500/[0.03]";

  const headline =
    !state ? "Composing reliability rollup…" :
    failedLoops > 0      ? `${failedLoops} operating loop${failedLoops === 1 ? "" : "s"} failed — operator attention required` :
    blockers.length > 0  ? `${blockers.length} critical blocker${blockers.length === 1 ? "" : "s"} across providers` :
    pausedLoops > 0      ? `${pausedLoops} loop${pausedLoops === 1 ? "" : "s"} paused for approval / operator input` :
    inProgressLoops > 0  ? `${inProgressLoops} loop${inProgressLoops === 1 ? "" : "s"} in progress · ${completedLoops} completed` :
                           "All operating loops idle · no failed states";

  const sourceMode = state?.sourceMode ?? "preview";
  const labelTone =
    sourceMode === "live"         ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    sourceMode === "partial_live" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" :
    sourceMode === "blocked"      ? "bg-rose-500/15 text-rose-300 border-rose-500/30" :
    "bg-amber-500/15 text-amber-300 border-amber-500/30";

  return (
    <Link href="/dashboard/multi-cloud" className={`block rounded-2xl border ${tone} p-5 hover:border-cyan-500/30 transition-colors group`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <SignalIcon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">Reliability posture</p>
              <span className={`text-[9px] font-semibold ${labelTone} border rounded-full px-1.5 py-px uppercase tracking-wider`}>
                {sourceMode.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{headline}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              Derived from {totalLoops} operating loop{totalLoops === 1 ? "" : "s"} · {connectedProviders}/{totalProviders} providers connected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Stat label="In prog." value={state ? String(inProgressLoops) : "—"} />
            <Stat label="Paused" value={state ? String(pausedLoops) : "—"} />
            <Stat label="Failed" value={state ? String(failedLoops) : "—"} />
            <Stat label="Blockers" value={state ? String(blockers.length) : "—"} />
          </div>
          <ArrowRightIcon className="h-4 w-4 text-zinc-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function ObservabilityPostureStrip() {
  // Fetch canonical audit + memory posture so we never render fabricated
  // "287 traces / 612 audit / 4 bundles" demo numbers. When state is
  // unavailable we render honest dashes — not invented counts.
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const auditCount = state?.auditPosture?.data.recentEventCount;
  const memoryCount = state?.memoryPosture?.data.recordCount;
  const persistent = state?.auditPosture?.data.persistent ?? false;
  const sourceMode = state?.auditPosture?.sourceMode ?? "preview";

  const posture = buildObservabilityPosture({
    source: sourceMode === "live" ? "live" : "preview",
    traces24h: auditCount ?? 0,
    auditRecords24h: auditCount ?? 0,
    bundlesExported30d: 0,
    loggerActive: true,
    auditStoreConfigured: persistent,
    copilotAuditActive: persistent,
  });
  const errors = posture.checks.filter((c) => c.semantic === "error").length;
  const warnings = posture.checks.filter((c) => c.semantic === "warning").length;
  const tone =
    errors > 0   ? "border-rose-500/15 bg-rose-500/[0.03]"   :
    warnings > 0 ? "border-amber-500/15 bg-amber-500/[0.03]" :
                   "border-violet-500/15 bg-violet-500/[0.03]";
  const headlineCheck =
    posture.checks.find((c) => c.semantic === "error") ??
    posture.checks.find((c) => c.semantic === "warning") ??
    posture.checks[0];
  const headline = state
    ? (persistent ? "Audit + memory persistent · every event traceable" : "Audit + memory in-memory · enable persistence for durability")
    : (headlineCheck?.label ?? "Composing observability state…");
  const labelTone = persistent ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30";
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
              <span className={`text-[9px] font-semibold ${labelTone} border rounded-full px-1.5 py-px uppercase tracking-wider`}>
                {sourceMode.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{headline}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{headlineCheck?.detail ?? "Audit + memory + trace stores feed every operator view."}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Stat label="Audit events" value={typeof auditCount === "number" ? String(auditCount) : "—"} />
            <Stat label="Memory" value={typeof memoryCount === "number" ? String(memoryCount) : "—"} />
            <Stat label="Persistence" value={state ? (persistent ? "on" : "off") : "—"} />
          </div>
          <ArrowRightIcon className="h-4 w-4 text-zinc-500 group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// DesktopRuntimePanel — wired to /api/desktop/platform-status. Replaces
// a panel that rendered DEFAULT_DESKTOP_SHELL_STATE regardless of real
// session/platform/signing state. Honest checklist derived from the
// canonical DesktopState (sessionStatus / sourceMode / platformStatus /
// auditSyncStatus / localExecutionStatus). Local execution is enforced
// to "disabled" by the literal type on DesktopState.
// ---------------------------------------------------------------------------

interface DesktopStateLite {
  tenantId: string;
  generatedAt: string;
  platform: string;
  appVersion?: string;
  sessionStatus: "active" | "expired" | "not_paired";
  sourceMode: "live" | "partial_live" | "preview" | "blocked" | "unknown";
  handoffInboxCount: number;
  reviewItemCount: number;
  platformStatus: { platform: string; signed: boolean; notarized?: boolean; publiclyDownloadable: boolean; label: string }[];
  auditSyncStatus: "live" | "preview" | "disabled";
  syncStatus: "synced" | "stale" | "not_synced";
  localExecutionStatus: "disabled";
  limitations: string[];
  safeNextAction?: { label: string; href: string };
}

function DesktopRuntimePanel() {
  const [state, setState] = useState<DesktopStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/platform-status", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: DesktopStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Desktop state unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Derive an honest checklist from canonical state. Each row's semantic is
  // a function of real fields — never hardcoded.
  const checks: { id: string; label: string; detail: string; semantic: "success" | "warning" | "error" | "info" }[] = [];
  if (state) {
    checks.push({
      id: "session",
      label: state.sessionStatus === "active" ? "Desktop session paired" : state.sessionStatus === "expired" ? "Session expired" : "No paired desktop",
      detail: state.sessionStatus === "active"
        ? `Platform: ${state.platform} · v${state.appVersion ?? "—"}`
        : "Pair from desktop Settings to enable plan review.",
      semantic: state.sessionStatus === "active" ? "success" : state.sessionStatus === "expired" ? "warning" : "info",
    });
    checks.push({
      id: "local-exec",
      label: "Local execution",
      detail: "Disabled by safety contract — desktop is a review workstation, never an executor.",
      semantic: "success",
    });
    const macArm = state.platformStatus.find((p) => p.platform === "macos-arm");
    const windows = state.platformStatus.find((p) => p.platform === "windows");
    if (macArm) {
      checks.push({
        id: "macos",
        label: `macOS · ${macArm.signed ? "signed" : "unsigned"}${macArm.notarized ? " + notarized" : ""}`,
        detail: macArm.publiclyDownloadable ? "Public download enabled." : "Public binary not yet published.",
        semantic: macArm.publiclyDownloadable ? "success" : "warning",
      });
    }
    if (windows) {
      checks.push({
        id: "windows",
        label: `Windows · ${windows.signed ? "signed" : "unsigned"}`,
        detail: windows.publiclyDownloadable ? "Public download enabled." : "EV cert required to clear SmartScreen.",
        semantic: windows.publiclyDownloadable ? "success" : "info",
      });
    }
    checks.push({
      id: "audit-sync",
      label: `Audit sync · ${state.auditSyncStatus}`,
      detail: state.auditSyncStatus === "live" ? "Desktop ↔ web audit reconciliation is live." : "Audit reconciliation runs in preview until persistence is enabled.",
      semantic: state.auditSyncStatus === "live" ? "success" : "info",
    });
  }

  const sourceMode = state?.sourceMode ?? "preview";
  const sourceTone =
    sourceMode === "live"         ? "bg-emerald-500/15 text-emerald-300" :
    sourceMode === "partial_live" ? "bg-cyan-500/15 text-cyan-300"       :
    sourceMode === "blocked"      ? "bg-rose-500/15 text-rose-300"       :
                                    "bg-amber-500/15 text-amber-300";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ComputerDesktopIcon className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-white">Desktop runtime</h3>
          <span className={`text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-px ${sourceTone}`}>
            {sourceMode.replace(/_/g, " ")}
          </span>
        </div>
        <Link href="/download" className="text-[10px] text-zinc-500 hover:text-white transition-colors">View</Link>
      </div>
      <div className="px-4 py-3 border-b border-white/[0.04]">
        {loading && (
          <p className="text-[11px] text-zinc-500 font-mono uppercase tracking-[0.18em]">// composing desktop state…</p>
        )}
        {!loading && error && (
          <p className="text-[12px] text-amber-300/90">{error}</p>
        )}
        {!loading && !error && state && (
          <>
            <p className="text-[12px] text-zinc-200 font-semibold">
              {state.sessionStatus === "active"
                ? `Paired · ${state.handoffInboxCount} handoff${state.handoffInboxCount === 1 ? "" : "s"} · ${state.reviewItemCount} review item${state.reviewItemCount === 1 ? "" : "s"}`
                : "No paired desktop"}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              {state.sessionStatus === "active"
                ? `Last sync ${new Date(state.generatedAt).toLocaleTimeString()}`
                : "Download the binary to enable plan review."}
            </p>
          </>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        {!loading && checks.slice(0, 4).map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
              c.semantic === "success" ? "bg-emerald-400" :
              c.semantic === "warning" ? "bg-amber-400" :
              c.semantic === "error"   ? "bg-rose-400"   :
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
        <Link
          href={state?.safeNextAction?.href ?? "/download"}
          className="flex-1 text-center text-[11px] font-semibold text-violet-300 hover:text-violet-200 rounded-md border border-violet-500/20 bg-violet-500/[0.06] hover:border-violet-500/40 px-2 py-1.5 transition-colors"
        >
          {state?.safeNextAction?.label ?? "Download desktop"}
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
  // Derive OnboardingObservations from canonical AxiomOSState. Replaces the
  // prior hardcoded { providerSelected: true, scansStarted: 1, ... } stub.
  // Honest defaults until real per-tenant observation aggregators ship.
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingState(false); });
    return () => { cancelled = true; };
  }, []);

  const providers = state?.providers ?? [];
  const liveProviders = providers.filter((p) => p.mode === "live");
  const submittedProviders = providers.filter((p) => p.connectionStatus !== "blocked");
  const operatingLoops = state?.operatingLoops ?? [];
  const completedOrRunning = operatingLoops.filter((l) => l.status === "completed" || l.status === "in_progress").length;
  const approvalCount = state?.approvalPosture?.data.pendingCount ?? 0;
  const evidenceRecords = state?.evidencePosture?.data.totalRecords ?? 0;
  const auditPersistent = state?.auditPosture?.data.persistent ?? false;

  const progress: OnboardingProgress = assessOnboarding({
    hasAccount: true,                                          // operator is signed in to reach this view
    providerSelected: providers.length > 0,                    // canonical: any provider configured
    credentialsSubmitted: submittedProviders.length > 0,       // canonical: any provider not blocked
    credentialsValidated: liveProviders.length > 0,            // canonical: any provider in live mode
    scansStarted: completedOrRunning,                          // canonical: completed + in-progress loops
    snapshotsPersisted: auditPersistent ? completedOrRunning : 0, // honest: 0 unless persistence is on
    recommendationsViewed: 0,                                  // no observation source yet
    plansBuilt: approvalCount,                                 // canonical: pending approvals = plans waiting
    approvalsGranted: 0,                                       // no observation source yet
    plansExecutedOrExported: 0,                                // execution is disabled by safety contract
    auditBundlesExported: evidenceRecords,                     // canonical: evidence record count
  });
  const pct = progressPercent(progress);
  if (loadingState && !state) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing onboarding state…</p>
      </div>
    );
  }
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

// ---------------------------------------------------------------------------
// LiveProvidersStrip — real provider posture from /api/axiom-os/state
//
// Replaces a static demo PROVIDERS array that fabricated AWS account IDs
// (123456789012), resource counts (142), and finding counts (14). This
// component renders **only** what canonical state reports — including the
// honest source mode, real missing-requirements text, and the typed
// safeNextAction. If no providers are connected the panel shows the empty
// state with a Connect provider CTA rather than fake demo data.
// ---------------------------------------------------------------------------

function LiveProvidersStrip() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Provider state unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const providers = state?.providers ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Provider posture</h3>
          <Link href="/dashboard" className="text-[10px] text-zinc-500 hover:text-white transition-colors">View all</Link>
        </div>
      </div>

      {loading && (
        <div className="px-5 py-6 text-[11px] text-zinc-500 font-mono uppercase tracking-[0.18em]">
          // composing provider posture…
        </div>
      )}
      {!loading && error && (
        <div className="px-5 py-4">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">
            // provider state unavailable
          </p>
          <p className="text-[12px] text-zinc-400">{error}</p>
        </div>
      )}
      {!loading && !error && providers.length === 0 && (
        <div className="px-5 py-4">
          <p className="text-[12px] text-zinc-300 font-semibold mb-1">No providers connected yet.</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">Connect a provider to start observing real resources, findings, and remediation candidates.</p>
        </div>
      )}

      {!loading && !error && providers.length > 0 && (
        <div className="p-3 space-y-2">
          {providers.map((p) => {
            const modeTone =
              p.mode === "live"          ? { dot: "bg-emerald-400 animate-pulse",       text: "text-emerald-300",  label: "Live" } :
              p.mode === "partial_live"  ? { dot: "bg-cyan-400 animate-pulse",          text: "text-cyan-300",     label: "Partial · live" } :
              p.mode === "preview"       ? { dot: "bg-amber-400",                       text: "text-amber-300",    label: "Preview" } :
              p.mode === "expanding"     ? { dot: "bg-amber-400 animate-pulse",         text: "text-amber-300",    label: "Expanding" } :
              p.mode === "blocked"       ? { dot: "bg-rose-400",                        text: "text-rose-300",     label: "Blocked" } :
              p.mode === "disabled"      ? { dot: "bg-zinc-600",                        text: "text-zinc-500",     label: "Disabled" } :
                                           { dot: "bg-zinc-600",                        text: "text-zinc-500",     label: "Unknown" };
            const chipKey =
              p.provider === "aws"    ? "AWS"    :
              p.provider === "azure"  ? "Azure"  :
              p.provider === "gcp"    ? "GCP"    :
              p.provider === "github" ? "GitHub" : null;
            const chipClass = chipKey ? PROVIDER_COLOR[chipKey] : "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
            const lastSeen = p.lastScannedAt ? new Date(p.lastScannedAt).toLocaleTimeString() : "—";
            const resources = typeof p.resourceCount === "number" ? p.resourceCount : null;
            const findings = typeof p.findingCount === "number" ? p.findingCount : null;
            const missing = p.missingRequirements?.[0];

            return (
              <div key={p.provider} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-white/[0.08] transition-colors">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${chipClass}`}>
                    {chipKey ?? p.provider}
                  </span>
                  <span className="text-xs font-semibold text-white truncate">{p.headline}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${modeTone.dot}`} />
                    <span className={`font-semibold uppercase tracking-wider ${modeTone.text}`}>{modeTone.label}</span>
                  </div>
                  <span className="text-zinc-500 font-mono">last seen {lastSeen}</span>
                </div>
                {(resources !== null || findings !== null) && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] text-zinc-500">
                      {resources !== null ? `${resources} resources` : "resources —"}
                    </span>
                    <span className={`text-[10px] font-semibold ${findings !== null && findings > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {findings !== null ? `${findings} findings` : "findings —"}
                    </span>
                  </div>
                )}
                {missing && (
                  <p className="mt-2 text-[10px] text-zinc-500 leading-snug">
                    <span className="text-zinc-400 font-semibold">Needs:</span> {missing}
                  </p>
                )}
                {p.safeNextAction && (
                  <Link
                    href={p.safeNextAction.href}
                    className="mt-2 flex items-center justify-between text-[10px] text-zinc-300 hover:text-white rounded-md border border-white/[0.06] hover:border-white/[0.15] bg-white/[0.02] px-2 py-1 transition-colors"
                  >
                    <span className="truncate">{p.safeNextAction.label}</span>
                    <ArrowRightIcon className="h-3 w-3 shrink-0" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="px-3 pb-3">
        <Link
          href="/operator/onboarding"
          className="flex items-center justify-center gap-1.5 w-full text-[11px] text-zinc-400 hover:text-white border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl py-2.5 transition-colors"
        >
          + Connect provider
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LivePendingApprovals — fetches /api/orchestration/approvals and renders
// only pending requests. Replaces a static array of 3 fake AWS approvals
// (IAM policy modification, EC2 right-size with "+$800/mo", EBS delete with
// "+$380/mo") that fabricated dollar savings the platform cannot calculate.
// Honest empty state when the queue is empty.
// ---------------------------------------------------------------------------

function LivePendingApprovals() {
  const [approvals, setApprovals] = useState<ApprovalRequestLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceMode, setSourceMode] = useState<string>("preview");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/orchestration/approvals", { credentials: "include" })
        .then((r) => r.json())
        .then((json: { ok?: boolean; data?: { approvals: ApprovalRequestLite[] }; error?: { userMessage?: string } }) => {
          if (cancelled) return;
          if (json.ok && json.data) setApprovals(json.data.approvals);
          else setError(json.error?.userMessage ?? "Approval queue unavailable.");
        }),
      fetch("/api/axiom-os/state", { credentials: "include" })
        .then((r) => r.json())
        .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
          if (cancelled) return;
          if (json.ok && json.data?.approvalPosture?.sourceMode) setSourceMode(json.data.approvalPosture.sourceMode);
        })
        .catch(() => {}),
    ])
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const pending = (approvals ?? []).filter((a) => a.status === "pending");

  return (
    <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.02] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-amber-500/15 bg-amber-500/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LockClosedIcon className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Pending approvals</h3>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-px">
              {sourceMode.replace(/_/g, " ")}
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px">
            {loading ? "…" : pending.length}
          </span>
        </div>
      </div>

      {loading && (
        <div className="px-5 py-6 text-[11px] text-zinc-500 font-mono uppercase tracking-[0.18em]">
          // composing approval queue…
        </div>
      )}
      {!loading && error && (
        <div className="px-5 py-4">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// queue unavailable</p>
          <p className="text-[12px] text-zinc-400">{error}</p>
        </div>
      )}
      {!loading && !error && pending.length === 0 && (
        <div className="px-5 py-5">
          <p className="text-[12px] text-zinc-300 font-semibold mb-1">Queue is empty.</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            No proposed changes are waiting for operator review. Approvals are created when the agent prepares an execution plan that exceeds your blast-radius policy.
          </p>
        </div>
      )}

      {!loading && !error && pending.length > 0 && (
        <div className="p-3 space-y-2">
          {pending.slice(0, 6).map((a) => {
            const providerKey =
              a.provider === "aws"     ? "AWS" :
              a.provider === "azure"   ? "Azure" :
              a.provider === "gcp"     ? "GCP" :
              a.provider === "github"  ? "GitHub" : null;
            const chipClass = providerKey ? PROVIDER_COLOR[providerKey] : "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
            const riskClass = APPROVAL_RISK[a.riskLevel] ?? APPROVAL_RISK.medium;
            return (
              <Link
                key={a.id}
                href={`/dashboard/approvals?id=${encodeURIComponent(a.id)}`}
                className="block rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-amber-500/20 hover:bg-amber-500/[0.04] transition-all group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${chipClass}`}>
                    {providerKey ?? a.provider}
                  </span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${riskClass}`}>
                    {a.riskLevel} risk
                  </span>
                </div>
                <p className="text-xs text-white font-medium leading-snug mb-1.5 line-clamp-2">{a.changeSummary}</p>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 capitalize">
                    {a.blastRadius ? `${a.blastRadius} blast` : "blast — unknown"}
                  </span>
                  <span className="text-zinc-500 font-mono">
                    expires {new Date(a.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="px-3 pb-3 pt-1">
        <Link
          href="/dashboard/approvals"
          className="flex items-center justify-center gap-1.5 w-full text-[11px] text-zinc-400 hover:text-white border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl py-2 transition-colors"
        >
          Open approval center →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveAgentStatusPanel — replaces the static "0.92 confidence / 1,847 events
// / Learning" agent-status block. Every row is derived from canonical state:
//   - Reasoning loop: in_progress / paused / idle from operatingLoops[]
//   - Audit log:      auditPosture.data.recentEventCount + persistence flag
//   - Memory store:   memoryPosture.data.recordCount + persistence flag
//   - Safety:         literal safetyStatus from AxiomOSState
// No confidence percentage is shown — the platform does not compute one.
// ---------------------------------------------------------------------------

function LiveAgentStatusPanel() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loops = state?.operatingLoops ?? [];
  const inProgress = loops.filter((l) => l.status === "in_progress").length;
  const paused = loops.filter((l) => l.status === "paused_for_approval" || l.status === "paused_for_user_input").length;

  const audit = state?.auditPosture;
  const memory = state?.memoryPosture;

  const rows: { label: string; value: string; tone: "live" | "preview" | "blocked" | "info" }[] = [];
  if (state) {
    rows.push({
      label: "Reasoning loops",
      value:
        inProgress > 0 ? `${inProgress} in progress` :
        paused > 0     ? `${paused} paused for operator` :
                         "idle",
      tone: inProgress > 0 ? "live" : paused > 0 ? "preview" : "info",
    });
    rows.push({
      label: "Audit log",
      value: audit ? `${audit.data.recentEventCount} events · ${audit.data.persistent ? "persistent" : "in-memory"}` : "—",
      tone: audit?.data.persistent ? "live" : "preview",
    });
    rows.push({
      label: "Memory store",
      value: memory ? `${memory.data.recordCount} records · ${memory.data.persistent ? "persistent" : "in-memory"}` : "—",
      tone: memory?.data.persistent ? "live" : "preview",
    });
    rows.push({
      label: "Safety boundary",
      value: "Approval-gated · execution disabled",
      tone: "live",
    });
  }

  const toneDot = (t: "live" | "preview" | "blocked" | "info"): string =>
    t === "live"    ? "bg-emerald-400" :
    t === "preview" ? "bg-amber-400"   :
    t === "blocked" ? "bg-rose-400"    :
                      "bg-violet-400";
  const toneText = (t: "live" | "preview" | "blocked" | "info"): string =>
    t === "live"    ? "text-emerald-300" :
    t === "preview" ? "text-amber-300"   :
    t === "blocked" ? "text-rose-300"    :
                      "text-zinc-200";

  return (
    <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.03] p-4 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/[0.08] blur-[40px] pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <CpuChipIcon className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Agent status</h3>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-px ml-auto">
            from axiom-os
          </span>
        </div>
        {loading && (
          <p className="text-[11px] text-zinc-500 font-mono uppercase tracking-[0.18em]">// composing agent status…</p>
        )}
        {!loading && !state && (
          <p className="text-[11px] text-zinc-400">Agent status unavailable — sign in to load canonical state.</p>
        )}
        {!loading && state && (
          <div className="space-y-2 text-[11px]">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${toneDot(row.tone)}`} />
                  <span className="text-zinc-500">{row.label}</span>
                </div>
                <span className={`font-medium ${toneText(row.tone)}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
