"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ClockIcon,
  CodeBracketIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
} from "@heroicons/react/24/outline";
import type { ReleasePipeline, ReleaseSystemId, PipelineStatus } from "@/lib/operations/eventStream";

const SYSTEM_LABEL: Record<ReleaseSystemId, string> = {
  github: "GitHub Actions",
  gitlab: "GitLab CI",
  azure_devops: "Azure DevOps",
  jenkins: "Jenkins",
  argocd: "ArgoCD",
};

const SYSTEM_COLOR: Record<ReleaseSystemId, string> = {
  github: "text-zinc-300 bg-zinc-500/10 border-zinc-500/20",
  gitlab: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  azure_devops: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  jenkins: "text-zinc-400 bg-white/10 border-white/20",
  argocd: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
};

const ENV_COLOR = {
  production: "text-red-400 bg-red-500/10 border-red-500/20",
  staging: "text-zinc-400 bg-white/10 border-white/20",
  development: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  qa: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
} as const;

const STATUS_CONFIG: Record<
  PipelineStatus,
  { icon: typeof CheckCircleIcon; iconClass: string; label: string; bgClass: string; borderClass: string; dotClass: string }
> = {
  running: { icon: ArrowPathIcon, iconClass: "text-blue-400", label: "Running", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/20", dotClass: "bg-blue-400 animate-pulse" },
  queued: { icon: ClockIcon, iconClass: "text-zinc-400", label: "Queued", bgClass: "bg-white/[0.04]", borderClass: "border-white/[0.08]", dotClass: "bg-zinc-500" },
  succeeded: { icon: CheckCircleIcon, iconClass: "text-emerald-400", label: "Succeeded", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20", dotClass: "bg-emerald-400" },
  failed: { icon: XCircleIcon, iconClass: "text-red-400", label: "Failed", bgClass: "bg-red-500/10", borderClass: "border-red-500/20", dotClass: "bg-red-400 animate-pulse" },
  blocked: { icon: PauseCircleIcon, iconClass: "text-zinc-400", label: "Blocked", bgClass: "bg-white/10", borderClass: "border-white/20", dotClass: "bg-zinc-400" },
  awaiting_approval: { icon: LockClosedIcon, iconClass: "text-zinc-400", label: "Awaiting approval", bgClass: "bg-white/10", borderClass: "border-white/20", dotClass: "bg-zinc-400 animate-pulse" },
};

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function fmtDuration(ms?: number): string {
  if (!ms) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}m ${s}s`;
}

interface ReleasePipelineGridProps {
  pipelines?: ReleasePipeline[];
  className?: string;
  title?: string;
}

export function ReleasePipelineGrid({ pipelines = DEMO_PIPELINES, className = "", title = "Active release pipelines" }: ReleasePipelineGridProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const running = pipelines.filter((p) => p.status === "running").length;
  const awaiting = pipelines.filter((p) => p.status === "awaiting_approval").length;
  const blocked = pipelines.filter((p) => p.status === "blocked" || p.status === "failed").length;

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className="text-[10px] text-zinc-500 font-mono">
              {pipelines.length} pipelines · {running} running · {awaiting} awaiting approval · {blocked} blocked
            </span>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Live · Auto-refresh 15s</span>
        </div>
      </div>

      {/* Pipelines */}
      <div className="p-4 space-y-2">
        {pipelines.map((p) => {
          const status = STATUS_CONFIG[p.status];
          const StatusIcon = status.icon;
          const readinessColor =
            (p.readinessScore ?? 0) >= 85 ? "text-emerald-400" :
            (p.readinessScore ?? 0) >= 70 ? "text-zinc-400" :
            "text-red-400";

          return (
            <div
              key={p.id}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all overflow-hidden"
            >
              {/* Running stripe */}
              {p.status === "running" && (
                <span aria-hidden className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
              )}
              {/* Failed stripe */}
              {p.status === "failed" && (
                <span aria-hidden className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent" />
              )}

              <div className="flex items-start gap-3 flex-wrap">
                {/* Status icon */}
                <div className={`w-10 h-10 rounded-xl ${status.bgClass} border ${status.borderClass} flex items-center justify-center shrink-0 ${p.status === "running" ? "ring-2 ring-blue-500/30" : ""}`}>
                  <StatusIcon className={`h-5 w-5 ${status.iconClass} ${p.status === "running" ? "animate-spin" : ""}`} style={p.status === "running" ? { animationDuration: "2s" } : undefined} />
                </div>

                {/* Service + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-white">{p.service}</p>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${ENV_COLOR[p.environment]}`}>
                      {p.environment}
                    </span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${SYSTEM_COLOR[p.system]}`}>
                      {SYSTEM_LABEL[p.system]}
                    </span>
                    {p.blastRadius && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                        {p.blastRadius} blast
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-500 font-mono flex-wrap">
                    <span className="text-zinc-400">{p.ref}</span>
                    <span>·</span>
                    <span>{p.commit.slice(0, 7)}</span>
                    <span>·</span>
                    <span>{p.author}</span>
                    <span>·</span>
                    <span>{timeAgo(p.startedAt)}</span>
                    {p.durationMs != null && (
                      <>
                        <span>·</span>
                        <span>{fmtDuration(p.durationMs)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right column */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Readiness */}
                  {p.readinessScore != null && (
                    <div className="text-right">
                      <p className={`text-base font-bold ${readinessColor}`}>{p.readinessScore}</p>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">readiness</p>
                    </div>
                  )}
                  {/* Awaiting approvals */}
                  {p.awaitingApprovals != null && p.awaitingApprovals > 0 && (
                    <div className="text-right">
                      <p className="text-base font-bold text-zinc-400">{p.awaitingApprovals}</p>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">approvals</p>
                    </div>
                  )}
                  {/* Status pill */}
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${status.iconClass}`}>{status.label}</span>
                  </div>
                </div>
              </div>

              {/* Blocked detail row */}
              {p.status === "blocked" && (
                <div className="mt-3 rounded-lg bg-white/[0.05] border border-white/15 px-3 py-2 flex items-center gap-2 text-[11px] text-zinc-300">
                  <PauseCircleIcon className="h-3.5 w-3.5" />
                  Release readiness below threshold · rollback path not verified · open for governance review
                </div>
              )}
              {p.status === "awaiting_approval" && (
                <div className="mt-3 rounded-lg bg-white/[0.05] border border-white/15 px-3 py-2 flex items-center gap-2 text-[11px] text-zinc-300">
                  <LockClosedIcon className="h-3.5 w-3.5" />
                  {p.awaitingApprovals ?? 1} approver{(p.awaitingApprovals ?? 1) !== 1 ? "s" : ""} required · ServiceNow CR open · escalation path armed
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs">
        <span className="text-zinc-500">Aggregating from connected CI/CD systems</span>
        <button className="text-zinc-400 hover:text-white transition-colors font-medium">
          View all releases →
        </button>
      </div>
    </div>
  );
}

// Demo pipelines
const minAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const DEMO_PIPELINES: ReleasePipeline[] = [
  {
    id: "p1",
    service: "payments-api",
    environment: "production",
    system: "github",
    status: "awaiting_approval",
    ref: "release/v4.12.0",
    commit: "8a92f1c3b4d5e6f7",
    author: "ana.r",
    startedAt: minAgo(14),
    durationMs: 540_000,
    readinessScore: 91,
    blastRadius: "contained",
    awaitingApprovals: 2,
  },
  {
    id: "p2",
    service: "checkout-frontend",
    environment: "production",
    system: "github",
    status: "running",
    ref: "main",
    commit: "1c4d8e9a2b3f4071",
    author: "marcus.l",
    startedAt: minAgo(2),
    readinessScore: 87,
    blastRadius: "moderate",
  },
  {
    id: "p3",
    service: "billing-worker",
    environment: "staging",
    system: "azure_devops",
    status: "running",
    ref: "feature/cb-1024",
    commit: "ee99aabb1234cdef",
    author: "kim.p",
    startedAt: minAgo(4),
    readinessScore: 78,
  },
  {
    id: "p4",
    service: "auth-gateway",
    environment: "production",
    system: "gitlab",
    status: "blocked",
    ref: "release/v2.8.1",
    commit: "4f7c2b3a9d8e1f02",
    author: "deepa.k",
    startedAt: minAgo(38),
    durationMs: 2_280_000,
    readinessScore: 62,
    blastRadius: "broad",
  },
  {
    id: "p5",
    service: "data-pipeline",
    environment: "production",
    system: "jenkins",
    status: "succeeded",
    ref: "main",
    commit: "aa11bb22cc33dd44",
    author: "jordan.s",
    startedAt: minAgo(95),
    durationMs: 720_000,
    readinessScore: 94,
    blastRadius: "contained",
  },
  {
    id: "p6",
    service: "infra/terraform-prod",
    environment: "production",
    system: "github",
    status: "awaiting_approval",
    ref: "tf/upgrade-vpc-peering",
    commit: "1234567890abcdef",
    author: "axiom-agent",
    startedAt: minAgo(22),
    readinessScore: 84,
    blastRadius: "broad",
    awaitingApprovals: 3,
  },
  {
    id: "p7",
    service: "kafka-consumers",
    environment: "qa",
    system: "argocd",
    status: "failed",
    ref: "main",
    commit: "9ed4faa11b2c3d04",
    author: "lin.h",
    startedAt: minAgo(8),
    durationMs: 180_000,
    readinessScore: 71,
  },
  {
    id: "p8",
    service: "search-service",
    environment: "staging",
    system: "github",
    status: "queued",
    ref: "release/v1.18.0",
    commit: "abcdef9876543210",
    author: "tom.v",
    startedAt: minAgo(1),
  },
];
