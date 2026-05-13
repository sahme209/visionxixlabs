"use client";

import { useEffect, useState } from "react";
import {
  CpuChipIcon,
  CloudIcon,
  ServerStackIcon,
  CircleStackIcon,
  LockClosedIcon,
  ArrowsRightLeftIcon,
  ShieldCheckIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

type ProviderId = "aws" | "azure" | "gcp";
type ResourceKind = "compute" | "storage" | "network" | "identity";

interface ResourceNode {
  id: string;
  name: string;
  kind: ResourceKind;
  count: number;
  findings: number;
  cost?: number;
}

interface RegionNode {
  id: string;
  code: string;
  label: string;
  status: "operational" | "scanning" | "issue";
  resources: ResourceNode[];
}

interface ProviderNode {
  id: ProviderId;
  label: string;
  shortLabel: string;
  accentClass: string;
  status: "operational" | "scanning" | "degraded";
  accountCount: number;
  regions: RegionNode[];
}

const PROVIDER_COLORS: Record<ProviderId, { stroke: string; fill: string; text: string; glow: string }> = {
  aws: {
    stroke: "stroke-amber-400/60",
    fill: "fill-amber-500/10",
    text: "text-amber-400",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  azure: {
    stroke: "stroke-blue-400/60",
    fill: "fill-blue-500/10",
    text: "text-blue-400",
    glow: "rgba(59, 130, 246, 0.4)",
  },
  gcp: {
    stroke: "stroke-red-400/60",
    fill: "fill-red-500/10",
    text: "text-red-400",
    glow: "rgba(239, 68, 68, 0.4)",
  },
};

const KIND_ICON: Record<ResourceKind, typeof CpuChipIcon> = {
  compute: ServerStackIcon,
  storage: CircleStackIcon,
  network: ArrowsRightLeftIcon,
  identity: LockClosedIcon,
};

const KIND_LABEL: Record<ResourceKind, string> = {
  compute: "Compute",
  storage: "Storage",
  network: "Network",
  identity: "Identity",
};

const DEFAULT_TOPOLOGY: ProviderNode[] = [
  {
    id: "aws",
    label: "Amazon Web Services",
    shortLabel: "AWS",
    accentClass: "amber",
    status: "operational",
    accountCount: 2,
    regions: [
      {
        id: "aws-use1",
        code: "us-east-1",
        label: "N. Virginia",
        status: "operational",
        resources: [
          { id: "aws-use1-c", name: "EC2 · Lambda · ECS", kind: "compute", count: 47, findings: 3, cost: 8400 },
          { id: "aws-use1-s", name: "S3 · EBS · EFS", kind: "storage", count: 38, findings: 2, cost: 1200 },
          { id: "aws-use1-n", name: "VPC · TGW · ALB", kind: "network", count: 12, findings: 1 },
          { id: "aws-use1-i", name: "IAM · KMS", kind: "identity", count: 28, findings: 1 },
        ],
      },
      {
        id: "aws-usw2",
        code: "us-west-2",
        label: "Oregon",
        status: "scanning",
        resources: [
          { id: "aws-usw2-c", name: "EC2 · Lambda", kind: "compute", count: 24, findings: 0, cost: 3200 },
          { id: "aws-usw2-s", name: "S3 · EBS", kind: "storage", count: 14, findings: 0, cost: 480 },
        ],
      },
    ],
  },
  {
    id: "azure",
    label: "Microsoft Azure",
    shortLabel: "Azure",
    accentClass: "blue",
    status: "operational",
    accountCount: 1,
    regions: [
      {
        id: "azure-weu",
        code: "westeurope",
        label: "Amsterdam",
        status: "operational",
        resources: [
          { id: "azure-weu-c", name: "VMs · Functions", kind: "compute", count: 32, findings: 4, cost: 5200 },
          { id: "azure-weu-s", name: "Blob · Disks", kind: "storage", count: 28, findings: 2, cost: 920 },
          { id: "azure-weu-n", name: "VNet · LB", kind: "network", count: 8, findings: 0 },
        ],
      },
    ],
  },
  {
    id: "gcp",
    label: "Google Cloud Platform",
    shortLabel: "GCP",
    accentClass: "red",
    status: "degraded",
    accountCount: 1,
    regions: [
      {
        id: "gcp-uswest1",
        code: "us-west1",
        label: "Oregon",
        status: "issue",
        resources: [
          { id: "gcp-uswest1-c", name: "GCE · Run", kind: "compute", count: 18, findings: 5, cost: 2800 },
          { id: "gcp-uswest1-s", name: "GCS · PD", kind: "storage", count: 12, findings: 2, cost: 420 },
        ],
      },
    ],
  },
];

const STATUS_DOT: Record<RegionNode["status"], string> = {
  operational: "bg-emerald-400",
  scanning: "bg-blue-400 animate-pulse",
  issue: "bg-amber-400 animate-pulse",
};

const STATUS_LABEL: Record<RegionNode["status"], string> = {
  operational: "Operational",
  scanning: "Scanning",
  issue: "Findings",
};

interface InfrastructureTopologyProps {
  topology?: ProviderNode[];
  className?: string;
}

export function InfrastructureTopology({ topology = DEFAULT_TOPOLOGY, className = "" }: InfrastructureTopologyProps) {
  const [activeProvider, setActiveProvider] = useState<ProviderId | null>(null);
  const [scanPulse, setScanPulse] = useState(0);

  // Continuous data-flow pulse animation
  useEffect(() => {
    const t = setInterval(() => setScanPulse((n) => (n + 1) % 100), 80);
    return () => clearInterval(t);
  }, []);

  const totalResources = topology.reduce(
    (sum, p) => sum + p.regions.reduce((rSum, r) => rSum + r.resources.reduce((res, x) => res + x.count, 0), 0),
    0
  );
  const totalFindings = topology.reduce(
    (sum, p) => sum + p.regions.reduce((rSum, r) => rSum + r.resources.reduce((res, x) => res + x.findings, 0), 0),
    0
  );
  const totalCost = topology.reduce(
    (sum, p) => sum + p.regions.reduce((rSum, r) => rSum + r.resources.reduce((res, x) => res + (x.cost ?? 0), 0), 0),
    0
  );

  return (
    <div className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Infrastructure Topology</h3>
          <span className="text-[10px] text-zinc-500 font-mono">
            {topology.length} providers · {totalResources} resources · {totalFindings} findings
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-zinc-500">Monthly spend:</span>
          <span className="text-emerald-400 font-semibold">${totalCost.toLocaleString()}</span>
        </div>
      </div>

      {/* Topology Canvas */}
      <div className="relative p-8 bg-gradient-to-br from-transparent via-violet-500/[0.02] to-transparent">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />

        {/* Spotlight orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/[0.06] blur-[80px] pointer-events-none" aria-hidden />

        {/* SVG layer for connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <defs>
            <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0)" />
              <stop offset="50%" stopColor="rgba(139, 92, 246, 0.4)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Central Axiom Core */}
        <div className="relative flex justify-center mb-12">
          <div className="relative">
            {/* Pulsing rings */}
            <div className="absolute -inset-8 rounded-full border border-violet-500/20 animate-ping" style={{ animationDuration: "3s" }} />
            <div className="absolute -inset-6 rounded-full border border-violet-500/30 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.4s" }} />
            <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-blue-500/30 blur-[20px]" />
            {/* Core */}
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#1a1a20] via-[#0f0f12] to-[#0a0a0c] border border-violet-500/30 flex items-center justify-center shadow-2xl shadow-violet-900/40">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
              <CpuChipIcon className="h-10 w-10 text-violet-400 relative z-10" />
              <span className="absolute -bottom-1.5 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#09090b] shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
            <p className="text-[10px] font-bold text-center text-white mt-2 tracking-widest uppercase">Axiom Operator</p>
            <p className="text-[9px] text-zinc-500 text-center font-mono">{topology.length} providers connected</p>
          </div>
        </div>

        {/* Provider tree */}
        <div className="grid lg:grid-cols-3 gap-6 relative">
          {topology.map((provider) => {
            const colors = PROVIDER_COLORS[provider.id];
            const isActive = activeProvider === provider.id;
            const providerResources = provider.regions.reduce((sum, r) => sum + r.resources.reduce((rs, x) => rs + x.count, 0), 0);
            const providerFindings = provider.regions.reduce((sum, r) => sum + r.resources.reduce((rs, x) => rs + x.findings, 0), 0);
            const providerCost = provider.regions.reduce((sum, r) => sum + r.resources.reduce((rs, x) => rs + (x.cost ?? 0), 0), 0);
            return (
              <div
                key={provider.id}
                onMouseEnter={() => setActiveProvider(provider.id)}
                onMouseLeave={() => setActiveProvider(null)}
                className={`relative rounded-xl border bg-white/[0.02] p-4 transition-all duration-300 ${
                  isActive ? "border-white/[0.15] -translate-y-1 shadow-2xl" : "border-white/[0.06]"
                }`}
                style={isActive ? { boxShadow: `0 20px 60px ${colors.glow}` } : undefined}
              >
                {/* Provider header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg ${colors.fill.replace("fill-", "bg-")} border ${colors.stroke.replace("stroke-", "border-")} flex items-center justify-center`}>
                      <CloudIcon className={`h-4 w-4 ${colors.text}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{provider.shortLabel}</p>
                      <p className="text-[10px] text-zinc-500">{provider.accountCount} account{provider.accountCount > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${colors.text}`}>
                    {provider.status}
                  </span>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="rounded bg-black/30 border border-white/[0.04] px-2 py-1.5">
                    <p className="text-[8px] text-zinc-500 uppercase tracking-wider">Resources</p>
                    <p className="text-xs font-bold text-white">{providerResources}</p>
                  </div>
                  <div className="rounded bg-black/30 border border-white/[0.04] px-2 py-1.5">
                    <p className="text-[8px] text-zinc-500 uppercase tracking-wider">Findings</p>
                    <p className={`text-xs font-bold ${providerFindings > 5 ? "text-amber-400" : providerFindings > 0 ? "text-amber-400/80" : "text-emerald-400"}`}>
                      {providerFindings}
                    </p>
                  </div>
                  <div className="rounded bg-black/30 border border-white/[0.04] px-2 py-1.5">
                    <p className="text-[8px] text-zinc-500 uppercase tracking-wider">Spend</p>
                    <p className="text-xs font-bold text-emerald-400">${(providerCost / 1000).toFixed(1)}k</p>
                  </div>
                </div>

                {/* Region tree */}
                <div className="space-y-2">
                  {provider.regions.map((region) => (
                    <div key={region.id} className="rounded-lg bg-black/20 border border-white/[0.04] overflow-hidden">
                      {/* Region header */}
                      <div className="px-2.5 py-2 flex items-center justify-between border-b border-white/[0.04]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[region.status]}`} />
                          <span className="text-[11px] font-semibold text-white">{region.code}</span>
                          <span className="text-[9px] text-zinc-600">· {region.label}</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 font-mono">{STATUS_LABEL[region.status]}</span>
                      </div>
                      {/* Resource leaves */}
                      <div className="px-2 py-1.5 space-y-1">
                        {region.resources.map((res) => {
                          const Icon = KIND_ICON[res.kind];
                          return (
                            <div key={res.id} className="flex items-center justify-between gap-2 py-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Icon className="h-3 w-3 text-zinc-500 shrink-0" />
                                <span className="text-[10px] text-zinc-400 truncate font-mono">{KIND_LABEL[res.kind]}</span>
                                <span className="text-[9px] text-zinc-600 truncate">· {res.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] text-zinc-500 font-mono">×{res.count}</span>
                                {res.findings > 0 && (
                                  <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5">
                                    {res.findings}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Animated data flow line indicator */}
                {provider.status !== "degraded" && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 h-1 w-12 overflow-hidden rounded-b-full">
                    <div
                      className={`h-full w-full bg-gradient-to-r from-transparent via-violet-400 to-transparent`}
                      style={{ transform: `translateX(${scanPulse - 50}%)`, opacity: 0.6 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer legend */}
      <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between flex-wrap gap-2 text-[10px]">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-500">Operational</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-zinc-500">Scanning</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-zinc-500">Findings present</span>
          </span>
          <span className="flex items-center gap-1.5">
            <BoltIcon className="h-3 w-3 text-violet-400" />
            <span className="text-zinc-500">Live data flow</span>
          </span>
        </div>
        <button className="text-zinc-400 hover:text-white transition-colors font-medium">
          Open full topology graph →
        </button>
      </div>
    </div>
  );
}
