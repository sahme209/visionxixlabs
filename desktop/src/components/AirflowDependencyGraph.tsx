import { motion } from "framer-motion";
import { useRef, useState } from "react";
import type { AirflowAutomation } from "../lib/desktopClient";
import { useAllowMotion } from "./motion/useAllowMotion";

const ROW = 44;
const NODE_H = 32;
const NODE_W = 220;
const WIDTH = 600;
const RIGHT_X = WIDTH - NODE_W;

function clip(text: string, max = 28): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface DependencyGraphModel {
  sources: string[];
  targets: Array<{ id: string; dagId: string; name: string; enabled: boolean; action: string }>;
  edges: Array<{ from: number; to: number }>;
}

/** Saved dependency edges only: each automation's DAG waits on its configured upstream DAGs. */
export function buildDependencyGraph(automations: AirflowAutomation[]): DependencyGraphModel {
  const deps = (automation: AirflowAutomation) => (Array.isArray(automation.dependencyDagIds) ? automation.dependencyDagIds.filter((dag): dag is string => typeof dag === "string" && dag.length > 0) : []);
  const withDeps = automations.filter((automation) => deps(automation).length > 0);
  const sources = [...new Set(withDeps.flatMap(deps))].sort();
  const targets = withDeps.map((automation) => ({ id: automation.id, dagId: automation.dagId, name: automation.name, enabled: automation.enabled, action: automation.actionType }));
  const edges = withDeps.flatMap((automation, to) => [...new Set(deps(automation))].map((dag) => ({ from: sources.indexOf(dag), to })));
  return { sources, targets, edges };
}

type Focus = { kind: "upstream"; index: number } | { kind: "automation"; index: number } | null;

export function AirflowDependencyGraph({ automations }: { automations: AirflowAutomation[] }) {
  const graph = buildDependencyGraph(automations);
  const motionOk = useAllowMotion();
  const [focus, setFocus] = useState<Focus>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  if (!graph.targets.length) return null;
  const rows = Math.max(graph.sources.length, graph.targets.length);
  const height = rows * ROW;
  const offset = (count: number) => ((rows - count) * ROW) / 2;
  const yLeft = (index: number) => offset(graph.sources.length) + index * ROW + ROW / 2;
  const yRight = (index: number) => offset(graph.targets.length) + index * ROW + ROW / 2;
  const edgeLit = (edge: { from: number; to: number }) => focus === null ? null
    : focus.kind === "upstream" ? edge.from === focus.index : edge.to === focus.index;
  const nodeLit = (kind: "upstream" | "automation", index: number) => {
    if (focus === null) return null;
    if (focus.kind === kind) return focus.index === index;
    return graph.edges.some((edge) => kind === "upstream" ? edge.from === index && edge.to === focus.index : edge.to === index && edge.from === focus.index);
  };
  const zoom = (factor: number) => setView((v) => ({ ...v, scale: Math.min(2.5, Math.max(0.6, v.scale * factor)) }));
  const transform = `translate(${view.x} ${view.y}) translate(${WIDTH / 2} ${height / 2}) scale(${view.scale}) translate(${-WIDTH / 2} ${-height / 2})`;
  const related = focus && (focus.kind === "upstream"
    ? `${graph.sources[focus.index]} gates ${graph.edges.filter((e) => e.from === focus.index).map((e) => graph.targets[e.to].dagId).join(", ")}`
    : `${graph.targets[focus.index].dagId} waits for ${graph.edges.filter((e) => e.to === focus.index).map((e) => graph.sources[e.from]).join(", ")}`);
  return (
    <figure className="airflow-dependency-graph" aria-label="Saved automation dependencies" data-focused={focus ? "true" : undefined}>
      <figcaption>
        <span>Saved dependencies</span>
        <span className="airflow-dependency-graph-note">Configured upstream DAGs, not live readiness</span>
        <span className="airflow-dependency-graph-tools">
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.2)}>−</button>
          <button type="button" aria-label="Reset view" onClick={() => setView({ scale: 1, x: 0, y: 0 })}>Fit</button>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.2)}>+</button>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby="airflow-dependency-graph-desc" preserveAspectRatio="xMidYMin meet"
        onWheel={(event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1); }}
        onPointerDown={(event) => { if ((event.target as Element).closest(".airflow-dependency-node")) return; drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }; event.currentTarget.setPointerCapture?.(event.pointerId); }}
        onPointerMove={(event) => { const d = drag.current; if (!d) return; const box = event.currentTarget.getBoundingClientRect(); const k = box.width ? WIDTH / box.width : 1; setView((v) => ({ ...v, x: d.vx + (event.clientX - d.x) * k, y: d.vy + (event.clientY - d.y) * k })); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <desc id="airflow-dependency-graph-desc">{graph.edges.map((edge) => `${graph.sources[edge.from]} before ${graph.targets[edge.to].dagId}`).join("; ")}</desc>
        <defs>
          <marker id="airflow-dependency-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" className="airflow-dependency-arrowhead" />
          </marker>
        </defs>
        <g transform={transform} className="airflow-dependency-canvas">
        {graph.edges.map((edge, index) => {
          const y1 = yLeft(edge.from);
          const y2 = yRight(edge.to);
          const mid = (NODE_W + RIGHT_X) / 2;
          const lit = edgeLit(edge);
          return <motion.path key={`${edge.from}-${edge.to}`} className="airflow-dependency-edge" data-lit={lit === null ? undefined : String(lit)}
            d={`M${NODE_W} ${y1} C${mid} ${y1} ${mid} ${y2} ${RIGHT_X - 2} ${y2}`} markerEnd="url(#airflow-dependency-arrow)"
            initial={motionOk ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.7, delay: 0.15 + index * 0.06, ease: [0.22, 1, 0.36, 1] }} />;
        })}
        {graph.sources.map((dag, index) => (
          <g key={dag} className="airflow-dependency-node" data-kind="upstream" data-lit={nodeLit("upstream", index) === null ? undefined : String(nodeLit("upstream", index))}
            transform={`translate(0 ${yLeft(index) - NODE_H / 2})`} tabIndex={0} role="button" aria-label={`Upstream DAG ${dag}`}
            onPointerEnter={() => setFocus({ kind: "upstream", index })} onPointerLeave={() => setFocus(null)} onFocus={() => setFocus({ kind: "upstream", index })} onBlur={() => setFocus(null)}>
            <title>{dag}</title>
            <rect width={NODE_W} height={NODE_H} rx="8" />
            <circle className="airflow-dependency-port" cx={NODE_W} cy={NODE_H / 2} r="3" />
            <text x="12" y={NODE_H / 2 + 4}>{clip(dag)}</text>
          </g>
        ))}
        {graph.targets.map((target, index) => (
          <g key={target.id} className="airflow-dependency-node" data-kind="automation" data-enabled={target.enabled ? "true" : "false"}
            data-lit={nodeLit("automation", index) === null ? undefined : String(nodeLit("automation", index))}
            transform={`translate(${RIGHT_X} ${yRight(index) - NODE_H / 2})`} tabIndex={0} role="button" aria-label={`Automation DAG ${target.dagId}${target.enabled ? "" : ", paused"}`}
            onPointerEnter={() => setFocus({ kind: "automation", index })} onPointerLeave={() => setFocus(null)} onFocus={() => setFocus({ kind: "automation", index })} onBlur={() => setFocus(null)}>
            <title>{`${target.name} · ${target.dagId} → ${target.action.replaceAll("_", " ")}${target.enabled ? "" : " · paused"}`}</title>
            <rect width={NODE_W} height={NODE_H} rx="8" />
            <circle className="airflow-dependency-port" cx={0} cy={NODE_H / 2} r="3" />
            <text x="12" y={NODE_H / 2 + 4}>{clip(target.dagId, target.enabled ? 28 : 20)}{target.enabled ? "" : " · paused"}</text>
          </g>
        ))}
        </g>
      </svg>
      <p className="airflow-dependency-graph-status" role="status" aria-live="polite">{related ?? "Hover or focus a DAG to trace its saved dependencies. Drag to pan; use the buttons or Ctrl and scroll to zoom."}</p>
    </figure>
  );
}
