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
  DocumentTextIcon,
  ServerStackIcon,
  ChartBarSquareIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { resolveNextAction } from "@/lib/product/nextAction";
import { useDesktopRuntime } from "@/lib/desktop/useDesktopRuntime";
import { assessOnboarding, progressPercent } from "@/lib/onboarding/onboardingState";
import { buildSecurityPosture } from "@/lib/security/securityPosture";
import { buildReliabilityPosture } from "@/lib/reliability/reliabilityPosture";

type ConnectorStatus = {
  provider: string;
  status: string;
  accountId?: string;
  lastScan?: string;
};

interface FeatureSummary {
  awsScanMode: "live" | "preview" | "disabled";
  githubSyncMode: "live" | "preview" | "disabled";
  copilotEnabled: boolean;
  oauth: { google: boolean; github: boolean };
}

export default function DashboardPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<FeatureSummary | null>(null);
  const { isDesktop } = useDesktopRuntime();

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((r) => r.json())
      .then((data) => setConnectors(data.connectors || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Real-state adapter — features mode lives here.
    fetch("/api/command-center")
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res.data?.features) {
          setFeatures({
            awsScanMode:    res.data.features.awsScanMode,
            githubSyncMode: res.data.features.githubSyncMode,
            copilotEnabled: res.data.features.copilotEnabled,
            oauth:          res.data.features.oauth,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  const connected = connectors.filter((c) => c.status === "connected");
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

  const security = buildSecurityPosture({
    source: "preview",
    credentials: [],
    pairedDesktops: [],
    crossTenantAttempts30d: 0,
    policyBlocks30d: 0,
    openHighRiskFindings: 0,
    redactionEnabled: true,
    auditStoreConfigured: true,
    copilotContextSafe: true,
  });

  const reliability = buildReliabilityPosture({
    source: "preview",
    components: [
      { id: "web_app",          label: "Web app",          status: "healthy"  },
      { id: "database",         label: "Database",         status: "healthy"  },
      { id: "connector.aws",    label: "AWS connector",    status: connected.length > 0 ? "healthy" : "unknown" },
      { id: "workflow_engine",  label: "Workflow engine",  status: "healthy"  },
      { id: "copilot_llm",      label: "Copilot LLM",      status: "healthy"  },
    ],
    circuits: [],
    deadLetters: [],
    fleet: { total: 0, healthy: 0, stalled: 0, stuck: 0, failed: 0, partial: 0, actionable: [] },
    retryingJobs: 0,
    successfulRetries24h: 0,
    rateLimitPauses24h: 0,
  });

  const pct = progressPercent(onboarding);

  return (
    <div className="-mt-2">
      {/* Welcome header — calm, premium, plenty of breathing room */}
      <header className="mb-10 flex items-end justify-between flex-wrap gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
            <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.18em]">Workspace · live</p>
            {features && (
              <>
                <ModeBadge label="AWS scan"     value={features.awsScanMode} />
                <ModeBadge label="GitHub sync"  value={features.githubSyncMode} />
                <ModeBadge label="Copilot"      value={features.copilotEnabled ? "live" : "disabled"} />
              </>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Welcome back to <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">Axiom</span>.
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            One workspace for cloud operations, ReleaseOps governance, and execution-plan approval — every action explainable, reversible, audited.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/command-center"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15 transition-colors text-sm font-semibold"
          >
            Open Command Center
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/copilot"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.1] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] transition-colors text-sm font-semibold"
          >
            Ask copilot
            <SparklesIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero grid: Next action (2/3) + Onboarding progress (1/3) */}
      <section className="grid lg:grid-cols-3 gap-4 mb-6">
        <Link
          href={nextAction.cta.href}
          className="lg:col-span-2 relative rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.07] via-white/[0.01] to-fuchsia-500/[0.04] p-7 hover:border-violet-500/30 transition-all group overflow-hidden"
        >
          <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-violet-500/[0.12] blur-[80px] pointer-events-none" aria-hidden />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-fuchsia-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
              <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-[0.18em]">Next best action</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-[-0.03em] mb-2">{nextAction.cta.label}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">{nextAction.reason}</p>
            <div className="mt-6 inline-flex items-center gap-2 text-violet-200 font-semibold text-sm">
              Go
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] via-white/[0.01] to-cyan-500/[0.03] p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BoltIcon className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.18em]">Getting productive</span>
            </div>
            <span className="text-xs font-mono text-zinc-500">{pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {onboarding.nextStep ? (
            <>
              <p className="text-sm font-semibold text-white mb-1">{onboarding.nextStep.label}</p>
              <p className="text-[12px] text-zinc-500 leading-relaxed mb-4">{onboarding.nextStep.detail}</p>
              <Link
                href={onboarding.nextStep.href}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition-colors"
              >
                Continue setup
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-emerald-200 mb-1">You&apos;re operating in steady state.</p>
              <p className="text-[12px] text-zinc-500 leading-relaxed">Every milestone is checked. Time to focus on real work.</p>
            </>
          )}
        </div>
      </section>

      {/* Posture row: scores marked "Preview" honestly until real telemetry
          is wired (the aggregator engines run on hardcoded preview inputs
          right now). "Cloud connections" reads real data from
          /api/connectors/status. */}
      <section className="grid lg:grid-cols-3 gap-4 mb-10">
        <PostureCard
          icon={ShieldCheckIcon}
          tone="emerald"
          label="Security posture"
          value={`${Math.round(security.score * 100)}%`}
          detail={security.checks[0]?.label ?? "Tenant isolation healthy"}
          href="/dashboard/security"
          source="preview"
        />
        <PostureCard
          icon={ChartBarSquareIcon}
          tone="cyan"
          label="Reliability"
          value={`${Math.round(reliability.score * 100)}%`}
          detail={`${reliability.health.counts.healthy}/${reliability.health.components.length} components healthy`}
          href="/dashboard/reliability"
          source="preview"
        />
        <PostureCard
          icon={CloudIcon}
          tone="violet"
          label="Cloud connections"
          value={`${connected.length}`}
          detail={connected.length === 0 ? "No accounts connected" : `${connected.length} provider${connected.length === 1 ? "" : "s"} live`}
          href="/dashboard/connect-cloud"
          source="live"
        />
      </section>

      {/* Capability rail — three structured columns instead of a 12-card wall */}
      <section className="mb-10">
        <h2 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.18em] mb-4">Workspace</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <CapabilityColumn
            title="Operate"
            items={[
              { href: "/dashboard/command-center", icon: CpuChipIcon,           label: "Command Center",     sub: "Live activity, reasoning, plans" },
              { href: "/dashboard/topology",       icon: ArrowsPointingOutIcon, label: "Topology",           sub: "Map every provider + resource" },
              { href: "/dashboard/workflows",      icon: ArrowPathIcon,         label: "Workflows",          sub: "Recurring scans + jobs" },
              { href: "/dashboard/jobs",           icon: ClockIcon,             label: "Jobs",               sub: "Durable retry-aware tasks" },
            ]}
          />
          <CapabilityColumn
            title="Govern"
            items={[
              { href: "/dashboard/approvals",   icon: SparklesIcon,    label: "Approvals",   sub: "Human-in-the-loop plans" },
              { href: "/dashboard/governance",  icon: ShieldCheckIcon, label: "Governance",  sub: "Policy + autonomy ladder" },
              { href: "/dashboard/security",    icon: KeyIcon,         label: "Security",    sub: "RBAC, credentials, redaction" },
              { href: "/dashboard/releaseops",  icon: ServerStackIcon, label: "ReleaseOps",  sub: "Deployment readiness" },
            ]}
          />
          <CapabilityColumn
            title="Inspect"
            items={[
              { href: "/dashboard/audit",       icon: DocumentTextIcon,    label: "Audit",        sub: "Evidence-backed stories" },
              { href: "/dashboard/traces",      icon: ChartBarSquareIcon,  label: "Traces",       sub: "Operation span timelines" },
              { href: "/dashboard/reliability", icon: BoltIcon,            label: "Reliability",  sub: "Circuits, retries, DLQ" },
              { href: "/dashboard/copilot",     icon: SparklesIcon,        label: "Copilot",      sub: "AI ops with evidence" },
            ]}
          />
        </div>
      </section>

      {/* Connected accounts — compact list, only when non-empty makes the page feel quieter */}
      {connected.length > 0 && (
        <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Connected accounts</h2>
            <Link href="/dashboard/integrations" className="text-[11px] text-zinc-400 hover:text-white">
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {connected.map((c) => (
              <div key={c.accountId || c.provider} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{c.provider}</p>
                    {c.accountId && <p className="text-[11px] text-zinc-500 font-mono">{c.accountId}</p>}
                  </div>
                </div>
                {c.lastScan && (
                  <span className="text-[11px] text-zinc-500">
                    Last scan {new Date(c.lastScan).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty-state helper when no clouds connected */}
      {connected.length === 0 && (
        <section className="mb-10 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent p-8 text-center">
          <CloudIcon className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">Connect a cloud to get started</h2>
          <p className="text-sm text-zinc-500 mb-5 max-w-md mx-auto leading-relaxed">
            AWS, Azure, or Google Cloud — pick whichever your team uses. Axiom only reads, your credentials never leave your provider.
          </p>
          <Link
            href="/dashboard/connect-cloud"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Connect a cloud
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* Desktop pitch — only when the desktop runtime isn't already detected */}
      {!isDesktop && (
        <section className="rounded-2xl border border-amber-500/15 bg-gradient-to-r from-amber-500/[0.04] via-transparent to-fuchsia-500/[0.03] p-6 flex items-start gap-5 flex-wrap">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <CommandLineIcon className="h-5 w-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-[0.18em] mb-1">Desktop preview</p>
            <p className="text-base font-bold text-white mb-1">Run Axiom on your workstation.</p>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
              Receive signed handoffs from the web, review Terraform locally, and keep credentials in the OS keychain. Binaries ship with signed 1.0.
            </p>
          </div>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 transition-colors text-sm font-semibold shrink-0"
          >
            View download
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </section>
      )}
    </div>
  );
}

function PostureCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
  href,
  source,
}: {
  icon: typeof CloudIcon;
  tone: "emerald" | "cyan" | "violet";
  label: string;
  value: string;
  detail: string;
  href: string;
  /** Honest source tag — "preview" renders a badge so the user knows the
   *  number isn't reading live telemetry yet. */
  source?: "live" | "preview" | "demo";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    cyan:    "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    violet:  "text-violet-300 bg-violet-500/10 border-violet-500/20",
  };
  const accent =
    tone === "emerald" ? "hover:border-emerald-500/25" :
    tone === "cyan"    ? "hover:border-cyan-500/25"    :
                          "hover:border-violet-500/25";
  const showPreviewBadge = source === "preview" || source === "demo";
  return (
    <Link
      href={href}
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors group ${accent}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex items-center gap-2">
          {showPreviewBadge && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-1.5 py-px">
              {source === "preview" ? "Preview" : "Demo"}
            </span>
          )}
          <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-300 transition-colors" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white tracking-[-0.04em]">{value}</p>
      <p className="text-[11px] text-zinc-500 uppercase tracking-[0.12em] mt-1">{label}</p>
      <p className="text-[12px] text-zinc-400 mt-2 leading-relaxed">{detail}</p>
      {showPreviewBadge && (
        <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
          Score is a real engine running on preview inputs — wires to live telemetry once data is connected.
        </p>
      )}
    </Link>
  );
}

function CapabilityColumn({
  title,
  items,
}: {
  title: string;
  items: { href: string; icon: typeof CloudIcon; label: string; sub: string }[];
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.04]">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.18em]">{title}</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.05] flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors">
                <Icon className="h-4 w-4 text-zinc-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed truncate">{item.sub}</p>
              </div>
              <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ModeBadge({ label, value }: { label: string; value: "live" | "preview" | "disabled" }) {
  const tone =
    value === "live"     ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
    value === "preview"  ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                            "text-zinc-500 bg-white/[0.04] border-white/[0.08]";
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-[0.15em] border rounded-full px-1.5 py-px ${tone}`}>
      {label} · {value}
    </span>
  );
}
