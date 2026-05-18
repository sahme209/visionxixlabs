"use client";

/**
 * OperatingGraphPanel
 *
 * Reusable panel that fetches /api/operating-graph and renders a
 * compact summary the Trust Center + Command Center both mount.
 * Pure read view — never executes anything.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

type NodeStatus = "healthy" | "in_progress" | "preview" | "blocked" | "disabled" | "unknown";
type NodeType =
  | "source"
  | "integration_health"
  | "operating_loop"
  | "security_findings"
  | "remediation"
  | "simulation"
  | "policy"
  | "approval"
  | "desktop_review"
  | "audit"
  | "evidence"
  | "trust_center"
  | "readiness";

interface NodeLite {
  id: string;
  type: NodeType;
  label: string;
  status: NodeStatus;
  sourceMode: string;
  headline?: string;
  safeNextAction?: { label: string; href: string };
}

interface EdgeLite {
  from: string;
  to: string;
  relation: string;
}

interface GraphLite {
  generatedAt: string;
  nodes: NodeLite[];
  edges: EdgeLite[];
  summary: {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    blockedNodes: number;
    previewNodes: number;
    healthyNodes: number;
  };
  overallSourceMode: string;
  safeNextAction: { label: string; href: string };
}

const STATUS_VISUAL: Record<NodeStatus, { pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  healthy:     { pill: "bg-emerald-500/15 text-emerald-300",  icon: CheckCircleIcon,         label: "healthy"     },
  in_progress: { pill: "bg-cyan-500/15 text-cyan-300",        icon: ClockIcon,               label: "in progress" },
  preview:     { pill: "bg-amber-500/15 text-amber-300",      icon: ExclamationTriangleIcon, label: "preview"     },
  blocked:     { pill: "bg-rose-500/15 text-rose-300",        icon: XCircleIcon,             label: "blocked"     },
  disabled:    { pill: "bg-zinc-700/40 text-zinc-300",        icon: MinusCircleIcon,         label: "disabled"    },
  unknown:     { pill: "bg-zinc-700/40 text-zinc-300",        icon: MinusCircleIcon,         label: "unknown"     },
};

export function OperatingGraphPanel({
  className,
  title = "Operating Graph",
  subtitle = "Live projection over canonical state — every node is read-only.",
}: {
  className?: string;
  title?: string;
  subtitle?: string;
}) {
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
        else setError(json.error?.userMessage ?? "Operating Graph unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const nodesByType = useMemo(() => {
    if (!graph) return [];
    return Object.entries(graph.summary.nodesByType).sort((a, b) => b[1] - a[1]);
  }, [graph]);

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowsRightLeftIcon className="h-4 w-4 text-violet-300 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white tracking-tight">{title}</p>
            <p className="text-[11.5px] text-zinc-400 leading-snug">{subtitle}</p>
          </div>
        </div>
        <Link href="/dashboard/graph" className="inline-flex items-center gap-1.5 text-[11px] font-mono text-violet-300 hover:text-violet-200 border border-violet-500/30 hover:border-violet-500/50 bg-violet-500/[0.05] rounded-md px-2 py-1 transition-colors">
          open full graph <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>

      {loading && (
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing graph…</p>
      )}
      {!loading && error && (
        <p className="text-[11.5px] text-amber-200 font-mono">// {error}</p>
      )}
      {!loading && !error && graph && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <Stat label="Nodes" value={graph.summary.nodeCount} tone="zinc" />
            <Stat label="Edges" value={graph.summary.edgeCount} tone="zinc" />
            <Stat label="Healthy" value={graph.summary.healthyNodes} tone={graph.summary.healthyNodes > 0 ? "emerald" : "zinc"} />
            <Stat label="Blocked" value={graph.summary.blockedNodes} tone={graph.summary.blockedNodes > 0 ? "rose" : "zinc"} />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-500 mb-3">
            <span>source mode</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-200">{graph.overallSourceMode.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>last sync {new Date(graph.generatedAt).toLocaleTimeString()}</span>
          </div>

          <div className="space-y-1 mb-3">
            {graph.nodes.slice(0, 8).map((n) => {
              const v = STATUS_VISUAL[n.status] ?? STATUS_VISUAL.unknown;
              const Icon = v.icon;
              return (
                <div key={n.id} className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] p-2">
                  <Icon className="h-3.5 w-3.5 text-white/60 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11.5px] text-white font-medium">{n.label}</span>
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${v.pill}`}>{v.label}</span>
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                        {n.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    {n.headline && (
                      <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{n.headline}</p>
                    )}
                  </div>
                  {n.safeNextAction && (
                    <Link href={n.safeNextAction.href} className="text-[10px] font-mono text-violet-300 hover:text-violet-200 shrink-0">
                      open →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {nodesByType.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/[0.06]">
              {nodesByType.map(([type, count]) => (
                <span key={type} className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                  {type.replace(/_/g, " ")}: {count}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-2.5`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[18px] font-bold mt-0.5">{value}</p>
    </div>
  );
}
