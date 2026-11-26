import type { AirflowAutomation } from "../lib/desktopClient";

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

export function AirflowDependencyGraph({ automations }: { automations: AirflowAutomation[] }) {
  const graph = buildDependencyGraph(automations);
  if (!graph.targets.length) return null;
  const rows = Math.max(graph.sources.length, graph.targets.length);
  const height = rows * ROW;
  const offset = (count: number) => ((rows - count) * ROW) / 2;
  const yLeft = (index: number) => offset(graph.sources.length) + index * ROW + ROW / 2;
  const yRight = (index: number) => offset(graph.targets.length) + index * ROW + ROW / 2;
  return (
    <figure className="airflow-dependency-graph" aria-label="Saved automation dependencies">
      <figcaption>
        <span>Saved dependencies</span>
        <span className="airflow-dependency-graph-note">Configured upstream DAGs, not live readiness</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby="airflow-dependency-graph-desc" preserveAspectRatio="xMidYMin meet">
        <desc id="airflow-dependency-graph-desc">{graph.edges.map((edge) => `${graph.sources[edge.from]} before ${graph.targets[edge.to].dagId}`).join("; ")}</desc>
        <defs>
          <marker id="airflow-dependency-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L8 4 L0 8 z" className="airflow-dependency-arrowhead" />
          </marker>
        </defs>
        {graph.edges.map((edge) => {
          const y1 = yLeft(edge.from);
          const y2 = yRight(edge.to);
          const mid = (NODE_W + RIGHT_X) / 2;
          return <path key={`${edge.from}-${edge.to}`} className="airflow-dependency-edge" d={`M${NODE_W} ${y1} C${mid} ${y1} ${mid} ${y2} ${RIGHT_X - 2} ${y2}`} markerEnd="url(#airflow-dependency-arrow)" />;
        })}
        {graph.sources.map((dag, index) => (
          <g key={dag} className="airflow-dependency-node" data-kind="upstream" transform={`translate(0 ${yLeft(index) - NODE_H / 2})`}>
            <title>{dag}</title>
            <rect width={NODE_W} height={NODE_H} rx="8" />
            <text x="12" y={NODE_H / 2 + 4}>{clip(dag)}</text>
          </g>
        ))}
        {graph.targets.map((target, index) => (
          <g key={target.id} className="airflow-dependency-node" data-kind="automation" data-enabled={target.enabled ? "true" : "false"} transform={`translate(${RIGHT_X} ${yRight(index) - NODE_H / 2})`}>
            <title>{`${target.name} · ${target.dagId} → ${target.action.replaceAll("_", " ")}${target.enabled ? "" : " · paused"}`}</title>
            <rect width={NODE_W} height={NODE_H} rx="8" />
            <text x="12" y={NODE_H / 2 + 4}>{clip(target.dagId, target.enabled ? 28 : 20)}{target.enabled ? "" : " · paused"}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
