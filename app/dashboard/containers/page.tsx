"use client";

/**
 * /dashboard/containers — Container Orchestration Surface.
 *
 * Premium one-pane view of every container surface Axiom touches
 * (AWS ECS / AWS EKS / GCP GKE / Azure AKS / GitHub Container
 * Registry). Honest sourceMode pills — live traversal lands in
 * Phase 42b-e. The view never executes.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

type Provider = "aws_ecs" | "aws_eks" | "gcp_gke" | "azure_aks" | "github_ghcr";
type Status = "healthy" | "degraded" | "upgrading" | "version_eol" | "config_drift" | "unreachable" | "preview" | "unknown";

interface ClusterLite {
  id: string;
  provider: Provider;
  name: string;
  region: string;
  controlPlaneVersion?: string;
  versionEol: boolean;
  status: Status;
  sourceMode: string;
  nodePoolCount: number;
  nodeCount: number;
  podCount: number;
  workloadCount: number;
  publicEndpointsCount: number;
  networkExposure: string;
  secretsPosture: string;
  workloads: unknown[];
  limitations: string[];
  externalConsoleHref?: string;
  safeNextAction: { label: string; href: string };
}

interface ReportLite {
  generatedAt: string;
  clusters: ClusterLite[];
  summary: {
    total: number;
    byProvider: Record<Provider, number>;
    healthy: number;
    degraded: number;
    upgrading: number;
    eolVersionsCount: number;
    publicEndpointsTotal: number;
    workloadsTotal: number;
    podsTotal: number;
    riskyWorkloadsCount: number;
    riskFlagBreakdown: Record<string, number>;
  };
  overallSourceMode: string;
  safetyContract: "container_orchestration_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const STATUS_VISUAL: Record<Status, { pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  healthy:      { pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon,         label: "healthy" },
  degraded:     { pill: "bg-white/15 text-zinc-300",     icon: ExclamationTriangleIcon, label: "degraded" },
  upgrading:    { pill: "bg-cyan-500/15 text-cyan-300",       icon: ClockIcon,               label: "upgrading" },
  version_eol:  { pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon,             label: "version EOL" },
  config_drift: { pill: "bg-white/15 text-zinc-300",     icon: ExclamationTriangleIcon, label: "drift" },
  unreachable:  { pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon,             label: "unreachable" },
  preview:      { pill: "bg-violet-500/15 text-violet-300",   icon: ClockIcon,               label: "preview" },
  unknown:      { pill: "bg-zinc-700/40 text-zinc-300",       icon: MinusCircleIcon,         label: "unknown" },
};

const PROVIDER_LABEL: Record<Provider, string> = {
  aws_ecs:     "AWS ECS",
  aws_eks:     "AWS EKS",
  gcp_gke:     "GCP GKE",
  azure_aks:   "Azure AKS",
  github_ghcr: "GitHub Container Registry",
};

export default function ContainersPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/containers", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Container surface unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-90 pointer-events-none" style={{ background: "radial-gradient(900px 320px at 12% 0%, rgba(59,130,246,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)" }} aria-hidden />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ServerStackIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Containers
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every cluster. <span className="text-gradient">Every workload.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          ECS, EKS, GKE, AKS, and GHCR in one canonical surface. The view is read-only by construction — workload-level risk flags hook the security scanner once live traversal wires per provider.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Clusters" value={String(report.summary.total)} tone="zinc" />
            <Stat label="Healthy" value={String(report.summary.healthy)} tone={report.summary.healthy > 0 ? "emerald" : "zinc"} />
            <Stat label="Workloads" value={String(report.summary.workloadsTotal)} tone="cyan" />
            <Stat label="Pods" value={String(report.summary.podsTotal)} tone="cyan" />
            <Stat label="Public endpoints" value={String(report.summary.publicEndpointsTotal)} tone={report.summary.publicEndpointsTotal > 0 ? "amber" : "zinc"} />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing container surface…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// surface unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {report.clusters.map((c) => {
              const v = STATUS_VISUAL[c.status];
              const Icon = v.icon;
              return (
                <div key={c.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Icon className="h-4 w-4 text-white/70" />
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>{v.label}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">{c.sourceMode.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight">{c.name}</p>
                      <p className="text-[11.5px] text-zinc-400 mt-0.5">{PROVIDER_LABEL[c.provider]} · {c.region}</p>
                    </div>
                    {c.externalConsoleHref && (
                      <Link href={c.externalConsoleHref} target="_blank" className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 hover:text-emerald-200">
                        provider console <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Mini label="Node pools" value={c.nodePoolCount} />
                    <Mini label="Nodes" value={c.nodeCount} />
                    <Mini label="Workloads" value={c.workloadCount} />
                    <Mini label="Pods" value={c.podCount} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-500 mb-2">
                    <span>exposure: {c.networkExposure.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>secrets: {c.secretsPosture.replace(/_/g, " ")}</span>
                    {c.controlPlaneVersion && (<><span>·</span><span>v{c.controlPlaneVersion}</span></>)}
                  </div>

                  {c.limitations.length > 0 && (
                    <div className="rounded-md border border-white/[0.18] bg-white/[0.04] p-2 mb-2">
                      <p className="text-[9px] font-mono text-zinc-300/80 uppercase tracking-wider mb-0.5">// limitations</p>
                      {c.limitations.map((l, i) => (
                        <p key={i} className="text-[11px] text-zinc-300 leading-snug">{l}</p>
                      ))}
                    </div>
                  )}

                  <Link href={c.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors">
                    {c.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// container surface contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">{report.limitations.join(" ")}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "cyan" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    cyan:    "border-cyan-500/[0.18] bg-cyan-500/[0.03] text-cyan-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/[0.04] bg-white/[0.015] p-2">
      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-[14px] font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}
