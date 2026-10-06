"use client";

import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import type { ReleaseService } from "@/lib/operations/eventStream";

const TREND_CONFIG = {
  up: { Icon: ArrowTrendingUpIcon, color: "text-emerald-400" },
  down: { Icon: ArrowTrendingDownIcon, color: "text-red-400" },
  flat: { Icon: ChartBarIcon, color: "text-zinc-500" },
} as const;

const ENV_COLOR = {
  production: "text-red-400 bg-red-500/10 border-red-500/20",
  staging: "text-zinc-400 bg-white/10 border-white/20",
  development: "text-blue-400 bg-blue-500/10 border-blue-500/20",
} as const;

function scoreColor(pct: number): { text: string; bg: string } {
  if (pct >= 85) return { text: "text-emerald-400", bg: "from-emerald-500 to-emerald-400" };
  if (pct >= 70) return { text: "text-zinc-400", bg: "from-zinc-500 to-zinc-400" };
  return { text: "text-red-400", bg: "from-red-500 to-red-400" };
}

interface ReadinessScoreCardProps {
  services?: ReleaseService[];
  className?: string;
  title?: string;
}

export function ReadinessScoreCard({
  services = DEMO_SERVICES,
  className = "",
  title = "Release readiness by service",
}: ReadinessScoreCardProps) {
  const sorted = [...services].sort((a, b) => a.compositeScore - b.compositeScore);
  const fleetAvg = Math.round(services.reduce((s, x) => s + x.compositeScore, 0) / services.length);

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className="text-[10px] text-zinc-500 font-mono">{services.length} services</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-zinc-500">Fleet average:</span>
            <span className={`${scoreColor(fleetAvg).text} font-bold text-sm`}>{fleetAvg}/100</span>
          </div>
        </div>
      </div>

      {/* Service list */}
      <div className="p-3 space-y-2 max-h-[640px] overflow-y-auto">
        {sorted.map((s) => {
          const color = scoreColor(s.compositeScore);
          const trend = TREND_CONFIG[s.trend];
          const TrendIcon = trend.Icon;
          const failedDimensions = s.dimensions.filter((d) => d.score < 0.7).length;

          return (
            <div
              key={s.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group"
            >
              <div className="flex items-start gap-3 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-white">{s.name}</p>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${ENV_COLOR[s.environment]}`}>
                      {s.environment}
                    </span>
                    {s.rollbackVerified ? (
                      <span className="text-[9px] font-semibold text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        Rollback verified
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-zinc-400 inline-flex items-center gap-1">
                        <XCircleIcon className="h-3 w-3" />
                        Rollback unverified
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {s.team}
                    {s.lastDeployedAt && ` · last shipped ${new Date(s.lastDeployedAt).toLocaleDateString()}`}
                    {failedDimensions > 0 && ` · ${failedDimensions} dimensions below threshold`}
                  </p>
                </div>
                {/* Score */}
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-bold ${color.text} tracking-tight`}>{s.compositeScore}</p>
                  <div className="flex items-center justify-end gap-1">
                    <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                    <span className={`text-[10px] ${trend.color} font-medium`}>
                      {s.trendDelta ?? (s.trend === "up" ? "improving" : s.trend === "down" ? "declining" : "stable")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full bg-gradient-to-r ${color.bg}`} style={{ width: `${s.compositeScore}%` }} />
              </div>

              {/* Dimension chips */}
              <div className="flex flex-wrap gap-1">
                {s.dimensions.map((d) => {
                  const pct = Math.round(d.score * 100);
                  const c = scoreColor(pct);
                  return (
                    <span
                      key={d.key}
                      title={d.detail}
                      className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5"
                    >
                      <span className={c.text}>{pct}</span>
                      <span className="text-zinc-500">{d.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Scoring engine · 9 operational dimensions · recalibrated continuously
        </span>
        <button className="text-zinc-400 hover:text-white transition-colors font-medium">
          Export readiness report →
        </button>
      </div>
    </div>
  );
}

// Demo services
const dim = (key: string, label: string, score: number, detail: string) => ({ key, label, score, detail });

const DEMO_SERVICES: ReleaseService[] = [
  {
    id: "svc_payments",
    name: "payments-api",
    team: "Payments · ana.r",
    environment: "production",
    compositeScore: 91,
    trend: "up",
    trendDelta: "+4 pts this month",
    lastDeployedAt: new Date(Date.now() - 86_400_000).toISOString(),
    rollbackVerified: true,
    dimensions: [
      dim("branch", "Branch", 0.95, "Required reviewers · branch protection · linear history"),
      dim("rollback", "Rollback", 0.92, "Pre-flight snapshots · 47s measured RTO"),
      dim("obs", "Observability", 0.91, "SLO defined · alerts wired · structured logs"),
      dim("matur", "Maturity", 0.89, "Canary rollout · health checks · feature flags"),
      dim("coord", "Coordination", 0.87, "Clear ownership · runbooks current"),
      dim("audit", "Audit", 0.96, "Immutable trail · SOC 2 mapped"),
      dim("tf", "Terraform", 0.88, "Plan-gated · drift scans every 6h"),
      dim("drift", "Drift", 0.93, "No active drift · last detection 14d ago"),
      dim("comms", "Comms", 0.84, "Auto release notes · Slack channel wired"),
    ],
  },
  {
    id: "svc_checkout",
    name: "checkout-frontend",
    team: "Storefront · marcus.l",
    environment: "production",
    compositeScore: 87,
    trend: "up",
    trendDelta: "+2 pts",
    lastDeployedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    rollbackVerified: true,
    dimensions: [
      dim("branch", "Branch", 0.92, "Required reviewers"),
      dim("rollback", "Rollback", 0.88, "Verified · 60s RTO"),
      dim("obs", "Observability", 0.86, "RUM + SLO present"),
      dim("matur", "Maturity", 0.84, "Blue/green deploy"),
      dim("coord", "Coordination", 0.81, "Cross-team approvals slow"),
      dim("audit", "Audit", 0.94, "Mapped"),
      dim("tf", "Terraform", 0.82, "Not all modules drift-monitored"),
      dim("drift", "Drift", 0.88, "1 minor drift open"),
      dim("comms", "Comms", 0.86, "Slack + status page"),
    ],
  },
  {
    id: "svc_billing",
    name: "billing-worker",
    team: "Billing · kim.p",
    environment: "production",
    compositeScore: 78,
    trend: "flat",
    lastDeployedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    rollbackVerified: true,
    dimensions: [
      dim("branch", "Branch", 0.88, "Required reviewers"),
      dim("rollback", "Rollback", 0.74, "RTO not measured in 90d"),
      dim("obs", "Observability", 0.82, "Alerts wired"),
      dim("matur", "Maturity", 0.70, "No canary · big-bang deploy"),
      dim("coord", "Coordination", 0.68, "Owner gap · escalation slow"),
      dim("audit", "Audit", 0.92, "Mapped"),
      dim("tf", "Terraform", 0.75, "1 module without rollback path"),
      dim("drift", "Drift", 0.80, "Drift detected 3 weeks ago"),
      dim("comms", "Comms", 0.71, "No auto release notes"),
    ],
  },
  {
    id: "svc_auth",
    name: "auth-gateway",
    team: "Identity · deepa.k",
    environment: "production",
    compositeScore: 62,
    trend: "down",
    trendDelta: "-7 pts after incident",
    lastDeployedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    lastIncidentAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    rollbackVerified: false,
    dimensions: [
      dim("branch", "Branch", 0.78, "Reviewers exist"),
      dim("rollback", "Rollback", 0.42, "No verified path post-incident"),
      dim("obs", "Observability", 0.68, "SLO present"),
      dim("matur", "Maturity", 0.55, "Direct prod deploys after incident"),
      dim("coord", "Coordination", 0.62, "Cross-team approvals unclear"),
      dim("audit", "Audit", 0.84, "Mapped"),
      dim("tf", "Terraform", 0.59, "Drift open · 2 modules"),
      dim("drift", "Drift", 0.53, "3 active drift events"),
      dim("comms", "Comms", 0.65, "Inconsistent"),
    ],
  },
  {
    id: "svc_data",
    name: "data-pipeline",
    team: "Data · jordan.s",
    environment: "production",
    compositeScore: 94,
    trend: "up",
    trendDelta: "+3 pts",
    lastDeployedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    rollbackVerified: true,
    dimensions: [
      dim("branch", "Branch", 0.96, "Strict"),
      dim("rollback", "Rollback", 0.94, "Tested last week"),
      dim("obs", "Observability", 0.95, "Comprehensive"),
      dim("matur", "Maturity", 0.92, "Canary + auto-revert"),
      dim("coord", "Coordination", 0.93, "Owner clear"),
      dim("audit", "Audit", 0.98, "Mapped"),
      dim("tf", "Terraform", 0.91, "Plan-gated"),
      dim("drift", "Drift", 0.96, "None"),
      dim("comms", "Comms", 0.93, "Auto"),
    ],
  },
  {
    id: "svc_search",
    name: "search-service",
    team: "Discovery · tom.v",
    environment: "staging",
    compositeScore: 83,
    trend: "flat",
    lastDeployedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    rollbackVerified: true,
    dimensions: [
      dim("branch", "Branch", 0.86, "Standard"),
      dim("rollback", "Rollback", 0.85, "RTO 90s"),
      dim("obs", "Observability", 0.84, "SLO + alerts"),
      dim("matur", "Maturity", 0.79, "Phased"),
      dim("coord", "Coordination", 0.81, "Owner clear"),
      dim("audit", "Audit", 0.90, "Mapped"),
      dim("tf", "Terraform", 0.80, "Plan-gated"),
      dim("drift", "Drift", 0.84, "None"),
      dim("comms", "Comms", 0.78, "Slack only"),
    ],
  },
];
