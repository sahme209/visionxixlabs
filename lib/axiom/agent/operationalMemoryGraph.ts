/**
 * Axiom Agent — Operational Memory Graph
 *
 * A connected graph layer over the flat memory stores defined in
 * memorySystem.ts. While memorySystem stores episodic, semantic,
 * procedural, and organizational memories in isolated lists, this
 * module connects them into a traversable graph where:
 *
 *   Resource → was-affected-by → Incident → triggered → Rollback
 *   Approval → authorized → Execution → produced → Optimization
 *   Policy → governs → Resource → resides-in → Region
 *   Workflow → depends-on → Provider → maps-to → Resource
 *
 * The graph enables:
 *   - Multi-hop reasoning ("what incidents affected resources in us-east-1?")
 *   - Temporal queries ("how has this VPC evolved over the last 90 days?")
 *   - Impact analysis ("if we change this policy, what resources are affected?")
 *   - Cross-provider correlation ("which Azure VMs mirror AWS EC2 patterns?")
 *   - Organizational learning ("which approval paths lead to fastest resolution?")
 *
 * Design constraints:
 *   - Graph is append-only (edges are never silently deleted)
 *   - Every mutation produces an audit entry
 *   - Expired nodes are compressed, not removed
 *   - The graph never stores credentials or secrets
 *   - Traversal respects governance boundaries
 *   - Memory growth is bounded by configurable limits
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. GRAPH ENTITY TYPES — NODES IN THE MEMORY GRAPH
// ═══════════════════════════════════════════════════════════════════════════

export type GraphNodeKind =
  | "resource"           // a cloud resource (EC2, VM, GCE, S3 bucket, etc.)
  | "region"             // a cloud region (us-east-1, westeurope, us-central1)
  | "provider"           // a cloud provider (aws, azure, gcp)
  | "incident"           // a detected problem (outage, drift, security event)
  | "optimization"       // a cost/performance optimization applied or proposed
  | "approval"           // a human approval decision
  | "rollback"           // a rollback event
  | "risk"               // a tracked risk (technical, product, compliance)
  | "workflow"           // an automation workflow
  | "policy"             // a governance or compliance policy
  | "execution"          // an agent execution (scan, plan, apply)
  | "finding"            // a specific finding from a scan
  | "snapshot"           // a point-in-time infrastructure snapshot
  | "team_member"        // a person in the org (approver, operator, reviewer)
  | "cost_event"         // a cost anomaly or savings realization
  | "compliance_check";  // a compliance evaluation result

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  orgId: string;
  provider: GraphProvider | null;
  region: string | null;
  label: string;
  properties: Record<string, unknown>;
  created: string;
  updated: string;
  staleness: GraphStaleness;
  compressed: boolean;
  compressedSummary: string | null;
  accessCount: number;
  lastAccessed: string;
  ttlDays: number | null;
  tags: string[];
};

export type GraphProvider = "aws" | "azure" | "gcp" | "multi";

export type GraphStaleness = "live" | "recent" | "aging" | "stale" | "archived";

// ═══════════════════════════════════════════════════════════════════════════
// 2. GRAPH EDGE TYPES — RELATIONSHIPS BETWEEN NODES
// ═══════════════════════════════════════════════════════════════════════════

export type GraphEdgeKind =
  // Resource relationships
  | "resides_in"           // resource → region
  | "hosted_by"            // resource → provider
  | "depends_on"           // resource → resource
  | "mirrors"              // resource → resource (cross-provider equivalent)
  // Incident relationships
  | "affected"             // incident → resource
  | "detected_by"          // incident → execution (which scan found it)
  | "resolved_by"          // incident → execution (which apply fixed it)
  | "caused_rollback"      // incident → rollback
  | "similar_to"           // incident → incident (pattern match)
  // Execution relationships
  | "produced_finding"     // execution → finding
  | "generated_plan"       // execution → execution (scan → plan)
  | "applied_change"       // execution → resource
  | "authorized_by"        // execution → approval
  | "triggered_by"         // execution → workflow
  | "captured_snapshot"    // execution → snapshot
  // Optimization relationships
  | "optimized"            // optimization → resource
  | "saved_cost"           // optimization → cost_event
  | "proposed_by"          // optimization → finding
  | "approved_via"         // optimization → approval
  // Governance relationships
  | "governs"              // policy → resource / region / provider
  | "violated_by"          // policy → finding
  | "evaluated_in"         // policy → compliance_check
  // People relationships
  | "approved_by"          // approval → team_member
  | "escalated_to"         // incident → team_member
  | "owned_by"             // resource → team_member
  // Temporal relationships
  | "succeeded_by"         // snapshot → snapshot (temporal chain)
  | "evolved_from"         // resource → resource (version evolution)
  | "preceded"             // execution → execution (causal chain)
  // Risk relationships
  | "exposes"              // resource → risk
  | "mitigated_by"         // risk → execution
  | "accepted_by";         // risk → approval

export type GraphEdge = {
  id: string;
  kind: GraphEdgeKind;
  sourceId: string;
  targetId: string;
  orgId: string;
  weight: number;            // 0.0–1.0, relevance/strength of relationship
  properties: Record<string, unknown>;
  created: string;
  evidence: string;          // why this edge exists
  confidence: number;        // 0–100
  bidirectional: boolean;
  expired: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. GRAPH SCHEMA — THE VALID CONNECTIONS
// ═══════════════════════════════════════════════════════════════════════════

export type EdgeSchema = {
  kind: GraphEdgeKind;
  sourceKinds: GraphNodeKind[];
  targetKinds: GraphNodeKind[];
  cardinality: "one_to_one" | "one_to_many" | "many_to_many";
  temporalDecay: boolean;
  maxAge: string;
  description: string;
};

export const EDGE_SCHEMAS: EdgeSchema[] = [
  // Resource relationships
  {
    kind: "resides_in",
    sourceKinds: ["resource"],
    targetKinds: ["region"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Resource is deployed in a cloud region",
  },
  {
    kind: "hosted_by",
    sourceKinds: ["resource"],
    targetKinds: ["provider"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Resource belongs to a cloud provider",
  },
  {
    kind: "depends_on",
    sourceKinds: ["resource"],
    targetKinds: ["resource"],
    cardinality: "many_to_many",
    temporalDecay: true,
    maxAge: "90d",
    description: "Resource depends on another resource (inferred from config, traffic, or IAM)",
  },
  {
    kind: "mirrors",
    sourceKinds: ["resource"],
    targetKinds: ["resource"],
    cardinality: "one_to_one",
    temporalDecay: true,
    maxAge: "180d",
    description: "Cross-provider equivalent resource (e.g., EC2 ↔ Azure VM doing the same job)",
  },
  // Incident relationships
  {
    kind: "affected",
    sourceKinds: ["incident"],
    targetKinds: ["resource"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Incident affected one or more resources",
  },
  {
    kind: "detected_by",
    sourceKinds: ["incident"],
    targetKinds: ["execution"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Incident was detected by an agent execution",
  },
  {
    kind: "resolved_by",
    sourceKinds: ["incident"],
    targetKinds: ["execution"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Incident was resolved by an agent execution",
  },
  {
    kind: "caused_rollback",
    sourceKinds: ["incident"],
    targetKinds: ["rollback"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Incident caused a rollback action",
  },
  {
    kind: "similar_to",
    sourceKinds: ["incident"],
    targetKinds: ["incident"],
    cardinality: "many_to_many",
    temporalDecay: true,
    maxAge: "365d",
    description: "Two incidents share a similar pattern (same root cause, same resource type)",
  },
  // Execution relationships
  {
    kind: "produced_finding",
    sourceKinds: ["execution"],
    targetKinds: ["finding"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Agent execution produced findings",
  },
  {
    kind: "generated_plan",
    sourceKinds: ["execution"],
    targetKinds: ["execution"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Scan execution led to a plan execution",
  },
  {
    kind: "applied_change",
    sourceKinds: ["execution"],
    targetKinds: ["resource"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Execution applied a change to a resource",
  },
  {
    kind: "authorized_by",
    sourceKinds: ["execution"],
    targetKinds: ["approval"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Execution was authorized by an approval",
  },
  {
    kind: "triggered_by",
    sourceKinds: ["execution"],
    targetKinds: ["workflow"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Execution was triggered by a workflow",
  },
  {
    kind: "captured_snapshot",
    sourceKinds: ["execution"],
    targetKinds: ["snapshot"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Execution captured a snapshot of infrastructure state",
  },
  // Optimization relationships
  {
    kind: "optimized",
    sourceKinds: ["optimization"],
    targetKinds: ["resource"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Optimization was applied to a resource",
  },
  {
    kind: "saved_cost",
    sourceKinds: ["optimization"],
    targetKinds: ["cost_event"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Optimization produced a cost savings event",
  },
  {
    kind: "proposed_by",
    sourceKinds: ["optimization"],
    targetKinds: ["finding"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Optimization was proposed by a finding",
  },
  {
    kind: "approved_via",
    sourceKinds: ["optimization"],
    targetKinds: ["approval"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Optimization was approved through an approval chain",
  },
  // Governance relationships
  {
    kind: "governs",
    sourceKinds: ["policy"],
    targetKinds: ["resource", "region", "provider"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Policy governs resources, regions, or providers",
  },
  {
    kind: "violated_by",
    sourceKinds: ["policy"],
    targetKinds: ["finding"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Policy was violated by a finding",
  },
  {
    kind: "evaluated_in",
    sourceKinds: ["policy"],
    targetKinds: ["compliance_check"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Policy was evaluated in a compliance check",
  },
  // People relationships
  {
    kind: "approved_by",
    sourceKinds: ["approval"],
    targetKinds: ["team_member"],
    cardinality: "many_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Approval was granted by a team member",
  },
  {
    kind: "escalated_to",
    sourceKinds: ["incident"],
    targetKinds: ["team_member"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Incident was escalated to a team member",
  },
  {
    kind: "owned_by",
    sourceKinds: ["resource"],
    targetKinds: ["team_member"],
    cardinality: "many_to_many",
    temporalDecay: true,
    maxAge: "180d",
    description: "Resource is owned/managed by a team member",
  },
  // Temporal relationships
  {
    kind: "succeeded_by",
    sourceKinds: ["snapshot"],
    targetKinds: ["snapshot"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Snapshot is succeeded by a newer snapshot (temporal chain)",
  },
  {
    kind: "evolved_from",
    sourceKinds: ["resource"],
    targetKinds: ["resource"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Resource evolved from a previous version (type change, resize, replacement)",
  },
  {
    kind: "preceded",
    sourceKinds: ["execution"],
    targetKinds: ["execution"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Execution preceded another in a causal chain",
  },
  // Risk relationships
  {
    kind: "exposes",
    sourceKinds: ["resource"],
    targetKinds: ["risk"],
    cardinality: "many_to_many",
    temporalDecay: true,
    maxAge: "90d",
    description: "Resource exposes a tracked risk",
  },
  {
    kind: "mitigated_by",
    sourceKinds: ["risk"],
    targetKinds: ["execution"],
    cardinality: "one_to_many",
    temporalDecay: false,
    maxAge: "never",
    description: "Risk was mitigated by an execution",
  },
  {
    kind: "accepted_by",
    sourceKinds: ["risk"],
    targetKinds: ["approval"],
    cardinality: "one_to_one",
    temporalDecay: false,
    maxAge: "never",
    description: "Risk was explicitly accepted via approval",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. MEMORY GRAPH CONTAINER
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryGraph = {
  orgId: string;
  version: number;
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  adjacency: Map<string, string[]>;       // nodeId → [edgeId, ...]
  reverseAdjacency: Map<string, string[]>; // nodeId → [edgeId, ...] (incoming)
  stats: GraphStats;
  created: string;
  lastUpdated: string;
  lastCompaction: string | null;
};

export type GraphStats = {
  totalNodes: number;
  totalEdges: number;
  nodesByKind: Record<GraphNodeKind, number>;
  edgesByKind: Record<GraphEdgeKind, number>;
  compressedNodes: number;
  archivedNodes: number;
  avgEdgesPerNode: number;
  maxDepth: number;
  connectedComponents: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. GRAPH QUERY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type GraphQuery = {
  startNodeId?: string;
  startNodeKind?: GraphNodeKind;
  traversal: TraversalStrategy;
  edgeFilter?: GraphEdgeKind[];
  nodeFilter?: GraphNodeKind[];
  providerFilter?: GraphProvider[];
  regionFilter?: string[];
  timeRange?: { from: string; to: string };
  maxDepth: number;
  maxResults: number;
  includeCompressed: boolean;
  includeArchived: boolean;
  sortBy: "relevance" | "recency" | "access_count" | "confidence";
};

export type TraversalStrategy =
  | "bfs"                // breadth-first search
  | "dfs"                // depth-first search
  | "shortest_path"      // find shortest path between two nodes
  | "neighborhood"       // all nodes within N hops
  | "temporal_chain"     // follow succeeded_by / preceded edges
  | "causal_chain"       // follow detected_by → resolved_by → caused_rollback
  | "impact_radius"      // all nodes affected if this node changes
  | "provenance_trace";  // trace how a decision was made

export type GraphQueryResult = {
  query: GraphQuery;
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: GraphPath[];
  executionTimeMs: number;
  truncated: boolean;
  totalMatches: number;
};

export type GraphPath = {
  nodeIds: string[];
  edgeIds: string[];
  totalWeight: number;
  length: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. RETRIEVAL FLOW — HOW MEMORY IS ACCESSED DURING COGNITION
// ═══════════════════════════════════════════════════════════════════════════

export type RetrievalRequest = {
  phase: string;                     // cognitive phase requesting memory
  intent: RetrievalIntent;
  context: RetrievalContext;
  constraints: RetrievalConstraints;
};

export type RetrievalIntent =
  | "resource_history"         // what happened to this resource over time
  | "incident_correlation"     // find related incidents
  | "optimization_candidates"  // resources that match optimization patterns
  | "approval_precedent"       // how were similar changes approved before
  | "rollback_precedent"       // what rollback strategies worked for this type
  | "policy_coverage"          // which policies apply to this resource
  | "risk_assessment"          // what risks does this resource expose
  | "execution_replay"         // what happened during a previous execution
  | "cross_provider_mapping"   // find equivalent resources across providers
  | "temporal_evolution"       // how has this entity evolved
  | "impact_analysis"          // what would be affected by a change
  | "team_context";            // who owns, approves, operates this resource

export type RetrievalContext = {
  currentProvider: GraphProvider | null;
  currentRegion: string | null;
  resourceIds: string[];
  findingCategories: string[];
  activeIncidentIds: string[];
  recentExecutionIds: string[];
};

export type RetrievalConstraints = {
  maxNodes: number;
  maxEdges: number;
  maxDepth: number;
  maxAgedays: number;
  minConfidence: number;
  excludeCompressed: boolean;
  excludeArchived: boolean;
  respectGovernance: boolean;
};

export type RetrievalResult = {
  intent: RetrievalIntent;
  subgraph: GraphQueryResult;
  summary: string;
  confidence: number;
  relevanceScore: number;
  staleWarnings: string[];
  governanceFiltered: number;
  retrievalTimeMs: number;
};

export const RETRIEVAL_FLOW: {
  phase: string;
  intents: RetrievalIntent[];
  purpose: string;
  maxLatencyMs: number;
}[] = [
  {
    phase: "observe",
    intents: ["resource_history", "temporal_evolution"],
    purpose: "Compare current snapshot against historical state to detect meaningful changes vs noise",
    maxLatencyMs: 500,
  },
  {
    phase: "interpret",
    intents: ["incident_correlation", "cross_provider_mapping"],
    purpose: "Classify observations by correlating with known incident patterns and cross-provider knowledge",
    maxLatencyMs: 300,
  },
  {
    phase: "reason",
    intents: ["optimization_candidates", "risk_assessment", "impact_analysis"],
    purpose: "Weigh tradeoffs using historical optimization success, known risks, and blast radius",
    maxLatencyMs: 1000,
  },
  {
    phase: "prioritize",
    intents: ["approval_precedent", "team_context"],
    purpose: "Rank actions by historical approval velocity, team preferences, and org context",
    maxLatencyMs: 200,
  },
  {
    phase: "plan",
    intents: ["execution_replay", "rollback_precedent"],
    purpose: "Build execution plans informed by previous successes, failures, and rollback playbooks",
    maxLatencyMs: 500,
  },
  {
    phase: "execute",
    intents: ["policy_coverage"],
    purpose: "Verify execution does not violate governance policies before applying changes",
    maxLatencyMs: 100,
  },
  {
    phase: "verify",
    intents: ["temporal_evolution", "resource_history"],
    purpose: "Confirm post-apply state matches expectations by comparing to historical baselines",
    maxLatencyMs: 300,
  },
  {
    phase: "reflect",
    intents: ["incident_correlation", "optimization_candidates"],
    purpose: "Evaluate loop quality by checking if known patterns were handled correctly",
    maxLatencyMs: 500,
  },
  {
    phase: "learn",
    intents: ["cross_provider_mapping", "approval_precedent", "rollback_precedent"],
    purpose: "Update memory graph with new edges, patterns, and compressed historical data",
    maxLatencyMs: 2000,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. SUMMARIZATION STRATEGY — COMPRESSING SUBGRAPHS
// ═══════════════════════════════════════════════════════════════════════════

export type SummarizationStrategy =
  | "temporal_rollup"       // merge consecutive snapshots into period summary
  | "incident_digest"       // compress related incidents into pattern summary
  | "execution_batch"       // merge repeated identical executions
  | "resource_lifecycle"    // compress full create→modify→delete chain
  | "approval_pattern"      // summarize recurring approval decisions
  | "cost_trend"            // compress daily cost events into monthly trends
  | "compliance_history";   // merge compliance checks into posture summary

export type SummarizationRule = {
  strategy: SummarizationStrategy;
  triggersWhen: SummarizationTrigger;
  inputNodeKinds: GraphNodeKind[];
  outputNodeKind: GraphNodeKind;
  preserveEdgeKinds: GraphEdgeKind[];
  maxInputNodes: number;
  minAgedays: number;
  retainOriginals: boolean;
  description: string;
};

export type SummarizationTrigger =
  | { type: "node_count_exceeds"; threshold: number }
  | { type: "age_exceeds_days"; days: number }
  | { type: "access_count_below"; threshold: number; periodDays: number }
  | { type: "manual" };

export type SummarizationResult = {
  strategy: SummarizationStrategy;
  inputNodeCount: number;
  outputNodeCount: number;
  edgesRemoved: number;
  edgesCreated: number;
  compressionRatio: number;
  summaryText: string;
  preservedProperties: string[];
  lostProperties: string[];
  reversible: boolean;
};

export const SUMMARIZATION_RULES: SummarizationRule[] = [
  {
    strategy: "temporal_rollup",
    triggersWhen: { type: "node_count_exceeds", threshold: 100 },
    inputNodeKinds: ["snapshot"],
    outputNodeKind: "snapshot",
    preserveEdgeKinds: ["succeeded_by", "captured_snapshot"],
    maxInputNodes: 30,
    minAgedays: 30,
    retainOriginals: false,
    description: "Roll up daily snapshots older than 30 days into weekly summaries. Preserves min/max/avg for each metric. Keeps the temporal chain intact by relinking succeeded_by edges.",
  },
  {
    strategy: "incident_digest",
    triggersWhen: { type: "node_count_exceeds", threshold: 200 },
    inputNodeKinds: ["incident"],
    outputNodeKind: "incident",
    preserveEdgeKinds: ["affected", "resolved_by", "similar_to"],
    maxInputNodes: 50,
    minAgedays: 90,
    retainOriginals: false,
    description: "Merge similar resolved incidents older than 90 days into pattern digests. Keeps the worst-case severity, total count, and resolution strategies.",
  },
  {
    strategy: "execution_batch",
    triggersWhen: { type: "node_count_exceeds", threshold: 500 },
    inputNodeKinds: ["execution"],
    outputNodeKind: "execution",
    preserveEdgeKinds: ["produced_finding", "applied_change", "authorized_by"],
    maxInputNodes: 100,
    minAgedays: 60,
    retainOriginals: false,
    description: "Batch repeated scan executions with identical findings into summary nodes. Preserves unique findings and outcome statistics.",
  },
  {
    strategy: "resource_lifecycle",
    triggersWhen: { type: "age_exceeds_days", days: 180 },
    inputNodeKinds: ["resource"],
    outputNodeKind: "resource",
    preserveEdgeKinds: ["resides_in", "hosted_by", "depends_on", "owned_by"],
    maxInputNodes: 10,
    minAgedays: 180,
    retainOriginals: false,
    description: "Compress the full lifecycle of a deleted resource into a single archived node. Preserves type changes, total cost, incident count, and final state.",
  },
  {
    strategy: "approval_pattern",
    triggersWhen: { type: "access_count_below", threshold: 2, periodDays: 90 },
    inputNodeKinds: ["approval"],
    outputNodeKind: "approval",
    preserveEdgeKinds: ["approved_by", "authorized_by"],
    maxInputNodes: 50,
    minAgedays: 90,
    retainOriginals: false,
    description: "Summarize old, unaccessed approval records into approval pattern nodes. Preserves approval rates, avg decision time, and approver distribution.",
  },
  {
    strategy: "cost_trend",
    triggersWhen: { type: "node_count_exceeds", threshold: 100 },
    inputNodeKinds: ["cost_event"],
    outputNodeKind: "cost_event",
    preserveEdgeKinds: ["saved_cost"],
    maxInputNodes: 30,
    minAgedays: 60,
    retainOriginals: false,
    description: "Aggregate daily cost events into monthly trend nodes. Preserves total savings, anomaly count, and provider breakdown.",
  },
  {
    strategy: "compliance_history",
    triggersWhen: { type: "age_exceeds_days", days: 90 },
    inputNodeKinds: ["compliance_check"],
    outputNodeKind: "compliance_check",
    preserveEdgeKinds: ["evaluated_in"],
    maxInputNodes: 30,
    minAgedays: 90,
    retainOriginals: false,
    description: "Merge old compliance check results into quarterly posture summaries. Preserves pass/fail counts, worst violations, and trend direction.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. AGING & COMPRESSION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

export type AgingPolicy = {
  nodeKind: GraphNodeKind;
  freshDays: number;         // considered "live" for this many days
  recentDays: number;        // "recent" until this many days
  agingDays: number;         // "aging" until this many days
  staleDays: number;         // "stale" until this many days, then "archived"
  compressAfterDays: number; // eligible for summarization after this
  archiveAfterDays: number;  // moved to cold storage after this
  neverArchive: boolean;     // some node types are always retained
};

export const AGING_POLICIES: AgingPolicy[] = [
  { nodeKind: "resource",         freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 180, archiveAfterDays: 365, neverArchive: false },
  { nodeKind: "region",           freshDays: 1,  recentDays: 30,  agingDays: 90,  staleDays: 365, compressAfterDays: 365, archiveAfterDays: 730, neverArchive: true },
  { nodeKind: "provider",         freshDays: 1,  recentDays: 30,  agingDays: 90,  staleDays: 365, compressAfterDays: 365, archiveAfterDays: 730, neverArchive: true },
  { nodeKind: "incident",         freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 90,  archiveAfterDays: 365, neverArchive: false },
  { nodeKind: "optimization",     freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 90,  archiveAfterDays: 365, neverArchive: false },
  { nodeKind: "approval",         freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 90,  archiveAfterDays: 365, neverArchive: false },
  { nodeKind: "rollback",         freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 180, archiveAfterDays: 365, neverArchive: false },
  { nodeKind: "risk",             freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 90,  archiveAfterDays: 365, neverArchive: false },
  { nodeKind: "workflow",         freshDays: 1,  recentDays: 30,  agingDays: 90,  staleDays: 180, compressAfterDays: 365, archiveAfterDays: 730, neverArchive: false },
  { nodeKind: "policy",           freshDays: 1,  recentDays: 30,  agingDays: 90,  staleDays: 365, compressAfterDays: 365, archiveAfterDays: 730, neverArchive: true },
  { nodeKind: "execution",        freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 60,  compressAfterDays: 60,  archiveAfterDays: 180, neverArchive: false },
  { nodeKind: "finding",          freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 60,  compressAfterDays: 60,  archiveAfterDays: 180, neverArchive: false },
  { nodeKind: "snapshot",         freshDays: 1,  recentDays: 7,   agingDays: 14,  staleDays: 30,  compressAfterDays: 30,  archiveAfterDays: 90,  neverArchive: false },
  { nodeKind: "team_member",      freshDays: 1,  recentDays: 30,  agingDays: 90,  staleDays: 365, compressAfterDays: 365, archiveAfterDays: 730, neverArchive: true },
  { nodeKind: "cost_event",       freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 60,  compressAfterDays: 60,  archiveAfterDays: 180, neverArchive: false },
  { nodeKind: "compliance_check", freshDays: 1,  recentDays: 7,   agingDays: 30,  staleDays: 90,  compressAfterDays: 90,  archiveAfterDays: 365, neverArchive: false },
];

export type CompactionConfig = {
  maxNodesPerOrg: number;
  maxEdgesPerOrg: number;
  compactionIntervalHours: number;
  targetCompressionRatio: number;
  preserveConnectedComponents: boolean;
  preserveHighConfidenceEdges: boolean;
  minConfidenceToPreserve: number;
  auditCompaction: boolean;
};

export const DEFAULT_COMPACTION: CompactionConfig = {
  maxNodesPerOrg: 50_000,
  maxEdgesPerOrg: 200_000,
  compactionIntervalHours: 24,
  targetCompressionRatio: 0.3,
  preserveConnectedComponents: true,
  preserveHighConfidenceEdges: true,
  minConfidenceToPreserve: 70,
  auditCompaction: true,
};

export type CompactionResult = {
  orgId: string;
  beforeNodes: number;
  afterNodes: number;
  beforeEdges: number;
  afterEdges: number;
  nodesCompressed: number;
  nodesArchived: number;
  edgesExpired: number;
  summarizationsApplied: SummarizationResult[];
  durationMs: number;
  auditEntryId: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. INFRASTRUCTURE EVOLUTION TIMELINE
// ═══════════════════════════════════════════════════════════════════════════

export type EvolutionEvent = {
  id: string;
  orgId: string;
  timestamp: string;
  eventType: EvolutionEventType;
  provider: GraphProvider;
  region: string | null;
  resourceId: string | null;
  description: string;
  impact: EvolutionImpact;
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
};

export type EvolutionEventType =
  | "resource_created"
  | "resource_modified"
  | "resource_deleted"
  | "resource_migrated"        // moved across regions or providers
  | "region_added"
  | "region_removed"
  | "provider_added"
  | "provider_removed"
  | "policy_created"
  | "policy_modified"
  | "policy_deleted"
  | "incident_opened"
  | "incident_resolved"
  | "optimization_applied"
  | "cost_anomaly_detected"
  | "compliance_violation"
  | "compliance_resolved"
  | "team_change"
  | "workflow_activated"
  | "workflow_deactivated";

export type EvolutionImpact = {
  costDelta: number | null;        // positive = increase, negative = savings
  riskDelta: number | null;        // -100 to +100
  complianceDelta: number | null;  // -100 to +100
  resilienceDelta: number | null;  // -100 to +100
  affectedResourceCount: number;
};

export type EvolutionTimeline = {
  orgId: string;
  events: EvolutionEvent[];
  milestones: EvolutionMilestone[];
  periodSummaries: PeriodSummary[];
};

export type EvolutionMilestone = {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  eventIds: string[];
  significance: "minor" | "moderate" | "major" | "critical";
};

export type PeriodSummary = {
  periodStart: string;
  periodEnd: string;
  granularity: "day" | "week" | "month" | "quarter";
  provider: GraphProvider | "all";
  eventCount: number;
  netCostDelta: number;
  netRiskDelta: number;
  incidentCount: number;
  optimizationCount: number;
  rollbackCount: number;
  resourcesAdded: number;
  resourcesRemoved: number;
  complianceScore: number;
  highlights: string[];
};

// ═══════════════════════════════════════════════════════════════════════════
// 10. PRISMA SCHEMA GUIDANCE
// ═══════════════════════════════════════════════════════════════════════════

export const PRISMA_GRAPH_GUIDANCE = `
// ─────────────────────────────────────────────────────────────────────────
// Prisma schema guidance for the Operational Memory Graph
//
// The graph is stored as two core tables (GraphNode, GraphEdge) plus
// supporting tables for evolution tracking, compaction audit, and
// materialized query results.
//
// Design decisions:
//   - Nodes and edges use JSONB for flexible properties
//   - Adjacency is NOT stored as a separate table — it's computed from edges
//   - Compaction history is retained for audit compliance
//   - Materialized views are used for hot queries (resource_history, risk_map)
//   - Partitioned by orgId for tenant isolation
// ─────────────────────────────────────────────────────────────────────────

model MemoryGraphNode {
  id               String           @id @default(cuid())
  orgId            String
  kind             String           // GraphNodeKind
  provider         String?          // "aws" | "azure" | "gcp" | "multi"
  region           String?
  label            String
  properties       Json             // flexible property bag
  tags             String[]
  staleness        String           @default("live")
  compressed       Boolean          @default(false)
  compressedSummary String?
  accessCount      Int              @default(0)
  lastAccessedAt   DateTime         @default(now())
  ttlDays          Int?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  org              Organization     @relation(fields: [orgId], references: [id])

  outgoingEdges    MemoryGraphEdge[] @relation("EdgeSource")
  incomingEdges    MemoryGraphEdge[] @relation("EdgeTarget")

  @@index([orgId, kind])
  @@index([orgId, provider])
  @@index([orgId, staleness])
  @@index([orgId, kind, provider, region])
  @@index([orgId, updatedAt])
}

model MemoryGraphEdge {
  id               String           @id @default(cuid())
  orgId            String
  kind             String           // GraphEdgeKind
  sourceId         String
  targetId         String
  weight           Float            @default(1.0)
  properties       Json
  evidence         String
  confidence       Int              @default(100)
  bidirectional    Boolean          @default(false)
  expired          Boolean          @default(false)
  createdAt        DateTime         @default(now())

  org              Organization     @relation(fields: [orgId], references: [id])
  source           MemoryGraphNode  @relation("EdgeSource", fields: [sourceId], references: [id])
  target           MemoryGraphNode  @relation("EdgeTarget", fields: [targetId], references: [id])

  @@index([orgId, kind])
  @@index([sourceId])
  @@index([targetId])
  @@index([orgId, kind, sourceId])
  @@index([orgId, expired])
}

model EvolutionEvent {
  id               String           @id @default(cuid())
  orgId            String
  eventType        String           // EvolutionEventType
  provider         String
  region           String?
  resourceId       String?
  description      String
  costDelta        Float?
  riskDelta        Float?
  complianceDelta  Float?
  resilienceDelta  Float?
  affectedCount    Int              @default(0)
  relatedNodeIds   String[]
  relatedEdgeIds   String[]
  timestamp        DateTime         @default(now())

  org              Organization     @relation(fields: [orgId], references: [id])

  @@index([orgId, eventType])
  @@index([orgId, timestamp])
  @@index([orgId, provider, timestamp])
}

model GraphCompactionLog {
  id                     String     @id @default(cuid())
  orgId                  String
  beforeNodes            Int
  afterNodes             Int
  beforeEdges            Int
  afterEdges             Int
  nodesCompressed        Int
  nodesArchived          Int
  edgesExpired           Int
  summarizationsApplied  Json       // SummarizationResult[]
  durationMs             Int
  triggeredBy            String     @default("scheduled")
  completedAt            DateTime   @default(now())

  org                    Organization @relation(fields: [orgId], references: [id])

  @@index([orgId, completedAt])
}

// ─────────────────────────────────────────────────────────────────────────
// Materialized query cache (optional, for hot paths)
// ─────────────────────────────────────────────────────────────────────────

model GraphQueryCache {
  id               String           @id @default(cuid())
  orgId            String
  queryHash        String           // deterministic hash of GraphQuery
  resultNodeIds    String[]
  resultEdgeIds    String[]
  cachedAt         DateTime         @default(now())
  expiresAt        DateTime
  hitCount         Int              @default(0)

  @@unique([orgId, queryHash])
  @@index([expiresAt])
}

// ─────────────────────────────────────────────────────────────────────────
// Indexes for common graph queries:
//
// 1. "What happened to resource X?"
//    → MemoryGraphNode WHERE id = X
//    → MemoryGraphEdge WHERE sourceId = X OR targetId = X
//
// 2. "All incidents in us-east-1 in the last 30 days"
//    → MemoryGraphNode WHERE orgId AND kind = "incident" AND region = "us-east-1"
//      AND updatedAt > 30 days ago
//
// 3. "What policies govern this resource?"
//    → MemoryGraphEdge WHERE kind = "governs" AND targetId = resourceId
//    → JOIN MemoryGraphNode on edge.sourceId
//
// 4. "Trace the causal chain for execution X"
//    → Recursive CTE following "preceded", "generated_plan", "authorized_by"
//
// 5. "Cross-provider resource mapping"
//    → MemoryGraphEdge WHERE kind = "mirrors"
// ─────────────────────────────────────────────────────────────────────────
`;

// ═══════════════════════════════════════════════════════════════════════════
// 11. GOVERNANCE BOUNDARIES — MEMORY NEVER BYPASSES GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════

export type GraphGovernanceRule = {
  id: string;
  name: string;
  description: string;
  enforcement: "audit" | "warn" | "block";
  check: string;
};

export const GOVERNANCE_RULES: GraphGovernanceRule[] = [
  {
    id: "gov_no_credential_storage",
    name: "No credential storage",
    description: "Graph nodes and edges must never store credentials, secrets, or API keys in their properties",
    enforcement: "block",
    check: "Scan all node/edge properties for patterns matching secrets, keys, tokens, passwords",
  },
  {
    id: "gov_tenant_isolation",
    name: "Tenant isolation",
    description: "Edges cannot connect nodes belonging to different organizations",
    enforcement: "block",
    check: "On edge creation, verify source.orgId === target.orgId",
  },
  {
    id: "gov_append_only_audit",
    name: "Append-only audit trail",
    description: "Node and edge deletions must produce audit entries before removal",
    enforcement: "block",
    check: "Wrap all delete operations in audit-producing transactions",
  },
  {
    id: "gov_compaction_reversibility",
    name: "Compaction reversibility window",
    description: "Compressed nodes retain originals in cold storage for 30 days",
    enforcement: "warn",
    check: "Verify cold storage retention before finalizing compaction",
  },
  {
    id: "gov_staleness_transparency",
    name: "Staleness transparency",
    description: "Any query result containing stale or archived nodes must flag them in the response",
    enforcement: "audit",
    check: "Include staleWarnings array in every GraphQueryResult",
  },
  {
    id: "gov_confidence_floor",
    name: "Confidence floor for reasoning",
    description: "Edges with confidence below 30 are excluded from reasoning and planning queries",
    enforcement: "block",
    check: "Apply confidence >= 30 filter on edges used in reason/plan phases",
  },
  {
    id: "gov_max_traversal_depth",
    name: "Traversal depth limit",
    description: "Graph traversals are capped at depth 10 to prevent runaway queries",
    enforcement: "block",
    check: "Enforce maxDepth <= 10 in all traversal operations",
  },
  {
    id: "gov_evolution_immutability",
    name: "Evolution event immutability",
    description: "Evolution events are append-only and cannot be modified after creation",
    enforcement: "block",
    check: "Reject UPDATE operations on EvolutionEvent table",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 12. ARCHITECTURE DIAGRAMS
// ═══════════════════════════════════════════════════════════════════════════

export type GraphDiagram = {
  title: string;
  description: string;
  diagram: string;
};

export const GRAPH_DIAGRAMS: GraphDiagram[] = [
  {
    title: "Memory Graph Entity Relationship Map",
    description: "How all 16 node types connect via 30 edge types",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│                    OPERATIONAL MEMORY GRAPH                         │
│                                                                      │
│  ┌──────────┐  resides_in   ┌──────────┐  hosted_by  ┌──────────┐  │
│  │ Resource  │──────────────►│  Region  │             │ Provider │  │
│  │          │───────────────────────────────────────►│          │  │
│  └────┬─────┘               └──────────┘             └──────────┘  │
│       │ depends_on ↕ mirrors ↕ evolved_from                         │
│       │                                                              │
│       ├── exposes ──────────► ┌──────────┐ ◄── mitigated_by ──┐    │
│       │                       │   Risk   │                     │    │
│       │                       └────┬─────┘ ── accepted_by ──┐ │    │
│       │                            │                         │ │    │
│  ┌────▼─────┐  affected     ┌─────▼────┐  authorized_by  ┌──▼─▼──┐│
│  │ Incident │──────────────►│ Approval │◄────────────────│Execut.││
│  │          │── detected_by─┤          │                  │       ││
│  │          │── resolved_by─┤          │── approved_by──►│       ││
│  │          │── caused ─────┤          │                  │       ││
│  └────┬─────┘  rollback     └──────────┘                  └───┬───┘│
│       │ similar_to ↕                                          │    │
│       │ escalated_to──► ┌──────────┐ ◄── owned_by ──┐        │    │
│       │                 │Team Memb.│                  │        │    │
│       │                 └──────────┘                  │        │    │
│       │                                               │        │    │
│  ┌────▼─────┐  optimized  ┌──────────┐  produced    ┌─▼──────┐│    │
│  │Optimizat.│────────────►│ Resource │  finding     │Finding ││    │
│  │          │── saved ───►│          │◄─────────────┤        │◄────│
│  │          │── proposed ─┤          │              └────────┘│    │
│  │          │── approved ─┤          │                        │    │
│  └──────────┘  via        └──────────┘                        │    │
│                                                               │    │
│  ┌──────────┐  governs    ┌──────────┐  triggered_by  ┌──────┐│    │
│  │  Policy  │────────────►│ Resource │  ┌─────────────│Workfl.│◄───│
│  │          │── violated──┤  Region  │  │             └──────┘│    │
│  │          │── evaluated─┤ Provider │  │                      │    │
│  └──────────┘  in         └──────────┘  │  ┌──────────┐       │    │
│                                          │  │ Snapshot │◄──────│    │
│                           ┌──────────┐  │  │          │captured│    │
│                           │Cost Evt. │  │  └────┬─────┘       │    │
│                           │          │◄─│       │ succeeded_by │    │
│                           └──────────┘  │       ▼              │    │
│                           ┌──────────┐  │  ┌──────────┐       │    │
│                           │Compliance│◄─┘  │ Snapshot │       │    │
│                           │  Check   │     └──────────┘       │    │
│                           └──────────┘                        │    │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Retrieval Flow — Memory Access During Cognition",
    description: "How the 9-phase cognitive loop queries the memory graph",
    diagram: `
┌─────────────────────────────────────────────────────────────────────┐
│                     COGNITIVE LOOP                                   │
│                                                                      │
│  ┌─────────┐   ┌───────────┐   ┌────────┐   ┌──────────┐          │
│  │ Observe │──►│ Interpret │──►│ Reason │──►│Prioritize│          │
│  └────┬────┘   └─────┬─────┘   └───┬────┘   └────┬─────┘          │
│       │              │              │              │                  │
│       ▼              ▼              ▼              ▼                  │
│  ┌─────────┐   ┌───────────┐   ┌────────┐   ┌──────────┐          │
│  │resource │   │ incident  │   │optimize│   │ approval │          │
│  │history  │   │correlation│   │candidat│   │precedent │          │
│  │temporal │   │cross-prov.│   │risk    │   │team      │          │
│  │evolution│   │ mapping   │   │impact  │   │context   │          │
│  └────┬────┘   └─────┬─────┘   └───┬────┘   └────┬─────┘          │
│       │              │              │              │                  │
│       └──────────────┴──────────────┴──────────────┘                 │
│                              │                                        │
│                      ┌───────▼────────┐                              │
│                      │  MEMORY GRAPH  │                              │
│                      │  ┌──┐ ┌──┐    │                              │
│                      │  │N ├─┤N │    │   N = Node                   │
│                      │  └┬─┘ └─┬┘    │   ─ = Edge                   │
│                      │   │     │     │                               │
│                      │  ┌▼─┐ ┌─▼┐   │                              │
│                      │  │N ├─┤N │    │                              │
│                      │  └──┘ └──┘    │                              │
│                      └───────┬────────┘                              │
│                              │                                        │
│       ┌──────────────┬───────┴─────────┬──────────────┐              │
│       │              │                 │              │              │
│       ▼              ▼                 ▼              ▼              │
│  ┌─────────┐   ┌───────────┐   ┌────────┐   ┌──────────┐          │
│  │execution│   │ policy    │   │temporal│   │incident  │          │
│  │replay   │   │ coverage  │   │evolut. │   │correlat. │          │
│  │rollback │   │           │   │resource│   │optimize  │          │
│  │precedent│   │           │   │history │   │candidate │          │
│  └────┬────┘   └─────┬─────┘   └───┬────┘   └────┬─────┘          │
│       │              │              │              │                  │
│       ▼              ▼              ▼              ▼                  │
│  ┌─────────┐   ┌───────────┐   ┌────────┐   ┌──────────┐          │
│  │  Plan   │──►│ Execute  │──►│ Verify │──►│ Reflect  │──► Learn │
│  └─────────┘   └───────────┘   └────────┘   └──────────┘          │
└─────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Aging & Compression Pipeline",
    description: "How memory nodes age, compress, and archive over time",
    diagram: `
┌─────────────────────────────────────────────────────────────────────┐
│                   AGING & COMPRESSION PIPELINE                       │
│                                                                      │
│  Day 0          Day 7          Day 30         Day 90        Day 365  │
│  ┌─────┐       ┌─────┐       ┌─────┐       ┌─────┐       ┌─────┐  │
│  │LIVE │──────►│RECNT│──────►│AGING│──────►│STALE│──────►│ARCHV│  │
│  │     │       │     │       │     │       │     │       │     │  │
│  │full │       │full │       │full │       │compr│       │cold │  │
│  │data │       │data │       │data │       │essed│       │stor.│  │
│  └─────┘       └─────┘       └─────┘       └──┬──┘       └──┬──┘  │
│                                                │              │      │
│                              SUMMARIZATION     │              │      │
│                              TRIGGERS          │              │      │
│                              ┌─────────────────▼──┐           │      │
│                              │ temporal_rollup    │           │      │
│                              │ incident_digest    │           │      │
│                              │ execution_batch    │           │      │
│                              │ resource_lifecycle │           │      │
│                              │ approval_pattern   │           │      │
│                              │ cost_trend         │           │      │
│                              │ compliance_history │           │      │
│                              └─────────┬──────────┘           │      │
│                                        │                      │      │
│                                        ▼                      │      │
│                              ┌────────────────────┐           │      │
│                              │ Compressed Summary │           │      │
│                              │ ┌──────────────┐   │           │      │
│                              │ │ key metrics  │   │           │      │
│                              │ │ worst-case   │   │           │      │
│                              │ │ edge links   │   │           │      │
│                              │ │ audit trail  │   │           │      │
│                              │ └──────────────┘   │           │      │
│                              └────────────────────┘           │      │
│                                                               │      │
│  GOVERNANCE CHECKS:                                           │      │
│  ✓ Audit entry before any deletion                            │      │
│  ✓ Cold storage retains originals for 30 days                 │      │
│  ✓ High-confidence edges are never expired                    │      │
│  ✓ Connected components are preserved                         │      │
│  ✓ Compaction log written to GraphCompactionLog               │      │
└─────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Cross-Provider Memory Correlation",
    description: "How the graph connects equivalent concepts across AWS, Azure, and GCP",
    diagram: `
┌─────────────────────────────────────────────────────────────────────┐
│              CROSS-PROVIDER MEMORY CORRELATION                       │
│                                                                      │
│  AWS                        GRAPH                       AZURE       │
│  ┌──────────┐              ┌──────┐              ┌──────────┐      │
│  │ EC2      │── mirrors ──►│      │◄── mirrors ──│ Azure VM │      │
│  │ i-abc123 │              │ Node │              │ vm-xyz   │      │
│  └──────────┘              └──────┘              └──────────┘      │
│  ┌──────────┐              ┌──────┐              ┌──────────┐      │
│  │ S3       │── mirrors ──►│      │◄── mirrors ──│ Blob     │      │
│  │ my-bkt   │              │ Node │              │ Storage  │      │
│  └──────────┘              └──────┘              └──────────┘      │
│                                                                      │
│       GCP                                                            │
│  ┌──────────┐              ┌──────┐                                 │
│  │ GCE      │── mirrors ──►│      │                                 │
│  │ inst-456 │              │ Node │     Shared edges:               │
│  └──────────┘              └──────┘     • similar_to (incidents)    │
│  ┌──────────┐              ┌──────┐     • mirrors (resources)       │
│  │ GCS      │── mirrors ──►│      │     • depends_on (cross-cloud) │
│  │ bucket   │              │ Node │     • governs (unified policy)  │
│  └──────────┘              └──────┘                                 │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                    UNIFIED QUERIES                         │      │
│  │                                                           │      │
│  │  "Show all compute resources across all providers"        │      │
│  │  → Filter: kind=resource, tag=compute, provider=*         │      │
│  │                                                           │      │
│  │  "Which Azure resources have similar incidents to AWS?"   │      │
│  │  → Traverse: incident→similar_to→incident→affected       │      │
│  │  → Filter: cross-provider edges                           │      │
│  │                                                           │      │
│  │  "Unified compliance posture across all clouds"           │      │
│  │  → Aggregate: compliance_check nodes by provider          │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 13. GRAPH OPERATIONS — EXECUTABLE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function createEmptyGraph(orgId: string): MemoryGraph {
  return {
    orgId,
    version: 1,
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    stats: {
      totalNodes: 0,
      totalEdges: 0,
      nodesByKind: Object.fromEntries(
        (["resource", "region", "provider", "incident", "optimization", "approval",
          "rollback", "risk", "workflow", "policy", "execution", "finding",
          "snapshot", "team_member", "cost_event", "compliance_check"] as GraphNodeKind[])
          .map(k => [k, 0])
      ) as Record<GraphNodeKind, number>,
      edgesByKind: {} as Record<GraphEdgeKind, number>,
      compressedNodes: 0,
      archivedNodes: 0,
      avgEdgesPerNode: 0,
      maxDepth: 0,
      connectedComponents: 0,
    },
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    lastCompaction: null,
  };
}

export function addNode(graph: MemoryGraph, node: GraphNode): MemoryGraph {
  if (node.orgId !== graph.orgId) {
    throw new Error(`Tenant isolation violation: node.orgId (${node.orgId}) !== graph.orgId (${graph.orgId})`);
  }
  graph.nodes.set(node.id, node);
  if (!graph.adjacency.has(node.id)) graph.adjacency.set(node.id, []);
  if (!graph.reverseAdjacency.has(node.id)) graph.reverseAdjacency.set(node.id, []);
  graph.stats.totalNodes++;
  graph.stats.nodesByKind[node.kind] = (graph.stats.nodesByKind[node.kind] || 0) + 1;
  if (node.compressed) graph.stats.compressedNodes++;
  if (node.staleness === "archived") graph.stats.archivedNodes++;
  graph.lastUpdated = new Date().toISOString();
  return graph;
}

export function addEdge(graph: MemoryGraph, edge: GraphEdge): MemoryGraph {
  if (edge.orgId !== graph.orgId) {
    throw new Error(`Tenant isolation violation: edge.orgId (${edge.orgId}) !== graph.orgId (${graph.orgId})`);
  }

  const source = graph.nodes.get(edge.sourceId);
  const target = graph.nodes.get(edge.targetId);
  if (!source) throw new Error(`Source node ${edge.sourceId} not found`);
  if (!target) throw new Error(`Target node ${edge.targetId} not found`);

  const schema = EDGE_SCHEMAS.find(s => s.kind === edge.kind);
  if (schema) {
    if (!schema.sourceKinds.includes(source.kind)) {
      throw new Error(`Edge kind "${edge.kind}" does not allow source kind "${source.kind}"`);
    }
    if (!schema.targetKinds.includes(target.kind)) {
      throw new Error(`Edge kind "${edge.kind}" does not allow target kind "${target.kind}"`);
    }
  }

  graph.edges.set(edge.id, edge);
  const adj = graph.adjacency.get(edge.sourceId) || [];
  adj.push(edge.id);
  graph.adjacency.set(edge.sourceId, adj);
  const rev = graph.reverseAdjacency.get(edge.targetId) || [];
  rev.push(edge.id);
  graph.reverseAdjacency.set(edge.targetId, rev);

  graph.stats.totalEdges++;
  graph.stats.edgesByKind[edge.kind] = (graph.stats.edgesByKind[edge.kind] || 0) + 1;
  graph.stats.avgEdgesPerNode = graph.stats.totalNodes > 0
    ? graph.stats.totalEdges / graph.stats.totalNodes
    : 0;
  graph.lastUpdated = new Date().toISOString();
  return graph;
}

export function getNeighbors(
  graph: MemoryGraph,
  nodeId: string,
  direction: "outgoing" | "incoming" | "both" = "both",
  edgeKindFilter?: GraphEdgeKind[],
): { node: GraphNode; edge: GraphEdge; direction: "outgoing" | "incoming" }[] {
  const results: { node: GraphNode; edge: GraphEdge; direction: "outgoing" | "incoming" }[] = [];

  if (direction === "outgoing" || direction === "both") {
    const outEdgeIds = graph.adjacency.get(nodeId) || [];
    for (const edgeId of outEdgeIds) {
      const edge = graph.edges.get(edgeId);
      if (!edge || edge.expired) continue;
      if (edgeKindFilter && !edgeKindFilter.includes(edge.kind)) continue;
      const target = graph.nodes.get(edge.targetId);
      if (target) results.push({ node: target, edge, direction: "outgoing" });
    }
  }

  if (direction === "incoming" || direction === "both") {
    const inEdgeIds = graph.reverseAdjacency.get(nodeId) || [];
    for (const edgeId of inEdgeIds) {
      const edge = graph.edges.get(edgeId);
      if (!edge || edge.expired) continue;
      if (edgeKindFilter && !edgeKindFilter.includes(edge.kind)) continue;
      const source = graph.nodes.get(edge.sourceId);
      if (source) results.push({ node: source, edge, direction: "incoming" });
    }
  }

  return results;
}

export function traverseBFS(
  graph: MemoryGraph,
  startNodeId: string,
  maxDepth: number,
  edgeKindFilter?: GraphEdgeKind[],
  nodeKindFilter?: GraphNodeKind[],
): GraphPath[] {
  const paths: GraphPath[] = [];
  const visited = new Set<string>();
  const queue: { nodeId: string; path: GraphPath; depth: number }[] = [];

  const cappedDepth = Math.min(maxDepth, 10);

  visited.add(startNodeId);
  queue.push({
    nodeId: startNodeId,
    path: { nodeIds: [startNodeId], edgeIds: [], totalWeight: 0, length: 0 },
    depth: 0,
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth > 0) paths.push(current.path);
    if (current.depth >= cappedDepth) continue;

    const neighbors = getNeighbors(graph, current.nodeId, "outgoing", edgeKindFilter);
    for (const { node, edge } of neighbors) {
      if (visited.has(node.id)) continue;
      if (nodeKindFilter && !nodeKindFilter.includes(node.kind)) continue;
      visited.add(node.id);
      queue.push({
        nodeId: node.id,
        path: {
          nodeIds: [...current.path.nodeIds, node.id],
          edgeIds: [...current.path.edgeIds, edge.id],
          totalWeight: current.path.totalWeight + edge.weight,
          length: current.path.length + 1,
        },
        depth: current.depth + 1,
      });
    }
  }

  return paths;
}

export function getNodesByKind(graph: MemoryGraph, kind: GraphNodeKind): GraphNode[] {
  const results: GraphNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.kind === kind) results.push(node);
  }
  return results;
}

export function getNodesByProvider(graph: MemoryGraph, provider: GraphProvider): GraphNode[] {
  const results: GraphNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.provider === provider) results.push(node);
  }
  return results;
}

export function getEdgesByKind(graph: MemoryGraph, kind: GraphEdgeKind): GraphEdge[] {
  const results: GraphEdge[] = [];
  for (const edge of graph.edges.values()) {
    if (edge.kind === kind && !edge.expired) results.push(edge);
  }
  return results;
}

export function computeStaleness(updatedAt: string, policy: AgingPolicy): GraphStaleness {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / 86_400_000;

  if (ageDays <= policy.freshDays) return "live";
  if (ageDays <= policy.recentDays) return "recent";
  if (ageDays <= policy.agingDays) return "aging";
  if (ageDays <= policy.staleDays) return "stale";
  return "archived";
}

export function getAgingPolicy(kind: GraphNodeKind): AgingPolicy | undefined {
  return AGING_POLICIES.find(p => p.nodeKind === kind);
}

export function getRetrievalIntents(phase: string): RetrievalIntent[] {
  const flow = RETRIEVAL_FLOW.find(f => f.phase === phase);
  return flow ? flow.intents : [];
}

export function validateEdgeSchema(
  sourceKind: GraphNodeKind,
  targetKind: GraphNodeKind,
  edgeKind: GraphEdgeKind,
): { valid: boolean; reason: string } {
  const schema = EDGE_SCHEMAS.find(s => s.kind === edgeKind);
  if (!schema) return { valid: false, reason: `Unknown edge kind: ${edgeKind}` };
  if (!schema.sourceKinds.includes(sourceKind)) {
    return { valid: false, reason: `Edge "${edgeKind}" does not allow source kind "${sourceKind}"` };
  }
  if (!schema.targetKinds.includes(targetKind)) {
    return { valid: false, reason: `Edge "${edgeKind}" does not allow target kind "${targetKind}"` };
  }
  return { valid: true, reason: "Schema valid" };
}

export function getGraphStats(graph: MemoryGraph): GraphStats {
  return { ...graph.stats };
}

export function getGovernanceViolations(graph: MemoryGraph): {
  ruleId: string;
  name: string;
  violations: string[];
}[] {
  const results: { ruleId: string; name: string; violations: string[] }[] = [];

  for (const edge of graph.edges.values()) {
    const source = graph.nodes.get(edge.sourceId);
    const target = graph.nodes.get(edge.targetId);
    if (source && target && source.orgId !== target.orgId) {
      const rule = GOVERNANCE_RULES.find(r => r.id === "gov_tenant_isolation")!;
      results.push({
        ruleId: rule.id,
        name: rule.name,
        violations: [`Edge ${edge.id} connects nodes from different orgs: ${source.orgId} → ${target.orgId}`],
      });
    }
  }

  for (const edge of graph.edges.values()) {
    if (edge.confidence < 30 && !edge.expired) {
      const existing = results.find(r => r.ruleId === "gov_confidence_floor");
      const msg = `Edge ${edge.id} (kind: ${edge.kind}) has confidence ${edge.confidence} < 30`;
      if (existing) {
        existing.violations.push(msg);
      } else {
        results.push({
          ruleId: "gov_confidence_floor",
          name: "Confidence floor for reasoning",
          violations: [msg],
        });
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryGraphTestResult = { name: string; passed: boolean; detail: string };

export function runMemoryGraphTests(): MemoryGraphTestResult[] {
  const results: MemoryGraphTestResult[] = [];

  // 1. Empty graph creation
  const g = createEmptyGraph("org_test");
  results.push({
    name: "createEmptyGraph produces valid structure",
    passed: g.orgId === "org_test" && g.stats.totalNodes === 0 && g.stats.totalEdges === 0,
    detail: `orgId=${g.orgId}, nodes=${g.stats.totalNodes}, edges=${g.stats.totalEdges}`,
  });

  // 2. Node addition
  const node: GraphNode = {
    id: "n1", kind: "resource", orgId: "org_test", provider: "aws", region: "us-east-1",
    label: "EC2 instance", properties: { instanceType: "t3.medium" }, created: new Date().toISOString(),
    updated: new Date().toISOString(), staleness: "live", compressed: false, compressedSummary: null,
    accessCount: 0, lastAccessed: new Date().toISOString(), ttlDays: null, tags: ["compute"],
  };
  addNode(g, node);
  results.push({
    name: "addNode increments stats",
    passed: g.stats.totalNodes === 1 && g.stats.nodesByKind.resource === 1,
    detail: `totalNodes=${g.stats.totalNodes}, resource count=${g.stats.nodesByKind.resource}`,
  });

  // 3. Tenant isolation on node
  try {
    addNode(g, { ...node, id: "n_bad", orgId: "other_org" });
    results.push({ name: "addNode rejects cross-tenant node", passed: false, detail: "No error thrown" });
  } catch {
    results.push({ name: "addNode rejects cross-tenant node", passed: true, detail: "Error thrown correctly" });
  }

  // 4. Edge addition with schema validation
  const regionNode: GraphNode = {
    id: "r1", kind: "region", orgId: "org_test", provider: "aws", region: "us-east-1",
    label: "us-east-1", properties: {}, created: new Date().toISOString(),
    updated: new Date().toISOString(), staleness: "live", compressed: false, compressedSummary: null,
    accessCount: 0, lastAccessed: new Date().toISOString(), ttlDays: null, tags: [],
  };
  addNode(g, regionNode);
  const edge: GraphEdge = {
    id: "e1", kind: "resides_in", sourceId: "n1", targetId: "r1", orgId: "org_test",
    weight: 1.0, properties: {}, created: new Date().toISOString(), evidence: "EC2 deployed in us-east-1",
    confidence: 100, bidirectional: false, expired: false,
  };
  addEdge(g, edge);
  results.push({
    name: "addEdge with valid schema succeeds",
    passed: g.stats.totalEdges === 1,
    detail: `totalEdges=${g.stats.totalEdges}`,
  });

  // 5. Edge schema validation rejects invalid source kind
  const badEdge: GraphEdge = {
    id: "e_bad", kind: "resides_in", sourceId: "r1", targetId: "n1", orgId: "org_test",
    weight: 1.0, properties: {}, created: new Date().toISOString(), evidence: "test",
    confidence: 100, bidirectional: false, expired: false,
  };
  try {
    addEdge(g, badEdge);
    results.push({ name: "addEdge rejects invalid source kind", passed: false, detail: "No error" });
  } catch {
    results.push({ name: "addEdge rejects invalid source kind", passed: true, detail: "Error thrown" });
  }

  // 6. Neighbor retrieval
  const neighbors = getNeighbors(g, "n1", "outgoing");
  results.push({
    name: "getNeighbors returns connected nodes",
    passed: neighbors.length === 1 && neighbors[0].node.id === "r1",
    detail: `found ${neighbors.length} neighbors`,
  });

  // 7. BFS traversal
  const paths = traverseBFS(g, "n1", 3);
  results.push({
    name: "traverseBFS finds paths",
    passed: paths.length >= 1,
    detail: `found ${paths.length} paths`,
  });

  // 8. Node kind filtering
  const resources = getNodesByKind(g, "resource");
  results.push({
    name: "getNodesByKind filters correctly",
    passed: resources.length === 1 && resources[0].kind === "resource",
    detail: `found ${resources.length} resources`,
  });

  // 9. Provider filtering
  const awsNodes = getNodesByProvider(g, "aws");
  results.push({
    name: "getNodesByProvider filters correctly",
    passed: awsNodes.length === 2,
    detail: `found ${awsNodes.length} AWS nodes`,
  });

  // 10. Edge kind filtering
  const residesEdges = getEdgesByKind(g, "resides_in");
  results.push({
    name: "getEdgesByKind filters correctly",
    passed: residesEdges.length === 1,
    detail: `found ${residesEdges.length} resides_in edges`,
  });

  // 11. Edge schema validation function
  const valid = validateEdgeSchema("resource", "region", "resides_in");
  const invalid = validateEdgeSchema("region", "resource", "resides_in");
  results.push({
    name: "validateEdgeSchema correct for valid/invalid",
    passed: valid.valid && !invalid.valid,
    detail: `valid=${valid.valid}, invalid=${invalid.valid}`,
  });

  // 12. Edge schema count matches defined schemas
  results.push({
    name: "EDGE_SCHEMAS covers all edge kinds",
    passed: EDGE_SCHEMAS.length === 30,
    detail: `${EDGE_SCHEMAS.length} schemas defined`,
  });

  // 13. Aging policies cover all node kinds
  const allKinds: GraphNodeKind[] = [
    "resource", "region", "provider", "incident", "optimization", "approval",
    "rollback", "risk", "workflow", "policy", "execution", "finding",
    "snapshot", "team_member", "cost_event", "compliance_check",
  ];
  const coveredKinds = AGING_POLICIES.map(p => p.nodeKind);
  const allCovered = allKinds.every(k => coveredKinds.includes(k));
  results.push({
    name: "AGING_POLICIES covers all 16 node kinds",
    passed: allCovered,
    detail: `${coveredKinds.length} / ${allKinds.length} covered`,
  });

  // 14. Retrieval flow covers all 9 cognitive phases
  const phases = ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"];
  const coveredPhases = RETRIEVAL_FLOW.map(f => f.phase);
  const phasesCovered = phases.every(p => coveredPhases.includes(p));
  results.push({
    name: "RETRIEVAL_FLOW covers all 9 cognitive phases",
    passed: phasesCovered,
    detail: `${coveredPhases.length} / ${phases.length} phases covered`,
  });

  // 15. Summarization rules defined for all strategies
  results.push({
    name: "SUMMARIZATION_RULES has 7 strategies",
    passed: SUMMARIZATION_RULES.length === 7,
    detail: `${SUMMARIZATION_RULES.length} rules defined`,
  });

  // 16. Governance rules all have enforcement levels
  const allEnforced = GOVERNANCE_RULES.every(r => ["audit", "warn", "block"].includes(r.enforcement));
  results.push({
    name: "GOVERNANCE_RULES all have valid enforcement",
    passed: allEnforced && GOVERNANCE_RULES.length === 8,
    detail: `${GOVERNANCE_RULES.length} rules, all valid enforcement`,
  });

  // 17. Governance violation detection
  const violations = getGovernanceViolations(g);
  results.push({
    name: "getGovernanceViolations returns empty for clean graph",
    passed: violations.length === 0,
    detail: `${violations.length} violations found`,
  });

  // 18. Staleness computation
  const now = new Date();
  const old = new Date(now.getTime() - 45 * 86_400_000).toISOString();
  const policy = AGING_POLICIES.find(p => p.nodeKind === "resource")!;
  const stale = computeStaleness(old, policy);
  results.push({
    name: "computeStaleness returns correct level for 45-day-old resource",
    passed: stale === "stale",
    detail: `staleness=${stale} (expected "stale" for 45 days with staleDays=90, agingDays=30)`,
  });

  // 19. Graph diagrams present
  results.push({
    name: "GRAPH_DIAGRAMS has 4 architecture diagrams",
    passed: GRAPH_DIAGRAMS.length === 4,
    detail: `${GRAPH_DIAGRAMS.length} diagrams`,
  });

  // 20. Retrieval intents accessor
  const observeIntents = getRetrievalIntents("observe");
  results.push({
    name: "getRetrievalIntents returns correct intents for observe phase",
    passed: observeIntents.length === 2 && observeIntents.includes("resource_history"),
    detail: `${observeIntents.length} intents: ${observeIntents.join(", ")}`,
  });

  return results;
}
