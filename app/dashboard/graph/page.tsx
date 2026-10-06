"use client";

/**
 * /dashboard/graph
 *
 * Operating Graph view — renders the connected operational chain from
 * /api/operating-graph. Each node shows status / sourceMode / count /
 * limitations / safeNextAction. Each edge shows the canonical
 * relationship + evidence refs so operators can trace any link.
 *
 * Read-only. No mutation. No fabricated nodes.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CloudIcon,
  ServerStackIcon,
  PlayCircleIcon,
  ShieldExclamationIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  ScaleIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  EyeIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

type NodeStatus = "healthy" | "in_progress" | "preview" | "blocked" | "disabled" | "unknown";
type SourceMode = "live" | "partial_live" | "preview" | "foundation" | "planned" | "blocked" | "disabled" | "unknown";

type NodeType =
  | "source" | "integration_health" | "operating_loop" | "security_findings"
  | "remediation" | "simulation" | "policy" | "approval"
  | "desktop_review" | "audit" | "evidence" | "trust_center" | "readiness";

interface GraphNodeLite {
  id: string;
  type: NodeType;
  title: string;
  status: NodeStatus;
  sourceMode: SourceMode;
  count?: number;
  severity?: "critical" | "high" | "medium" | "low";
  route?: string;
  limitations: string[];
  safeNextAction?: { label: string; href: string };
  evidenceRefs: string[];
}

interface GraphEdgeLite {
  from: string;
  to: string;
  relation: string;
  explanation: string;
  evidenceRefs: string[];
}

interface GraphLite {
  generatedAt: string;
  nodes: GraphNodeLite[];
  edges: GraphEdgeLite[];
  summary: { nodeCount: number; edgeCount: number; nodesByType: Record<string, number>; blockedNodes: number; previewNodes: number; healthyNodes: number };
  overallSourceMode: SourceMode;
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const NODE_ICON: Record<NodeType, typeof CloudIcon> = {
  source:              CloudIcon,
  integration_health:  ServerStackIcon,
  operating_loop:      PlayCircleIcon,
  security_findings:   ShieldExclamationIcon,
  remediation:         WrenchScrewdriverIcon,
  simulation:          BeakerIcon,
  policy:              ScaleIcon,
  approval:            LockClosedIcon,
  desktop_review:      ComputerDesktopIcon,
  audit:               DocumentTextIcon,
  evidence:            EyeIcon,
  trust_center:        ShieldCheckIcon,
  readiness:           RocketLaunchIcon,
};

const STATUS_TONE: Record<NodeStatus, { border: string; bg: string; text: string; pill: string; dot: string }> = {
  healthy:     { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400 animate-pulse" },
  in_progress: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       dot: "bg-cyan-400 animate-pulse"    },
  preview:     { border: "border-white/[0.18]",   bg: "bg-white/[0.04]",   text: "text-zinc-300",   pill: "bg-white/15 text-zinc-300",     dot: "bg-zinc-400"                 },
  blocked:     { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       dot: "bg-rose-400"                  },
  disabled:    { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       dot: "bg-zinc-600"                  },
  unknown:     { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       dot: "bg-zinc-600"                  },
};

// The canonical chain order — for the operating spine rendering.
const SPINE_ORDER: NodeType[] = [
  "source",
  "operating_loop",
  "security_findings",
  "remediation",
  "simulation",
  "policy",
  "approval",
  "desktop_review",
  "audit",
  "evidence",
  "trust_center",
  "readiness",
];

export default function OperatingGraphPage() {
  const [graph, setGraph] = useState<GraphLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/operating-graph", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: GraphLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setGraph(json.data);
        else setError(json.error?.userMessage ?? "Operating graph unavailable.");
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
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
                <ServerStackIcon className="h-3.5 w-3.5 text-cyan-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
                  Operating Graph · {(graph?.overallSourceMode ?? "preview").replace(/_/g, " ")}
                </span>
              </span>
              {graph?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(graph.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              How Axiom <span className="text-gradient">connects.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Every operational object Axiom tracks, and the canonical relationships between them. <span className="text-zinc-500">A pure projection of /api/axiom-os/state — no mutation, no fabrication.</span>
            </p>
          </div>

          {graph && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Nodes" value={graph.summary.nodeCount} tone="text-white" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Edges" value={graph.summary.edgeCount} tone="text-white" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Healthy" value={graph.summary.healthyNodes} tone="text-emerald-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Blocked" value={graph.summary.blockedNodes} tone={graph.summary.blockedNodes > 0 ? "text-rose-300" : "text-zinc-500"} />
            </div>
          )}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing operating graph…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// graph unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {/* The canonical operational spine */}
      {!loading && !error && graph && (
        <>
          <section className="mb-10">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// canonical operational spine</p>
            <div className="space-y-2">
              {SPINE_ORDER.map((type) => {
                const matching = graph.nodes.filter((n) => n.type === type);
                if (matching.length === 0) return null;
                return (
                  <SpineRow key={type} type={type} nodes={matching} edges={graph.edges} />
                );
              })}
            </div>
          </section>

          {/* Edges legend */}
          <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// canonical edges ({graph.edges.length})</p>
            <ul className="space-y-1.5">
              {graph.edges.slice(0, 12).map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="text-zinc-500 font-mono shrink-0">{e.from}</span>
                  <span className="text-violet-300 font-mono shrink-0">{e.relation.replace(/_/g, " ")} →</span>
                  <span className="text-zinc-500 font-mono shrink-0">{e.to}</span>
                  <span className="text-zinc-400 leading-snug">· {e.explanation}</span>
                </li>
              ))}
              {graph.edges.length > 12 && (
                <li className="text-[11px] font-mono text-zinc-500 mt-1">
                  + {graph.edges.length - 12} more edges in the canonical chain
                </li>
              )}
            </ul>
          </section>

          {/* Limitations + Trust footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// graph contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug mb-1">
                The operating graph is a projection, not an executor.
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                {graph.limitations[0] ?? "Read-only by construction. Mutating any node requires its own approval-gated API."}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SpineRow({ type, nodes, edges }: { type: NodeType; nodes: GraphNodeLite[]; edges: GraphEdgeLite[] }) {
  const Icon = NODE_ICON[type];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-3 items-start">
      <div className="flex items-center gap-2.5 pt-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-zinc-300" />
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-white tracking-tight">{prettyType(type)}</p>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{nodes.length} node{nodes.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {nodes.map((n) => {
          const tone = STATUS_TONE[n.status];
          const outgoing = edges.filter((e) => e.from === n.id);
          return (
            <div key={n.id} className={`group rounded-xl border ${tone.border} ${tone.bg} p-3 hover:-translate-y-0.5 transition-all`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white tracking-tight truncate">{n.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                    <p className={`text-[10px] font-mono uppercase tracking-wider ${tone.text}`}>{n.status} · {n.sourceMode.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {typeof n.count === "number" && (
                  <span className={`text-[11px] font-mono font-bold ${tone.text} shrink-0`}>{n.count}</span>
                )}
              </div>

              {n.severity && (
                <span className={`inline-block text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-px mt-0.5 mb-1.5 ${
                  n.severity === "critical" ? "bg-rose-500/15 text-rose-300" :
                  n.severity === "high"     ? "bg-white/15 text-zinc-300" :
                  n.severity === "medium"   ? "bg-white/10 text-zinc-300" :
                                              "bg-zinc-700/40 text-zinc-300"
                }`}>
                  {n.severity}
                </span>
              )}

              {n.limitations.length > 0 && (
                <p className="text-[10px] text-zinc-500 leading-snug truncate mt-1">{n.limitations[0]}</p>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {n.route && (
                  <Link href={n.route} className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded px-1.5 py-0.5 transition-colors">
                    Open
                    <ArrowRightIcon className="h-2.5 w-2.5" />
                  </Link>
                )}
                {outgoing.length > 0 && (
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">{outgoing.length} edge{outgoing.length === 1 ? "" : "s"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right min-w-[4rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}

function prettyType(t: NodeType): string {
  const labels: Record<NodeType, string> = {
    source:              "Source",
    integration_health:  "Integration health",
    operating_loop:      "Operating loop",
    security_findings:   "Security findings",
    remediation:         "Remediation",
    simulation:          "Simulation",
    policy:              "Policy",
    approval:            "Approval",
    desktop_review:      "Desktop review",
    audit:               "Audit",
    evidence:            "Evidence",
    trust_center:        "Trust Center",
    readiness:           "Readiness",
  };
  return labels[t];
}
