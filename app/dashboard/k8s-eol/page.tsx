"use client";

/**
 * /dashboard/k8s-eol — Kubernetes EOL upgrade planner.
 *
 * Consumes the existing /api/containers report. Filters down to the
 * clusters whose controlPlaneVersion is EOL (already classified by
 * each provider extractor's closed version set). For each EOL
 * cluster, recommends a target version + lists the workloads that
 * may break (anything with riskFlags). The upgrade itself is left
 * to the operator's IaC pipeline.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ServerStackIcon,
  ExclamationTriangleIcon,
  ArrowUpCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface ContainerCluster {
  id: string;
  provider: string;
  name: string;
  region: string;
  controlPlaneVersion?: string;
  versionEol: boolean;
  status: string;
  nodePoolCount: number;
  nodeCount: number;
  podCount: number;
  workloadCount: number;
  publicEndpointsCount: number;
  workloads: { name: string; namespace?: string; riskFlags: string[]; summary: string }[];
}
interface Report {
  generatedAt: string;
  clusters: ContainerCluster[];
  summary: {
    total: number;
    eolVersionsCount: number;
    publicEndpointsTotal: number;
  };
  overallSourceMode: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  aws_eks: "AWS EKS",
  azure_aks: "Azure AKS",
  gcp_gke: "GCP GKE",
};

const PROVIDER_TONE: Record<string, string> = {
  aws_eks:  "border-amber-500/30 bg-amber-500/[0.04]",
  azure_aks: "border-sky-500/30 bg-sky-500/[0.04]",
  gcp_gke:  "border-emerald-500/30 bg-emerald-500/[0.04]",
};

// Per-cloud recommended next-stable version. Refresh as managed-k8s
// vendors release new minors.
const TARGET_VERSION: Record<string, string> = {
  aws_eks:  "1.30",
  azure_aks: "1.30",
  gcp_gke:  "1.30",
};

export default function K8sEolPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/containers", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Containers unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  const eolClusters = useMemo(
    () => report?.clusters.filter((c) => c.versionEol) ?? [],
    [report],
  );

  const byProvider = useMemo(() => {
    const m: Record<string, ContainerCluster[]> = {};
    for (const c of eolClusters) {
      (m[c.provider] ??= []).push(c);
    }
    return m;
  }, [eolClusters]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(244,114,182,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(245,158,11,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ArrowUpCircleIcon className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Kubernetes EOL
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          End of life. <span className="text-gradient">Upgrade plan.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Across AWS EKS + Azure AKS + GCP GKE, every cluster running an EOL control-plane minor. Target version
          per cloud and the workloads most likely to break.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total clusters" value={String(report.summary.total)} tone="zinc" />
            <Stat
              label="EOL clusters"
              value={String(report.summary.eolVersionsCount)}
              tone={report.summary.eolVersionsCount > 0 ? "rose" : "emerald"}
              icon={ExclamationTriangleIcon}
            />
            <Stat
              label="Public endpoints"
              value={String(report.summary.publicEndpointsTotal)}
              tone={report.summary.publicEndpointsTotal > 0 ? "amber" : "emerald"}
            />
            <Stat label="Source" value={report.overallSourceMode} tone="zinc" />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // walking EKS / AKS / GKE control planes…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        eolClusters.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-6 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-emerald-100">No EOL clusters detected.</p>
              <p className="text-[12px] text-zinc-300 mt-1">
                Every probed cluster is on a vendor-supported control-plane minor. Re-run after the next quarterly
                vendor support window closes.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {Object.entries(byProvider).map(([provider, clusters]) => (
              <div key={provider} className={`rounded-2xl border ${PROVIDER_TONE[provider] ?? "border-white/[0.06] bg-white/[0.02]"} p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-semibold text-white">{PROVIDER_LABEL[provider] ?? provider}</p>
                  <span className="text-[10px] font-mono text-zinc-400">
                    target {TARGET_VERSION[provider] ?? "—"}
                  </span>
                </div>
                <div className="space-y-2">
                  {clusters.map((c) => (
                    <div key={c.id} className="rounded-lg border border-white/[0.08] bg-black/30 p-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white">{c.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{c.region}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span className="rounded border border-rose-500/30 bg-rose-500/15 text-rose-300 px-1.5 py-0.5">
                            EOL · v{c.controlPlaneVersion ?? "?"}
                          </span>
                          <span className="text-zinc-500">→</span>
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5">
                            v{TARGET_VERSION[provider] ?? "latest"}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-2 text-[10px] font-mono">
                        <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
                          <p className="text-zinc-500 uppercase">node pools</p>
                          <p className="text-zinc-200 font-bold">{c.nodePoolCount}</p>
                        </div>
                        <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
                          <p className="text-zinc-500 uppercase">workloads</p>
                          <p className="text-zinc-200 font-bold">{c.workloadCount}</p>
                        </div>
                        <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
                          <p className="text-zinc-500 uppercase">pods</p>
                          <p className="text-zinc-200 font-bold">{c.podCount}</p>
                        </div>
                      </div>
                      {c.workloads && c.workloads.filter((w) => w.riskFlags.length > 0).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-[10px] font-mono text-amber-300/80 cursor-pointer hover:text-amber-200 uppercase tracking-wider">
                            {c.workloads.filter((w) => w.riskFlags.length > 0).length} workload{c.workloads.filter((w) => w.riskFlags.length > 0).length === 1 ? "" : "s"} with upgrade-risk flags
                          </summary>
                          <div className="mt-1.5 space-y-1">
                            {c.workloads.filter((w) => w.riskFlags.length > 0).slice(0, 5).map((w, i) => (
                              <div key={i} className="rounded border border-amber-500/15 bg-amber-500/[0.04] p-1.5">
                                <p className="text-[11px] text-white">{w.namespace ? `${w.namespace}/` : ""}{w.name}</p>
                                <p className="text-[10px] font-mono text-amber-200">{w.riskFlags.join(" · ")}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc"; icon?: typeof ExclamationTriangleIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
