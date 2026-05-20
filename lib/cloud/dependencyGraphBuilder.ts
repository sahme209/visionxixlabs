/**
 * Pure dependency graph builder.
 *
 * Folds a flat list of resource records + their declared upstreams
 * into an adjacency map. Computes:
 *   - reverse edges (downstream consumers)
 *   - blast-radius classification (single_resource | service | account | org)
 *   - topological order (for safe upgrade staging)
 *   - cycles (returned, not thrown — caller decides what to do)
 *
 * Pure / deterministic. No DB.
 */

export interface ResourceNode {
  id: string;
  service: string;        // e.g. "checkout-api"
  account: string;        // e.g. "aws:123456789012"
  upstreams: readonly string[];
}

export interface BuiltGraph {
  nodeById: Record<string, ResourceNode>;
  forward: Record<string, readonly string[]>;   // upstreams (declared)
  reverse: Record<string, readonly string[]>;   // downstream consumers
  topoOrder: string[];                          // partial order if cycle present
  cycles: string[][];
}

export type BlastRadius = "single_resource" | "service" | "account" | "org";

export function buildDependencyGraph(nodes: readonly ResourceNode[]): BuiltGraph {
  const nodeById: Record<string, ResourceNode> = {};
  const forward: Record<string, string[]> = {};
  const reverse: Record<string, string[]> = {};
  for (const n of nodes) {
    nodeById[n.id] = n;
    forward[n.id] = forward[n.id] ?? [];
    reverse[n.id] = reverse[n.id] ?? [];
  }
  for (const n of nodes) {
    for (const u of n.upstreams) {
      // Skip dangling upstream references — keep the graph well-formed.
      if (!nodeById[u]) continue;
      forward[n.id].push(u);
      reverse[u] = reverse[u] ?? [];
      reverse[u].push(n.id);
    }
  }

  // Kahn's algorithm: order by zero-indegree. indegree here = number of
  // upstreams a node still depends on (i.e. forward[id].length copy).
  const indegree: Record<string, number> = {};
  for (const id of Object.keys(forward)) indegree[id] = forward[id].length;
  const queue: string[] = Object.keys(indegree).filter((id) => indegree[id] === 0).sort();
  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topoOrder.push(id);
    for (const consumer of reverse[id]) {
      indegree[consumer] -= 1;
      if (indegree[consumer] === 0) queue.push(consumer);
    }
  }
  const cycles = topoOrder.length === Object.keys(nodeById).length ? [] : detectCycles(forward);

  return { nodeById, forward, reverse, topoOrder, cycles };
}

function detectCycles(forward: Record<string, readonly string[]>): string[][] {
  // Tarjan's SCC — only return SCCs with size >= 2 (cycles).
  const ids = Object.keys(forward);
  const indexMap = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let idx = 0;

  const strongConnect = (v: string): void => {
    indexMap.set(v, idx);
    lowlink.set(v, idx);
    idx += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of forward[v] ?? []) {
      if (!indexMap.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indexMap.get(w)!));
      }
    }
    if (lowlink.get(v) === indexMap.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      if (scc.length >= 2) cycles.push(scc.sort());
    }
  };

  for (const id of ids) if (!indexMap.has(id)) strongConnect(id);
  return cycles;
}

/**
 * Compute blast radius of changing a single node, by walking the
 * reverse edges and inspecting the spread of impacted services /
 * accounts.
 */
export function blastRadiusOf(graph: BuiltGraph, nodeId: string): { radius: BlastRadius; impactedIds: string[] } {
  const start = graph.nodeById[nodeId];
  if (!start) return { radius: "single_resource", impactedIds: [] };
  const visited = new Set<string>([nodeId]);
  const queue: string[] = [...(graph.reverse[nodeId] ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const c of graph.reverse[id] ?? []) if (!visited.has(c)) queue.push(c);
  }
  visited.delete(nodeId);
  const impactedIds = [...visited].sort();
  if (impactedIds.length === 0) return { radius: "single_resource", impactedIds };
  const services = new Set<string>();
  const accounts = new Set<string>();
  for (const id of impactedIds) {
    const n = graph.nodeById[id];
    if (!n) continue;
    services.add(n.service);
    accounts.add(n.account);
  }
  if (accounts.size > 1) return { radius: "org", impactedIds };
  if (services.size > 1) return { radius: "account", impactedIds };
  return { radius: "service", impactedIds };
}
