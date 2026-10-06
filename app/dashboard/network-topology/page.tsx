"use client";

/**
 * /dashboard/network-topology — cross-cloud network topology.
 *
 * Renders the unified node/edge graph as an SVG laid out by cloud
 * column (AWS / Azure / GCP). Each VPC is a card with its CIDRs,
 * its child subnets, and peering arrows. Internet-facing VPCs are
 * highlighted in rose. No graph-rendering libs — pure SVG so we
 * keep the bundle lean.
 */

import { useEffect, useMemo, useState } from "react";
import {
  GlobeAltIcon,
  ServerStackIcon,
  ShieldExclamationIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

type CloudId = "aws" | "azure" | "gcp";
type NodeKind = "vpc" | "subnet" | "peering" | "internet";
type EdgeKind = "contains" | "peers" | "internet_edge";

interface TopologyNode {
  id: string;
  kind: NodeKind;
  cloud: CloudId | "synthetic";
  label: string;
  region?: string;
  cidrs?: string[];
  internetFacing?: boolean;
}
interface TopologyEdge {
  id: string;
  kind: EdgeKind;
  fromNodeId: string;
  toNodeId: string;
}
interface SectionStats {
  cloud: CloudId;
  mode: "live" | "preview" | "blocked" | "disabled" | "partial";
  vpcCount: number;
  subnetCount: number;
  peeringCount: number;
  internetFacingVpcCount: number;
  limitations: string[];
}
interface Report {
  generatedAt: string;
  durationMs: number;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  sections: SectionStats[];
  totals: {
    vpcs: number;
    subnets: number;
    peerings: number;
    internetFacingVpcs: number;
  };
  limitations: string[];
}

const CLOUDS: CloudId[] = ["aws", "azure", "gcp"];
const CLOUD_LABEL: Record<CloudId, string> = { aws: "AWS", azure: "Azure", gcp: "GCP" };
const CLOUD_COLOR: Record<CloudId, string> = {
  aws: "rgba(245,158,11,0.18)",
  azure: "rgba(14,165,233,0.18)",
  gcp: "rgba(16,185,129,0.18)",
};

export default function NetworkTopologyPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverVpc, setHoverVpc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cloud/topology", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Topology unavailable.");
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const vpcsByCloud = useMemo(() => {
    const m = new Map<CloudId, TopologyNode[]>();
    for (const c of CLOUDS) m.set(c, []);
    if (!report) return m;
    for (const n of report.nodes) {
      if (n.kind === "vpc" && n.cloud !== "synthetic") {
        m.get(n.cloud as CloudId)!.push(n);
      }
    }
    return m;
  }, [report]);

  const subnetsByVpc = useMemo(() => {
    const m = new Map<string, TopologyNode[]>();
    if (!report) return m;
    const containsEdges = report.edges.filter((e) => e.kind === "contains");
    for (const e of containsEdges) {
      const child = report.nodes.find((n) => n.id === e.toNodeId);
      if (!child) continue;
      const arr = m.get(e.fromNodeId) ?? [];
      arr.push(child);
      m.set(e.fromNodeId, arr);
    }
    return m;
  }, [report]);

  const peerEdges = useMemo(() => report?.edges.filter((e) => e.kind === "peers") ?? [], [report]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(244,114,182,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <GlobeAltIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Network Topology
            </span>
          </span>
          {report && (
            <span className="text-[10px] font-mono text-zinc-500">
              {new Date(report.generatedAt).toLocaleTimeString()} · {report.durationMs}ms
            </span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          One network. <span className="text-gradient">Three clouds.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every VPC, VNet, and GCP network — with subnets, peerings, and internet edges — in one normalized graph.
          Hover a VPC to highlight its subnets and peerings.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="VPCs / VNets" value={report.totals.vpcs.toLocaleString()} tone="indigo" icon={ServerStackIcon} />
            <Stat label="Subnets" value={report.totals.subnets.toLocaleString()} tone="zinc" />
            <Stat label="Peerings" value={report.totals.peerings.toLocaleString()} tone="violet" icon={ArrowsRightLeftIcon} />
            <Stat
              label="Internet-facing"
              value={report.totals.internetFacingVpcs.toLocaleString()}
              tone={report.totals.internetFacingVpcs > 0 ? "rose" : "emerald"}
              icon={ShieldExclamationIcon}
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // walking VPCs / VNets / Networks across 3 clouds…
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {report.sections.map((s) => (
              <div key={s.cloud} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-semibold text-white">{CLOUD_LABEL[s.cloud]}</p>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      s.mode === "live"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : s.mode === "preview"
                          ? "bg-white/15 text-zinc-300"
                          : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {s.mode}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono">
                  <Tile label="vpc" value={s.vpcCount} />
                  <Tile label="subnet" value={s.subnetCount} />
                  <Tile label="peer" value={s.peeringCount} />
                  <Tile label="🌐" value={s.internetFacingVpcCount} tone={s.internetFacingVpcCount > 0 ? "rose" : "emerald"} />
                </div>
                {s.limitations.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300">
                      {s.limitations.length} note{s.limitations.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-1 space-y-0.5 text-[10px] text-zinc-400 max-h-24 overflow-y-auto">
                      {s.limitations.map((l, i) => <p key={i}>· {l}</p>)}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          {/* Topology canvas */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8 overflow-x-auto">
            <p className="text-[11px] font-mono text-indigo-300/80 uppercase tracking-wider mb-3">
              // unified topology · grouped by cloud · hover a VPC for highlight
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-[640px]">
              {CLOUDS.map((cloud) => {
                const vpcs = vpcsByCloud.get(cloud) ?? [];
                return (
                  <div
                    key={cloud}
                    className="rounded-xl border border-white/[0.06] p-3"
                    style={{ background: `linear-gradient(180deg, ${CLOUD_COLOR[cloud]}, transparent 70%)` }}
                  >
                    <p className="text-[10px] font-mono text-white/80 uppercase tracking-wider mb-2">
                      {CLOUD_LABEL[cloud]} · {vpcs.length} vpc{vpcs.length === 1 ? "" : "s"}
                    </p>
                    {vpcs.length === 0 ? (
                      <p className="text-[11px] font-mono text-zinc-500 italic">no VPCs</p>
                    ) : (
                      <div className="space-y-2">
                        {vpcs.map((v) => {
                          const subnets = subnetsByVpc.get(v.id) ?? [];
                          const isHovered = hoverVpc === v.id;
                          const peerCount = peerEdges.filter((e) => e.fromNodeId === v.id || e.toNodeId === v.id).length;
                          return (
                            <div
                              key={v.id}
                              onMouseEnter={() => setHoverVpc(v.id)}
                              onMouseLeave={() => setHoverVpc(null)}
                              className={`rounded-lg border p-2.5 transition cursor-default ${
                                isHovered
                                  ? "border-violet-400/60 bg-white/[0.025]"
                                  : v.internetFacing
                                    ? "border-rose-500/30 bg-rose-500/[0.04]"
                                    : "border-white/[0.08] bg-black/20"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[12px] font-semibold text-white truncate" title={v.label}>{v.label}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  {v.internetFacing && (
                                    <span className="text-[8.5px] font-mono uppercase tracking-wider px-1 py-px rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                      🌐 igw
                                    </span>
                                  )}
                                  {peerCount > 0 && (
                                    <span className="text-[8.5px] font-mono uppercase tracking-wider px-1 py-px rounded bg-violet-500/15 text-violet-300 border border-white/[0.12]">
                                      ⇄ {peerCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {v.region && (
                                <p className="text-[9px] font-mono text-zinc-500">{v.region}</p>
                              )}
                              {v.cidrs && v.cidrs.length > 0 && (
                                <p className="text-[10px] font-mono text-zinc-400 mt-1">{v.cidrs.join(" · ")}</p>
                              )}
                              {subnets.length > 0 && (
                                <div className="mt-1.5 grid grid-cols-1 gap-0.5">
                                  {subnets.slice(0, 6).map((s) => (
                                    <div key={s.id} className="text-[10px] font-mono text-zinc-300 flex items-center gap-1.5">
                                      <span className="opacity-50">⊢</span>
                                      <span className="truncate" title={s.label}>{s.label}</span>
                                      {s.cidrs?.[0] && <span className="text-zinc-500 ml-auto">{s.cidrs[0]}</span>}
                                    </div>
                                  ))}
                                  {subnets.length > 6 && (
                                    <p className="text-[9px] font-mono text-zinc-500 italic">+{subnets.length - 6} more</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {report.limitations.length > 0 && (
            <div className="rounded-2xl border border-white/[0.18] bg-white/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-2">// limitations</p>
              {report.limitations.map((l, i) => <p key={i} className="text-[12px] text-zinc-300">· {l}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: {
  label: string; value: string;
  tone: "emerald" | "amber" | "rose" | "violet" | "indigo" | "zinc";
  icon?: typeof ServerStackIcon;
}) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
    indigo:  "border-indigo-500/[0.18] bg-indigo-500/[0.03] text-indigo-200",
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

function Tile({ label, value, tone = "zinc" }: { label: string; value: number; tone?: "rose" | "emerald" | "zinc" }) {
  const cls = {
    rose: "text-rose-300",
    emerald: "text-emerald-300",
    zinc: "text-zinc-300",
  }[tone];
  return (
    <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1 text-center">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-[12px] font-bold ${cls}`}>{value}</p>
    </div>
  );
}
