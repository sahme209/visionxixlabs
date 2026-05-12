"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CloudIcon,
  ShieldCheckIcon,
  EyeIcon,
  CpuChipIcon,
  BoltIcon,
  ChevronRightIcon,
  ArrowTrendingUpIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OperationsData = {
  summary: {
    totalScans: number;
    totalFindings: number;
    totalActionsApplied: number;
    totalActionsFailed: number;
    totalSavingsIdentified: number;
    totalSavingsRealized: number;
    driftDetections: number;
    connectedAccounts: number;
    activeSchedules: number;
    pendingApprovals: number;
  };
  recentRuns: {
    id: string;
    status: string;
    trigger: string;
    summary: string | null;
    createdAt: string;
    completedAt: string | null;
    cloudAccountId: string;
    error: string | null;
    findingCount: number;
    recommendationCount: number;
  }[];
  schedules: {
    id: string;
    frequency: string;
    enabled: boolean;
    nextRunAt: string | null;
    lastRunId: string | null;
    consecutiveFailures: number;
    provider: string;
    accountId: string;
  }[];
  pendingApprovals: {
    id: string;
    runId: string;
    note: string | null;
    createdAt: string;
    itemCount: number;
  }[];
  cloudAccounts: {
    id: string;
    provider: string;
    accountId: string;
    enabled: boolean;
    lastScannedAt: string | null;
  }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircleIcon; color: string; label: string }> = {
  completed: { icon: CheckCircleIcon, color: "text-emerald-500", label: "Completed" },
  running: { icon: ArrowPathIcon, color: "text-blue-500", label: "Running" },
  pending: { icon: ClockIcon, color: "text-amber-500", label: "Pending" },
  failed: { icon: XCircleIcon, color: "text-red-500", label: "Failed" },
  partially_completed: { icon: ExclamationTriangleIcon, color: "text-amber-500", label: "Partial" },
};

const PROVIDER_LABELS: Record<string, string> = { aws: "AWS", azure: "Azure", gcp: "GCP" };

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub, icon: Icon, accent = "violet" }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof CpuChipIcon;
  accent?: "violet" | "emerald" | "amber" | "blue" | "red";
}) {
  const accents: Record<string, string> = {
    violet: "bg-violet-500/10 text-violet-400",
    emerald: "bg-emerald-50 bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-50 bg-amber-500/10 text-amber-600 text-amber-400",
    blue: "bg-blue-50 bg-blue-500/10 text-blue-600 text-blue-400",
    red: "bg-red-50 bg-red-500/10 text-red-400",
  };

  return (
    <div className="card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-violet-200 hover:border-white/[0.08] transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function RunRow({ run }: { run: OperationsData["recentRuns"][0] }) {
  const config = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-white/[0.04]/50 transition-colors rounded-lg group">
      <StatusIcon className={`h-4.5 w-4.5 flex-shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {run.summary ? run.summary.slice(0, 80) : config.label}
          </span>
          {run.trigger !== "manual" && (
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] flex-shrink-0">
              {run.trigger}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-zinc-500">{timeAgo(run.createdAt)}</span>
          {run.findingCount > 0 && (
            <span className="text-xs text-zinc-500">
              {run.findingCount} finding{run.findingCount === 1 ? "" : "s"}
            </span>
          )}
          {run.recommendationCount > 0 && (
            <span className="text-xs text-zinc-500">
              {run.recommendationCount} rec{run.recommendationCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <ChevronRightIcon className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}

function EmptyState({ title, desc, action }: { title: string; desc: string; action?: { label: string; href: string } }) {
  return (
    <div className="text-center py-12">
      <CpuChipIcon className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
      <p className="text-sm font-medium text-zinc-300 mb-1">{title}</p>
      <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">{desc}</p>
      {action && (
        <Link href={action.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-white">
          {action.label}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OperationsPage() {
  const { data: session, status: authStatus } = useSession();
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    const orgId = (session?.user as { organizationId?: string })?.organizationId;
    if (!orgId) {
      setLoading(false);
      return;
    }

    fetch(`/api/axiom/operations?organizationId=${orgId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authStatus, session]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading operations...</span>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
          <EmptyState
            title="Sign in to view operations"
            desc="The operations dashboard shows your agent activity, drift monitoring, and approval queue."
            action={{ label: "Sign in", href: "/auth/signin" }}
          />
        </div>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <header className="bg-white/[0.02] border-b border-white/[0.06] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/axiom" className="flex items-center gap-2 text-white">
              <CpuChipIcon className="h-5 w-5 text-violet-400" />
              <span className="font-bold text-sm">Axiom</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-sm text-zinc-400">Operations</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/operator/onboarding"
              className="btn-huly inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-zinc-900 text-xs font-semibold hover:bg-zinc-100 transition-colors shadow-sm"
            >
              <BoltIcon className="h-3.5 w-3.5" />
              Run scan
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="rounded-xl border border-red-200 border-red-500/20 bg-red-50 bg-red-500/10 p-4 text-sm text-red-700 text-red-400">
            {error}
          </div>
        )}

        {/* ── Metrics ──────────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Scans"
              value={s?.totalScans ?? 0}
              sub={s?.activeSchedules ? `${s.activeSchedules} scheduled` : undefined}
              icon={EyeIcon}
              accent="violet"
            />
            <MetricCard
              label="Findings"
              value={s?.totalFindings ?? 0}
              sub={s?.driftDetections ? `${s.driftDetections} drifts detected` : undefined}
              icon={ExclamationTriangleIcon}
              accent="amber"
            />
            <MetricCard
              label="Actions Applied"
              value={s?.totalActionsApplied ?? 0}
              sub={s?.totalActionsFailed ? `${s.totalActionsFailed} failed` : "0 failed"}
              icon={ShieldCheckIcon}
              accent="emerald"
            />
            <MetricCard
              label="Savings Realized"
              value={formatCurrency(s?.totalSavingsRealized ?? 0)}
              sub={s?.totalSavingsIdentified ? `${formatCurrency(s.totalSavingsIdentified)}/yr identified` : undefined}
              icon={ArrowTrendingUpIcon}
              accent="blue"
            />
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Agent Activity ────────────────────────────────────── */}
          <section className="lg:col-span-2">
            <div className="glow-border-card rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SignalIcon className="h-4 w-4 text-slate-400 icon-luminous" />
                  <h2 className="text-sm font-semibold text-white">Agent Activity</h2>
                </div>
                <span className="text-xs text-zinc-500">
                  {data?.recentRuns.length ?? 0} recent runs
                </span>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {data?.recentRuns && data.recentRuns.length > 0 ? (
                  data.recentRuns.slice(0, 10).map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))
                ) : (
                  <EmptyState
                    title="No agent runs yet"
                    desc="Run your first scan to see agent activity here."
                    action={{ label: "Run Axiom", href: "/operator/onboarding" }}
                  />
                )}
              </div>
            </div>
          </section>

          {/* ── Sidebar ──────────────────────────────────────────── */}
          <aside className="space-y-6">
            {/* Connected Accounts */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <CloudIcon className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-white">Cloud Accounts</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {data?.cloudAccounts && data.cloudAccounts.length > 0 ? (
                  data.cloudAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${account.enabled ? "bg-emerald-500" : "bg-zinc-600"}`} />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {PROVIDER_LABELS[account.provider] ?? account.provider}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono">
                            {account.accountId}
                          </p>
                        </div>
                      </div>
                      {account.lastScannedAt && (
                        <span className="text-[10px] text-zinc-500">
                          {timeAgo(account.lastScannedAt)}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-500 mb-2">No accounts connected</p>
                    <Link href="/operator/onboarding" className="text-xs font-medium text-violet-400 hover:text-violet-700">
                      Connect AWS
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Scheduled Scans */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-white">Scheduled Scans</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {data?.schedules && data.schedules.length > 0 ? (
                  data.schedules.map((sched) => (
                    <div key={sched.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${sched.enabled ? "bg-emerald-500" : "bg-zinc-600"}`} />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {PROVIDER_LABELS[sched.provider] ?? sched.provider} — {sched.frequency}
                          </p>
                          {sched.consecutiveFailures > 0 && (
                            <p className="text-xs text-amber-600 text-amber-400">
                              {sched.consecutiveFailures} consecutive failure{sched.consecutiveFailures === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      </div>
                      {sched.nextRunAt && (
                        <span className="text-[10px] text-zinc-500">
                          next: {new Date(sched.nextRunAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-zinc-500">No scheduled scans</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pending Approvals */}
            {data?.pendingApprovals && data.pendingApprovals.length > 0 && (
              <div className="rounded-2xl border border-amber-200 border-amber-500/20 bg-amber-50/50 bg-amber-500/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-amber-200 border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-4 w-4 text-amber-600 text-amber-400" />
                    <h2 className="text-sm font-semibold text-amber-900 text-amber-400">
                      Pending Approvals
                    </h2>
                    <span className="ml-auto text-xs font-bold text-amber-700 text-amber-400 bg-amber-200 bg-amber-500/10 rounded-full px-2 py-0.5">
                      {data.pendingApprovals.length}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {data.pendingApprovals.map((approval) => (
                    <div key={approval.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {approval.itemCount} action{approval.itemCount === 1 ? "" : "s"} awaiting review
                        </p>
                        <p className="text-xs text-zinc-500">
                          {timeAgo(approval.createdAt)}
                        </p>
                      </div>
                      <Link
                        href={`/operator/onboarding?runId=${approval.runId}`}
                        className="text-xs font-medium text-violet-400 hover:text-violet-700"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* ── Operational Intelligence Footer ─────────────────────── */}
        <section className="glow-border-card rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex items-center gap-3 mb-4">
            <CpuChipIcon className="h-5 w-5 icon-luminous" />
            <h2 className="text-sm font-semibold text-white">Autonomous Loop Status</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { step: "Connect", active: (s?.connectedAccounts ?? 0) > 0 },
              { step: "Scan", active: (s?.totalScans ?? 0) > 0 },
              { step: "Identify", active: (s?.totalFindings ?? 0) > 0 },
              { step: "Plan", active: (s?.totalScans ?? 0) > 0 },
              { step: "Approve", active: (s?.pendingApprovals ?? 0) > 0 || (s?.totalActionsApplied ?? 0) > 0 },
              { step: "Apply", active: (s?.totalActionsApplied ?? 0) > 0 },
              { step: "Verify", active: (s?.totalActionsApplied ?? 0) > 0 },
              { step: "Audit", active: (s?.totalScans ?? 0) > 0 },
              { step: "Drift", active: (s?.driftDetections ?? 0) > 0 },
              { step: "Learn", active: (s?.totalActionsApplied ?? 0) > 0 },
              { step: "Schedule", active: (s?.activeSchedules ?? 0) > 0 },
              { step: "Continuous", active: (s?.activeSchedules ?? 0) > 0 && (s?.totalScans ?? 0) > 2 },
            ].map(({ step, active }) => (
              <div key={step} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "bg-emerald-500" : "bg-zinc-700"}`} />
                <span className={`text-xs font-medium ${active ? "text-white" : "text-zinc-500"}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
