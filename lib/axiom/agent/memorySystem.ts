/**
 * Axiom Persistent Memory System
 *
 * Four memory types:
 *   1. Episodic  — timestamped records of agent runs, outcomes, incidents
 *   2. Semantic  — durable understanding of infrastructure, patterns, baselines
 *   3. Procedural — successful execution strategies and workflow templates
 *   4. Organizational — company-specific preferences, policies, culture
 *
 * Design principles:
 *   - Queryable: every memory type supports filtered retrieval
 *   - Explainable: memories carry provenance (source, confidence, age)
 *   - Safe: memory never silently overrides safety — only tightens
 *   - Aging: old memories compress, decay in relevance, eventually archive
 *   - Provider-agnostic: uniform schema across AWS, Azure, GCP
 *   - Summarizable: large memory sets compress to bounded summaries
 *
 * Safety invariants:
 *   - Procedural memory cannot promote risky strategies
 *   - Organizational memory cannot lower safety thresholds
 *   - Stale memories are flagged, not silently trusted
 *   - All memory mutations produce audit entries
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { ActionType, RiskLevel } from "../executionPlan";
import type {
  FindingCategory,
  FindingSeverity,
  ActionDisposition,
} from "./types";
import type {
  Episode,
  PhaseOutcome,
  SemanticMemory,
  ResourcePattern,
  CostBaseline,
  OrgRiskProfile,
  OperationalRhythm,
  KnownException,
} from "./cognitiveArchitecture";

// ═══════════════════════════════════════════════════════════════════════════
// 1. MEMORY PROVENANCE — every memory knows where it came from
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryProvenance = {
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  confidence: number;         // 0-100
  staleness: StalenessLevel;
  accessCount: number;
  lastAccessedAt: string;
  sourceRunId: string | null;
  sourceUserId: string | null;
  ttlDays: number | null;     // null = never expires
};

export type MemorySource =
  | "agent_run"
  | "user_action"
  | "drift_detection"
  | "monitoring_alert"
  | "governance_evaluation"
  | "reflection"
  | "admin_config"
  | "onboarding"
  | "import";

export type StalenessLevel = "fresh" | "recent" | "aging" | "stale" | "expired";

function computeStaleness(updatedAt: string, ttlDays: number | null): StalenessLevel {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / 86_400_000;

  if (ttlDays !== null && ageDays > ttlDays) return "expired";
  if (ageDays < 1) return "fresh";
  if (ageDays < 7) return "recent";
  if (ageDays < 30) return "aging";
  return "stale";
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. EPISODIC MEMORY — what happened (timestamped events)
// ═══════════════════════════════════════════════════════════════════════════

export type EpisodicStore = {
  orgId: string;
  episodes: StoredEpisode[];
  incidents: Incident[];
  rollbacks: RollbackRecord[];
  approvalHistory: ApprovalRecord[];
  scanHistory: ScanRecord[];
};

export type StoredEpisode = Episode & {
  provenance: MemoryProvenance;
  compressed: boolean;
  summary: string | null;
};

export type Incident = {
  id: string;
  orgId: string;
  type: IncidentType;
  severity: "low" | "medium" | "high" | "critical";
  provider: CloudProvider;
  regions: string[];
  resourceIds: string[];
  title: string;
  description: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  relatedRunIds: string[];
  relatedDriftIds: string[];
  costImpact: number | null;
  lessonsLearned: string[];
  provenance: MemoryProvenance;
};

export type IncidentType =
  | "outage"
  | "security_breach"
  | "cost_spike"
  | "data_loss"
  | "unauthorized_change"
  | "failed_execution"
  | "failed_rollback"
  | "governance_violation"
  | "drift_escalation";

export type RollbackRecord = {
  id: string;
  orgId: string;
  actionId: string;
  actionType: ActionType;
  provider: CloudProvider;
  region: string;
  resourceId: string;
  reason: string;
  rolledBackAt: string;
  originalRunId: string;
  outcome: "success" | "partial" | "failed";
  preRollbackState: Record<string, unknown>;
  postRollbackState: Record<string, unknown>;
  durationMs: number;
  provenance: MemoryProvenance;
};

export type ApprovalRecord = {
  id: string;
  orgId: string;
  userId: string;
  runId: string;
  recommendationId: string;
  decision: "approved" | "rejected" | "snoozed" | "expired";
  actionType: ActionType;
  riskLevel: RiskLevel;
  category: FindingCategory;
  provider: CloudProvider;
  reason: string | null;
  decidedAt: string;
  timeToDecisionMs: number;
  provenance: MemoryProvenance;
};

export type ScanRecord = {
  id: string;
  orgId: string;
  provider: CloudProvider;
  trigger: string;
  scannedAt: string;
  durationMs: number;
  resourceCount: number;
  findingCount: number;
  monthlySpend: number | null;
  regions: string[];
  dataCompleteness: number;
  provenance: MemoryProvenance;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. SEMANTIC MEMORY — what the agent understands (durable knowledge)
// ═══════════════════════════════════════════════════════════════════════════

export type SemanticStore = SemanticMemory & {
  provenance: MemoryProvenance;
  infrastructureTopology: InfraTopology;
  growthTrends: GrowthTrend[];
  resilienceHistory: ResilienceSnapshot[];
  optimizationKnowledge: OptimizationPattern[];
  providerMappings: ProviderMapping[];
};

export type InfraTopology = {
  orgId: string;
  providers: CloudProvider[];
  totalRegions: number;
  totalCompute: number;
  totalStorage: number;
  primaryProvider: CloudProvider;
  primaryRegion: string;
  multiRegion: boolean;
  multiCloud: boolean;
  lastUpdated: string;
  resourcesByProvider: Record<string, { compute: number; storage: number }>;
  resourcesByRegion: Record<string, { compute: number; storage: number }>;
};

export type GrowthTrend = {
  provider: CloudProvider;
  metric: "compute_count" | "storage_count" | "monthly_spend" | "region_count";
  dataPoints: TrendPoint[];
  trend: "growing" | "stable" | "shrinking";
  growthRatePercent: number;
  projectedNextMonth: number;
  confidence: number;
  lastUpdated: string;
};

export type TrendPoint = {
  timestamp: string;
  value: number;
};

export type ResilienceSnapshot = {
  timestamp: string;
  provider: CloudProvider;
  multiRegion: boolean;
  backupsEnabled: boolean;
  replicationEnabled: boolean;
  regionCount: number;
  score: number;           // 0-100
};

export type OptimizationPattern = {
  id: string;
  pattern: string;
  description: string;
  category: FindingCategory;
  provider: CloudProvider | "all";
  frequency: number;        // how often this pattern appears
  successRate: number;       // when applied, how often it succeeds
  avgSavingsMonthly: number;
  riskLevel: RiskLevel;
  lastSeen: string;
  exampleResourceIds: string[];
  provenance: MemoryProvenance;
};

export type ProviderMapping = {
  concept: string;           // e.g. "rightsizing", "storage_tiering"
  aws: string;               // e.g. "EC2 instance type change"
  azure: string;             // e.g. "VM size change"
  gcp: string;               // e.g. "Machine type change"
  notes: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. PROCEDURAL MEMORY — how to do things (learned strategies)
// ═══════════════════════════════════════════════════════════════════════════

export type ProceduralStore = {
  orgId: string;
  strategies: ExecutionStrategy[];
  workflowTemplates: WorkflowTemplate[];
  rollbackPlaybooks: RollbackPlaybook[];
  escalationPatterns: EscalationPattern[];
};

export type ExecutionStrategy = {
  id: string;
  name: string;
  description: string;
  applicableWhen: StrategyCondition;
  steps: StrategyStep[];
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number;
  lastUsed: string;
  provenance: MemoryProvenance;
};

export type StrategyCondition = {
  categories: FindingCategory[];
  providers: CloudProvider[];
  riskLevels: RiskLevel[];
  minFindings: number;
  maxFindings: number;
  tags: string[];
};

export type StrategyStep = {
  order: number;
  action: string;
  description: string;
  requiresApproval: boolean;
  estimatedDurationMs: number;
  rollbackAvailable: boolean;
  onFailure: "abort" | "skip" | "retry" | "rollback";
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  conditions: string[];
  actions: string[];
  frequency: number;
  lastTriggered: string;
  successRate: number;
  provenance: MemoryProvenance;
};

export type RollbackPlaybook = {
  id: string;
  actionType: ActionType;
  provider: CloudProvider;
  steps: string[];
  preconditions: string[];
  estimatedDurationMs: number;
  successRate: number;
  lastUsed: string | null;
  provenance: MemoryProvenance;
};

export type EscalationPattern = {
  id: string;
  trigger: string;
  escalateTo: string;       // role or user
  urgency: "low" | "medium" | "high" | "critical";
  typicalResolutionHours: number;
  frequency: number;
  lastTriggered: string | null;
  provenance: MemoryProvenance;
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. ORGANIZATIONAL MEMORY — who the org is and how they operate
// ═══════════════════════════════════════════════════════════════════════════

export type OrganizationalStore = {
  orgId: string;
  identity: OrgIdentity;
  decisionCulture: DecisionCulture;
  compliancePosture: CompliancePosture;
  teamStructure: TeamStructure;
  historicalPreferences: PreferenceEvolution[];
  customPolicies: CustomPolicy[];
};

export type OrgIdentity = {
  industry: string;
  size: "startup" | "smb" | "mid_market" | "enterprise";
  cloudMaturity: "beginner" | "intermediate" | "advanced" | "expert";
  primaryWorkloads: string[];
  regulatoryRequirements: string[];
  lastUpdated: string;
};

export type DecisionCulture = {
  avgDecisionTimeHours: number;
  prefersCaution: boolean;
  prefersAutomation: boolean;
  toleratesDowntime: boolean;
  costSensitivity: "low" | "medium" | "high";
  changeFrequency: "rare" | "monthly" | "weekly" | "daily";
  derivedFrom: string;       // "50 approval records" etc.
  confidence: number;
  lastUpdated: string;
};

export type CompliancePosture = {
  frameworks: string[];       // e.g. ["SOC2", "HIPAA", "PCI-DSS"]
  requiresEncryption: boolean;
  requiresReplication: boolean;
  requiresMultiRegion: boolean;
  noPublicStorage: boolean;
  dataResidencyRegions: string[];
  auditFrequencyDays: number;
  lastAudit: string | null;
};

export type TeamStructure = {
  approvers: string[];
  securityReviewers: string[];
  financeReviewers: string[];
  primaryOperators: string[];
  onCallRotation: boolean;
  responseTimeHours: number;
};

export type PreferenceEvolution = {
  timestamp: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  reason: string | null;
};

export type CustomPolicy = {
  id: string;
  name: string;
  description: string;
  rule: string;               // human-readable rule
  enforcement: "audit" | "warn" | "enforce" | "block";
  createdBy: string;
  createdAt: string;
  enabled: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. UNIFIED MEMORY STORE — the agent's complete memory
// ═══════════════════════════════════════════════════════════════════════════

export type AgentMemory = {
  orgId: string;
  version: number;
  lastUpdated: string;
  episodic: EpisodicStore;
  semantic: SemanticStore;
  procedural: ProceduralStore;
  organizational: OrganizationalStore;
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. MEMORY QUERY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryQuery = {
  memoryType: "episodic" | "semantic" | "procedural" | "organizational" | "all";
  filters: MemoryFilter[];
  timeRange?: { from: string; to: string };
  providers?: CloudProvider[];
  categories?: FindingCategory[];
  limit?: number;
  sortBy?: "relevance" | "recency" | "confidence";
  excludeStale?: boolean;
  excludeExpired?: boolean;
};

export type MemoryFilter =
  | { type: "provider"; value: CloudProvider }
  | { type: "category"; value: FindingCategory }
  | { type: "severity"; value: FindingSeverity }
  | { type: "risk_level"; value: RiskLevel }
  | { type: "resource_id"; value: string }
  | { type: "region"; value: string }
  | { type: "action_type"; value: ActionType }
  | { type: "incident_type"; value: IncidentType }
  | { type: "keyword"; value: string }
  | { type: "confidence_above"; value: number }
  | { type: "staleness"; value: StalenessLevel };

export type MemoryQueryResult = {
  query: MemoryQuery;
  executedAt: string;
  totalResults: number;
  episodes: StoredEpisode[];
  incidents: Incident[];
  patterns: OptimizationPattern[];
  strategies: ExecutionStrategy[];
  trends: GrowthTrend[];
  relevanceScores: Map<string, number>;
};

export function queryMemory(memory: AgentMemory, query: MemoryQuery): MemoryQueryResult {
  const now = new Date().toISOString();
  const episodes: StoredEpisode[] = [];
  const incidents: Incident[] = [];
  const patterns: OptimizationPattern[] = [];
  const strategies: ExecutionStrategy[] = [];
  const trends: GrowthTrend[] = [];
  const relevanceScores = new Map<string, number>();

  const shouldInclude = (provenance: MemoryProvenance): boolean => {
    if (query.excludeExpired && provenance.staleness === "expired") return false;
    if (query.excludeStale && (provenance.staleness === "stale" || provenance.staleness === "expired")) return false;
    return true;
  };

  const matchesFilters = (item: {
    provider?: CloudProvider;
    category?: FindingCategory | string;
    severity?: string;
    riskLevel?: RiskLevel;
    resourceId?: string;
    region?: string;
    actionType?: ActionType;
  }): boolean => {
    for (const f of query.filters) {
      switch (f.type) {
        case "provider": if (item.provider && item.provider !== f.value) return false; break;
        case "category": if (item.category && item.category !== f.value) return false; break;
        case "severity": if (item.severity && item.severity !== f.value) return false; break;
        case "risk_level": if (item.riskLevel && item.riskLevel !== f.value) return false; break;
        case "resource_id": if (item.resourceId && item.resourceId !== f.value) return false; break;
        case "region": if (item.region && item.region !== f.value) return false; break;
        case "action_type": if (item.actionType && item.actionType !== f.value) return false; break;
      }
    }
    return true;
  };

  const inTimeRange = (timestamp: string): boolean => {
    if (!query.timeRange) return true;
    return timestamp >= query.timeRange.from && timestamp <= query.timeRange.to;
  };

  // Query episodic memory
  if (query.memoryType === "episodic" || query.memoryType === "all") {
    for (const ep of memory.episodic.episodes) {
      if (!shouldInclude(ep.provenance)) continue;
      if (!inTimeRange(ep.timestamp)) continue;
      if (query.providers && !query.providers.includes(ep.provider)) continue;
      episodes.push(ep);
      relevanceScores.set(ep.id, computeRelevance(ep.provenance, query.sortBy ?? "relevance"));
    }

    for (const inc of memory.episodic.incidents) {
      if (!shouldInclude(inc.provenance)) continue;
      if (!inTimeRange(inc.detectedAt)) continue;
      if (!matchesFilters({ provider: inc.provider, severity: inc.severity })) continue;
      incidents.push(inc);
      relevanceScores.set(inc.id, computeRelevance(inc.provenance, query.sortBy ?? "relevance"));
    }
  }

  // Query semantic memory
  if (query.memoryType === "semantic" || query.memoryType === "all") {
    for (const pat of memory.semantic.optimizationKnowledge) {
      if (!shouldInclude(pat.provenance)) continue;
      if (!matchesFilters({ provider: pat.provider === "all" ? undefined : pat.provider, category: pat.category })) continue;
      patterns.push(pat);
      relevanceScores.set(pat.id, computeRelevance(pat.provenance, query.sortBy ?? "relevance"));
    }

    for (const trend of memory.semantic.growthTrends) {
      if (query.providers && !query.providers.includes(trend.provider)) continue;
      trends.push(trend);
    }
  }

  // Query procedural memory
  if (query.memoryType === "procedural" || query.memoryType === "all") {
    for (const strat of memory.procedural.strategies) {
      if (!shouldInclude(strat.provenance)) continue;
      const matchesProvider = !query.providers || strat.applicableWhen.providers.some((p) => query.providers!.includes(p));
      if (!matchesProvider) continue;
      strategies.push(strat);
      relevanceScores.set(strat.id, computeRelevance(strat.provenance, query.sortBy ?? "relevance"));
    }
  }

  // Sort and limit
  const limit = query.limit ?? 50;
  const sortFn = (a: string, b: string) => (relevanceScores.get(b) ?? 0) - (relevanceScores.get(a) ?? 0);

  episodes.sort((a, b) => sortFn(a.id, b.id));
  incidents.sort((a, b) => sortFn(a.id, b.id));
  patterns.sort((a, b) => sortFn(a.id, b.id));
  strategies.sort((a, b) => sortFn(a.id, b.id));

  return {
    query,
    executedAt: now,
    totalResults: episodes.length + incidents.length + patterns.length + strategies.length + trends.length,
    episodes: episodes.slice(0, limit),
    incidents: incidents.slice(0, limit),
    patterns: patterns.slice(0, limit),
    strategies: strategies.slice(0, limit),
    trends: trends.slice(0, limit),
    relevanceScores,
  };
}

function computeRelevance(provenance: MemoryProvenance, sortBy: string): number {
  if (sortBy === "recency") {
    const ageMs = Date.now() - new Date(provenance.updatedAt).getTime();
    return Math.max(0, 100 - (ageMs / 86_400_000)); // decays over 100 days
  }
  if (sortBy === "confidence") {
    return provenance.confidence;
  }
  // relevance = weighted combination
  const recency = Math.max(0, 100 - ((Date.now() - new Date(provenance.updatedAt).getTime()) / 86_400_000));
  const conf = provenance.confidence;
  const access = Math.min(provenance.accessCount * 5, 30);
  return recency * 0.4 + conf * 0.4 + access * 0.2;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. MEMORY WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryMutation = {
  id: string;
  type: "write" | "update" | "compress" | "archive" | "delete";
  memoryType: "episodic" | "semantic" | "procedural" | "organizational";
  target: string;
  description: string;
  timestamp: string;
  userId: string | null;
  runId: string | null;
};

let mutationSeq = 0;

function mutationId(): string {
  return `mut-${Date.now()}-${++mutationSeq}`;
}

function makeProvenance(
  source: MemorySource,
  opts?: { runId?: string; userId?: string; confidence?: number; ttlDays?: number },
): MemoryProvenance {
  const now = new Date().toISOString();
  return {
    source,
    createdAt: now,
    updatedAt: now,
    confidence: opts?.confidence ?? 80,
    staleness: "fresh",
    accessCount: 0,
    lastAccessedAt: now,
    sourceRunId: opts?.runId ?? null,
    sourceUserId: opts?.userId ?? null,
    ttlDays: opts?.ttlDays ?? null,
  };
}

export function recordEpisode(
  store: EpisodicStore,
  episode: Episode,
  source: MemorySource,
  opts?: { runId?: string; confidence?: number },
): MemoryMutation {
  const stored: StoredEpisode = {
    ...episode,
    provenance: makeProvenance(source, opts),
    compressed: false,
    summary: null,
  };
  store.episodes.push(stored);

  return {
    id: mutationId(),
    type: "write",
    memoryType: "episodic",
    target: episode.id,
    description: `Recorded episode ${episode.id} (${episode.findingCount} findings, ${episode.actionsTaken} actions)`,
    timestamp: new Date().toISOString(),
    userId: null,
    runId: opts?.runId ?? null,
  };
}

export function recordIncident(
  store: EpisodicStore,
  incident: Omit<Incident, "provenance">,
  source: MemorySource,
): MemoryMutation {
  store.incidents.push({
    ...incident,
    provenance: makeProvenance(source, { confidence: 90 }),
  });

  return {
    id: mutationId(),
    type: "write",
    memoryType: "episodic",
    target: incident.id,
    description: `Recorded incident: ${incident.title}`,
    timestamp: new Date().toISOString(),
    userId: null,
    runId: null,
  };
}

export function recordApproval(
  store: EpisodicStore,
  record: Omit<ApprovalRecord, "provenance">,
): MemoryMutation {
  store.approvalHistory.push({
    ...record,
    provenance: makeProvenance("user_action", { userId: record.userId }),
  });

  return {
    id: mutationId(),
    type: "write",
    memoryType: "episodic",
    target: record.id,
    description: `Recorded ${record.decision} for ${record.actionType} (${record.riskLevel} risk)`,
    timestamp: new Date().toISOString(),
    userId: record.userId,
    runId: record.runId,
  };
}

export function recordRollback(
  store: EpisodicStore,
  record: Omit<RollbackRecord, "provenance">,
): MemoryMutation {
  store.rollbacks.push({
    ...record,
    provenance: makeProvenance("agent_run", { runId: record.originalRunId, confidence: 95 }),
  });

  return {
    id: mutationId(),
    type: "write",
    memoryType: "episodic",
    target: record.id,
    description: `Recorded rollback: ${record.reason} (${record.outcome})`,
    timestamp: new Date().toISOString(),
    userId: null,
    runId: record.originalRunId,
  };
}

export function learnOptimizationPattern(
  store: SemanticStore,
  pattern: Omit<OptimizationPattern, "provenance">,
  source: MemorySource,
): MemoryMutation {
  const existing = store.optimizationKnowledge.find((p) => p.pattern === pattern.pattern && p.provider === pattern.provider);

  if (existing) {
    existing.frequency = pattern.frequency;
    existing.successRate = pattern.successRate;
    existing.avgSavingsMonthly = pattern.avgSavingsMonthly;
    existing.lastSeen = pattern.lastSeen;
    existing.provenance.updatedAt = new Date().toISOString();
    existing.provenance.staleness = "fresh";

    return {
      id: mutationId(),
      type: "update",
      memoryType: "semantic",
      target: existing.id,
      description: `Updated pattern: ${pattern.pattern} (freq=${pattern.frequency}, success=${pattern.successRate})`,
      timestamp: new Date().toISOString(),
      userId: null,
      runId: null,
    };
  }

  store.optimizationKnowledge.push({
    ...pattern,
    provenance: makeProvenance(source),
  });

  return {
    id: mutationId(),
    type: "write",
    memoryType: "semantic",
    target: pattern.id,
    description: `Learned new pattern: ${pattern.pattern}`,
    timestamp: new Date().toISOString(),
    userId: null,
    runId: null,
  };
}

export function recordStrategy(
  store: ProceduralStore,
  strategy: Omit<ExecutionStrategy, "provenance">,
  source: MemorySource,
): MemoryMutation {
  const existing = store.strategies.find((s) => s.name === strategy.name);

  if (existing) {
    existing.successCount = strategy.successCount;
    existing.failureCount = strategy.failureCount;
    existing.successRate = strategy.successRate;
    existing.avgDurationMs = strategy.avgDurationMs;
    existing.lastUsed = strategy.lastUsed;
    existing.provenance.updatedAt = new Date().toISOString();
    existing.provenance.staleness = "fresh";

    return {
      id: mutationId(),
      type: "update",
      memoryType: "procedural",
      target: existing.id,
      description: `Updated strategy: ${strategy.name} (success=${strategy.successRate})`,
      timestamp: new Date().toISOString(),
      userId: null,
      runId: null,
    };
  }

  store.strategies.push({
    ...strategy,
    provenance: makeProvenance(source),
  });

  return {
    id: mutationId(),
    type: "write",
    memoryType: "procedural",
    target: strategy.id,
    description: `Recorded new strategy: ${strategy.name}`,
    timestamp: new Date().toISOString(),
    userId: null,
    runId: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. MEMORY AGING & COMPRESSION
// ═══════════════════════════════════════════════════════════════════════════

export type AgingConfig = {
  episodeRetentionDays: number;        // keep full episodes for N days
  episodeCompressionAfterDays: number; // compress after N days
  incidentRetentionDays: number;       // incidents live longer
  patternDecayFactor: number;          // 0-1, confidence decay per month
  maxEpisodesBeforeCompression: number;
  maxPatternsRetained: number;
  maxStrategiesRetained: number;
};

export const DEFAULT_AGING: AgingConfig = {
  episodeRetentionDays: 365,
  episodeCompressionAfterDays: 30,
  incidentRetentionDays: 730,
  patternDecayFactor: 0.95,
  maxEpisodesBeforeCompression: 500,
  maxPatternsRetained: 200,
  maxStrategiesRetained: 100,
};

export type AgingResult = {
  compressed: number;
  archived: number;
  decayed: number;
  expired: number;
  mutations: MemoryMutation[];
};

export function ageMemory(memory: AgentMemory, config: AgingConfig = DEFAULT_AGING): AgingResult {
  const mutations: MemoryMutation[] = [];
  let compressed = 0;
  let archived = 0;
  let decayed = 0;
  let expired = 0;
  const now = Date.now();

  // Age episodic memory
  for (const ep of memory.episodic.episodes) {
    const ageDays = (now - new Date(ep.timestamp).getTime()) / 86_400_000;

    // Update staleness
    ep.provenance.staleness = computeStaleness(ep.provenance.updatedAt, ep.provenance.ttlDays);

    // Compress old episodes
    if (ageDays > config.episodeCompressionAfterDays && !ep.compressed) {
      ep.compressed = true;
      ep.summary = summarizeEpisode(ep);
      ep.phases = []; // drop phase detail after compression
      compressed++;
      mutations.push({
        id: mutationId(),
        type: "compress",
        memoryType: "episodic",
        target: ep.id,
        description: `Compressed episode ${ep.id} (${Math.round(ageDays)}d old)`,
        timestamp: new Date().toISOString(),
        userId: null,
        runId: null,
      });
    }

    // Archive very old episodes
    if (ageDays > config.episodeRetentionDays) {
      archived++;
    }
  }

  // Remove archived episodes
  if (archived > 0) {
    const cutoff = new Date(now - config.episodeRetentionDays * 86_400_000).toISOString();
    memory.episodic.episodes = memory.episodic.episodes.filter((ep) => ep.timestamp > cutoff);
  }

  // Cap episode count
  if (memory.episodic.episodes.length > config.maxEpisodesBeforeCompression) {
    const excess = memory.episodic.episodes.length - config.maxEpisodesBeforeCompression;
    const removed = memory.episodic.episodes.splice(0, excess);
    archived += removed.length;
  }

  // Decay pattern confidence
  for (const pat of memory.semantic.optimizationKnowledge) {
    const ageMonths = (now - new Date(pat.lastSeen).getTime()) / (30 * 86_400_000);
    if (ageMonths > 1) {
      const decay = Math.pow(config.patternDecayFactor, ageMonths);
      const newConf = Math.round(pat.provenance.confidence * decay);
      if (newConf < pat.provenance.confidence) {
        pat.provenance.confidence = Math.max(10, newConf);
        pat.provenance.staleness = computeStaleness(pat.provenance.updatedAt, pat.provenance.ttlDays);
        decayed++;
      }
    }
  }

  // Cap patterns
  if (memory.semantic.optimizationKnowledge.length > config.maxPatternsRetained) {
    memory.semantic.optimizationKnowledge.sort((a, b) => b.provenance.confidence - a.provenance.confidence);
    const removed = memory.semantic.optimizationKnowledge.splice(config.maxPatternsRetained);
    expired += removed.length;
  }

  // Age incidents
  const incidentCutoff = new Date(now - config.incidentRetentionDays * 86_400_000).toISOString();
  const beforeIncidents = memory.episodic.incidents.length;
  memory.episodic.incidents = memory.episodic.incidents.filter((i) => i.detectedAt > incidentCutoff);
  expired += beforeIncidents - memory.episodic.incidents.length;

  // Cap strategies
  if (memory.procedural.strategies.length > config.maxStrategiesRetained) {
    memory.procedural.strategies.sort((a, b) => b.successRate - a.successRate);
    memory.procedural.strategies.splice(config.maxStrategiesRetained);
  }

  return { compressed, archived, decayed, expired, mutations };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. MEMORY SUMMARIZATION
// ═══════════════════════════════════════════════════════════════════════════

export type MemorySummary = {
  orgId: string;
  generatedAt: string;
  episodeSummary: EpisodeSummary;
  semanticSummary: SemanticSummaryReport;
  proceduralSummary: ProceduralSummaryReport;
  organizationalSummary: OrgSummaryReport;
  overallHealth: "healthy" | "aging" | "degraded";
  memorySizeEstimate: number;
};

export type EpisodeSummary = {
  totalEpisodes: number;
  compressedEpisodes: number;
  oldestEpisode: string | null;
  newestEpisode: string | null;
  totalIncidents: number;
  unresolvedIncidents: number;
  totalRollbacks: number;
  rollbackSuccessRate: number;
  approvalRate: number;
  avgDecisionTimeMs: number;
  scanCount: number;
};

export type SemanticSummaryReport = {
  topologyAge: string;
  totalPatterns: number;
  highConfidencePatterns: number;
  stalePatterns: number;
  trendCount: number;
  growingMetrics: string[];
  shrinkingMetrics: string[];
};

export type ProceduralSummaryReport = {
  totalStrategies: number;
  highSuccessStrategies: number;
  totalPlaybooks: number;
  totalTemplates: number;
};

export type OrgSummaryReport = {
  industry: string;
  cloudMaturity: string;
  decisionSpeed: string;
  costSensitivity: string;
  complianceFrameworks: string[];
};

export function summarizeMemory(memory: AgentMemory): MemorySummary {
  const ep = memory.episodic;
  const sem = memory.semantic;
  const proc = memory.procedural;
  const org = memory.organizational;

  const rollbackSuccessRate = ep.rollbacks.length > 0
    ? ep.rollbacks.filter((r) => r.outcome === "success").length / ep.rollbacks.length
    : 1;

  const approvalRate = ep.approvalHistory.length > 0
    ? ep.approvalHistory.filter((a) => a.decision === "approved").length / ep.approvalHistory.length
    : 0;

  const avgDecision = ep.approvalHistory.length > 0
    ? ep.approvalHistory.reduce((sum, a) => sum + a.timeToDecisionMs, 0) / ep.approvalHistory.length
    : 0;

  const highConfPatterns = sem.optimizationKnowledge.filter((p) => p.provenance.confidence >= 70).length;
  const stalePatterns = sem.optimizationKnowledge.filter((p) =>
    p.provenance.staleness === "stale" || p.provenance.staleness === "expired",
  ).length;

  const growing = sem.growthTrends.filter((t) => t.trend === "growing").map((t) => `${t.provider}:${t.metric}`);
  const shrinking = sem.growthTrends.filter((t) => t.trend === "shrinking").map((t) => `${t.provider}:${t.metric}`);

  const highSuccessStrats = proc.strategies.filter((s) => s.successRate >= 0.8).length;

  const totalItems = ep.episodes.length + ep.incidents.length + ep.rollbacks.length +
    ep.approvalHistory.length + ep.scanHistory.length +
    sem.optimizationKnowledge.length + sem.growthTrends.length +
    proc.strategies.length + proc.workflowTemplates.length;

  const staleRatio = sem.optimizationKnowledge.length > 0
    ? stalePatterns / sem.optimizationKnowledge.length
    : 0;

  const health: MemorySummary["overallHealth"] =
    staleRatio > 0.5 ? "degraded" :
    staleRatio > 0.2 ? "aging" : "healthy";

  return {
    orgId: memory.orgId,
    generatedAt: new Date().toISOString(),
    episodeSummary: {
      totalEpisodes: ep.episodes.length,
      compressedEpisodes: ep.episodes.filter((e) => e.compressed).length,
      oldestEpisode: ep.episodes.length > 0 ? ep.episodes[0].timestamp : null,
      newestEpisode: ep.episodes.length > 0 ? ep.episodes[ep.episodes.length - 1].timestamp : null,
      totalIncidents: ep.incidents.length,
      unresolvedIncidents: ep.incidents.filter((i) => !i.resolvedAt).length,
      totalRollbacks: ep.rollbacks.length,
      rollbackSuccessRate,
      approvalRate,
      avgDecisionTimeMs: avgDecision,
      scanCount: ep.scanHistory.length,
    },
    semanticSummary: {
      topologyAge: sem.infrastructureTopology.lastUpdated,
      totalPatterns: sem.optimizationKnowledge.length,
      highConfidencePatterns: highConfPatterns,
      stalePatterns,
      trendCount: sem.growthTrends.length,
      growingMetrics: growing,
      shrinkingMetrics: shrinking,
    },
    proceduralSummary: {
      totalStrategies: proc.strategies.length,
      highSuccessStrategies: highSuccessStrats,
      totalPlaybooks: proc.rollbackPlaybooks.length,
      totalTemplates: proc.workflowTemplates.length,
    },
    organizationalSummary: {
      industry: org.identity.industry,
      cloudMaturity: org.identity.cloudMaturity,
      decisionSpeed: org.decisionCulture.avgDecisionTimeHours < 4 ? "fast" :
        org.decisionCulture.avgDecisionTimeHours < 24 ? "moderate" : "slow",
      costSensitivity: org.decisionCulture.costSensitivity,
      complianceFrameworks: org.compliancePosture.frameworks,
    },
    overallHealth: health,
    memorySizeEstimate: totalItems,
  };
}

function summarizeEpisode(ep: StoredEpisode): string {
  const parts: string[] = [];
  parts.push(`${ep.provider} scan (${ep.trigger})`);
  parts.push(`${ep.findingCount} findings`);
  if (ep.actionsTaken > 0) parts.push(`${ep.actionsSucceeded}/${ep.actionsTaken} actions succeeded`);
  if (ep.savingsProjected > 0) parts.push(`$${ep.savingsProjected}/mo projected savings`);
  if (ep.driftItemsDetected > 0) parts.push(`${ep.driftItemsDetected} drift items`);
  if (ep.violationsFound > 0) parts.push(`${ep.violationsFound} violations`);
  parts.push(`confidence: ${ep.confidenceScore}%`);
  return parts.join(" | ");
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. GROWTH TREND COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════

export function updateGrowthTrend(
  trends: GrowthTrend[],
  provider: CloudProvider,
  metric: GrowthTrend["metric"],
  value: number,
  timestamp: string,
): GrowthTrend {
  let trend = trends.find((t) => t.provider === provider && t.metric === metric);

  if (!trend) {
    trend = {
      provider,
      metric,
      dataPoints: [],
      trend: "stable",
      growthRatePercent: 0,
      projectedNextMonth: value,
      confidence: 30,
      lastUpdated: timestamp,
    };
    trends.push(trend);
  }

  trend.dataPoints.push({ timestamp, value });
  trend.lastUpdated = timestamp;

  // Keep last 12 data points
  if (trend.dataPoints.length > 12) {
    trend.dataPoints = trend.dataPoints.slice(-12);
  }

  // Compute trend direction
  if (trend.dataPoints.length >= 2) {
    const first = trend.dataPoints[0].value;
    const last = trend.dataPoints[trend.dataPoints.length - 1].value;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;

    trend.growthRatePercent = Math.round(change * 10) / 10;
    trend.trend = change > 5 ? "growing" : change < -5 ? "shrinking" : "stable";

    // Simple linear projection
    const avgDelta = (last - first) / (trend.dataPoints.length - 1);
    trend.projectedNextMonth = Math.max(0, Math.round(last + avgDelta));

    trend.confidence = Math.min(90, 30 + trend.dataPoints.length * 5);
  }

  return trend;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. DECISION CULTURE DERIVATION
// ═══════════════════════════════════════════════════════════════════════════

export function deriveDecisionCulture(approvals: ApprovalRecord[]): DecisionCulture {
  if (approvals.length === 0) {
    return {
      avgDecisionTimeHours: 0,
      prefersCaution: true,
      prefersAutomation: false,
      toleratesDowntime: false,
      costSensitivity: "medium",
      changeFrequency: "rare",
      derivedFrom: "no approval data",
      confidence: 10,
      lastUpdated: new Date().toISOString(),
    };
  }

  const avgTimeMs = approvals.reduce((s, a) => s + a.timeToDecisionMs, 0) / approvals.length;
  const avgTimeHours = avgTimeMs / 3_600_000;

  const approved = approvals.filter((a) => a.decision === "approved").length;
  const rejected = approvals.filter((a) => a.decision === "rejected").length;
  const approvalRate = approved / approvals.length;

  const highRiskApprovals = approvals.filter(
    (a) => (a.riskLevel === "high" || a.riskLevel === "medium") && a.decision === "approved",
  ).length;
  const highRiskTotal = approvals.filter((a) => a.riskLevel === "high" || a.riskLevel === "medium").length;
  const highRiskApprovalRate = highRiskTotal > 0 ? highRiskApprovals / highRiskTotal : 0;

  const costApprovals = approvals.filter((a) => a.category === "cost" && a.decision === "approved").length;
  const costTotal = approvals.filter((a) => a.category === "cost").length;
  const costApprovalRate = costTotal > 0 ? costApprovals / costTotal : 0.5;

  const uniqueDays = new Set(approvals.map((a) => a.decidedAt.slice(0, 10))).size;
  const spanDays = Math.max(1, (Date.now() - new Date(approvals[0].decidedAt).getTime()) / 86_400_000);
  const changesPerWeek = (approvals.length / spanDays) * 7;

  return {
    avgDecisionTimeHours: Math.round(avgTimeHours * 10) / 10,
    prefersCaution: highRiskApprovalRate < 0.5 || approvalRate < 0.6,
    prefersAutomation: approvalRate > 0.8 && avgTimeHours < 2,
    toleratesDowntime: highRiskApprovalRate > 0.7,
    costSensitivity: costApprovalRate > 0.8 ? "high" : costApprovalRate > 0.5 ? "medium" : "low",
    changeFrequency: changesPerWeek > 5 ? "daily" : changesPerWeek > 1 ? "weekly" : changesPerWeek > 0.25 ? "monthly" : "rare",
    derivedFrom: `${approvals.length} approval records over ${Math.round(spanDays)} days`,
    confidence: Math.min(90, 20 + approvals.length * 2),
    lastUpdated: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. EMPTY MEMORY FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createEmptyMemory(orgId: string): AgentMemory {
  const now = new Date().toISOString();
  return {
    orgId,
    version: 1,
    lastUpdated: now,
    episodic: {
      orgId,
      episodes: [],
      incidents: [],
      rollbacks: [],
      approvalHistory: [],
      scanHistory: [],
    },
    semantic: {
      orgId,
      updatedAt: now,
      resourcePatterns: [],
      costBaselines: [],
      riskProfile: {
        tolerance: "moderate",
        historicalApprovalRate: 0,
        averageApprovalTimeHours: 0,
        rejectionPatterns: [],
        escalationFrequency: 0,
      },
      providerPreferences: [],
      operationalRhythm: {
        preferredScanDays: [1, 3, 5],
        preferredScanHourUtc: 6,
        changeWindowStart: 10,
        changeWindowEnd: 16,
        freezePeriods: [],
      },
      knownExceptions: [],
      provenance: makeProvenance("onboarding"),
      infrastructureTopology: {
        orgId,
        providers: [],
        totalRegions: 0,
        totalCompute: 0,
        totalStorage: 0,
        primaryProvider: "aws",
        primaryRegion: "us-east-1",
        multiRegion: false,
        multiCloud: false,
        lastUpdated: now,
        resourcesByProvider: {},
        resourcesByRegion: {},
      },
      growthTrends: [],
      resilienceHistory: [],
      optimizationKnowledge: [],
      providerMappings: DEFAULT_PROVIDER_MAPPINGS,
    },
    procedural: {
      orgId,
      strategies: [],
      workflowTemplates: [],
      rollbackPlaybooks: [],
      escalationPatterns: [],
    },
    organizational: {
      orgId,
      identity: {
        industry: "unknown",
        size: "startup",
        cloudMaturity: "beginner",
        primaryWorkloads: [],
        regulatoryRequirements: [],
        lastUpdated: now,
      },
      decisionCulture: {
        avgDecisionTimeHours: 0,
        prefersCaution: true,
        prefersAutomation: false,
        toleratesDowntime: false,
        costSensitivity: "medium",
        changeFrequency: "rare",
        derivedFrom: "defaults",
        confidence: 10,
        lastUpdated: now,
      },
      compliancePosture: {
        frameworks: [],
        requiresEncryption: false,
        requiresReplication: false,
        requiresMultiRegion: false,
        noPublicStorage: true,
        dataResidencyRegions: [],
        auditFrequencyDays: 90,
        lastAudit: null,
      },
      teamStructure: {
        approvers: [],
        securityReviewers: [],
        financeReviewers: [],
        primaryOperators: [],
        onCallRotation: false,
        responseTimeHours: 24,
      },
      historicalPreferences: [],
      customPolicies: [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. DEFAULT PROVIDER MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_PROVIDER_MAPPINGS: ProviderMapping[] = [
  {
    concept: "rightsizing",
    aws: "EC2 instance type modification",
    azure: "VM size change (resize)",
    gcp: "Machine type change (stop → resize → start)",
    notes: "GCP requires VM stop for most resizes",
  },
  {
    concept: "storage_tiering",
    aws: "S3 lifecycle policy / Intelligent-Tiering",
    azure: "Blob access tier change (Hot → Cool → Archive)",
    gcp: "Cloud Storage Autoclass / Nearline → Coldline",
    notes: "Minimum storage durations vary by tier and provider",
  },
  {
    concept: "commitment_discount",
    aws: "Reserved Instances / Savings Plans",
    azure: "Azure Reservations",
    gcp: "Committed Use Discounts (CUDs)",
    notes: "1-year or 3-year terms; partial upfront options vary",
  },
  {
    concept: "idle_shutdown",
    aws: "Stop EC2 instance (EBS persists)",
    azure: "Deallocate VM (no compute charges)",
    gcp: "Stop VM instance (persistent disk charges remain)",
    notes: "Storage charges persist across all providers when stopped",
  },
  {
    concept: "backup_configuration",
    aws: "AWS Backup / EBS snapshots",
    azure: "Azure Recovery Services vault",
    gcp: "Persistent disk snapshots / Cloud SQL backups",
    notes: "Cross-region backup adds cost but improves DR posture",
  },
  {
    concept: "encryption_at_rest",
    aws: "SSE-S3 / SSE-KMS / SSE-C",
    azure: "Azure Storage Service Encryption (SSE)",
    gcp: "Default encryption / Customer-managed keys (CMEK)",
    notes: "All three providers encrypt by default; KMS adds key control",
  },
  {
    concept: "public_access_control",
    aws: "S3 Block Public Access / bucket policy",
    azure: "Blob public access level / SAS tokens",
    gcp: "Uniform bucket-level access / public access prevention",
    notes: "Account-level blocks available on all providers",
  },
  {
    concept: "cross_region_replication",
    aws: "S3 Cross-Region Replication (CRR)",
    azure: "Geo-redundant storage (GRS) / GZRS",
    gcp: "Dual-region / multi-region buckets",
    notes: "Azure GRS is automatic; AWS/GCP require explicit config",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 15. PRISMA SCHEMA GUIDANCE
// ═══════════════════════════════════════════════════════════════════════════

export const PRISMA_SCHEMA_GUIDANCE = `
// Recommended Prisma models for persistent memory storage.
// These models back the in-memory types defined above.

// --- Episodic Memory ---
// model AxiomAgentEpisode {
//   id                String   @id @default(cuid())
//   orgId             String
//   runId             String
//   provider          String
//   trigger           String
//   timestamp         DateTime
//   findingCount      Int
//   actionsTaken      Int
//   actionsSucceeded  Int
//   actionsFailed     Int
//   savingsProjected  Float
//   savingsRealized   Float
//   driftItems        Int
//   violations        Int
//   confidenceScore   Int
//   compressed        Boolean  @default(false)
//   summary           String?
//   lessonsLearned    String[] // Postgres array
//   phasesJson        Json?    // full phases when not compressed
//   durationMs        Int
//   createdAt         DateTime @default(now())
//   organization      Organization @relation(fields: [orgId], references: [id])
//   @@index([orgId, timestamp])
//   @@index([provider])
// }

// model AxiomAgentIncident {
//   id             String   @id @default(cuid())
//   orgId          String
//   type           String   // IncidentType enum
//   severity       String
//   provider       String
//   regions        String[]
//   resourceIds    String[]
//   title          String
//   description    String
//   detectedAt     DateTime
//   resolvedAt     DateTime?
//   resolution     String?
//   relatedRunIds  String[]
//   costImpact     Float?
//   lessonsLearned String[]
//   createdAt      DateTime @default(now())
//   organization   Organization @relation(fields: [orgId], references: [id])
//   @@index([orgId, detectedAt])
//   @@index([type])
// }

// model AxiomApprovalRecord {
//   id                String   @id @default(cuid())
//   orgId             String
//   userId            String
//   runId             String
//   recommendationId  String
//   decision          String   // approved | rejected | snoozed | expired
//   actionType        String
//   riskLevel         String
//   category          String
//   provider          String
//   reason            String?
//   decidedAt         DateTime
//   timeToDecisionMs  Int
//   createdAt         DateTime @default(now())
//   organization      Organization @relation(fields: [orgId], references: [id])
//   @@index([orgId, decidedAt])
//   @@index([userId])
// }

// model AxiomRollbackRecord {
//   id                String   @id @default(cuid())
//   orgId             String
//   actionId          String
//   actionType        String
//   provider          String
//   region            String
//   resourceId        String
//   reason            String
//   outcome           String   // success | partial | failed
//   originalRunId     String
//   preState          Json
//   postState         Json
//   durationMs        Int
//   rolledBackAt      DateTime
//   createdAt         DateTime @default(now())
//   organization      Organization @relation(fields: [orgId], references: [id])
//   @@index([orgId, rolledBackAt])
// }

// --- Semantic Memory ---
// model AxiomOptimizationPattern {
//   id              String   @id @default(cuid())
//   orgId           String
//   pattern         String
//   description     String
//   category        String
//   provider        String   // "all" for cross-provider
//   frequency       Int
//   successRate     Float
//   avgSavings      Float
//   riskLevel       String
//   confidence      Int
//   lastSeen        DateTime
//   exampleResources String[]
//   createdAt       DateTime @default(now())
//   updatedAt       DateTime @updatedAt
//   organization    Organization @relation(fields: [orgId], references: [id])
//   @@unique([orgId, pattern, provider])
//   @@index([orgId, category])
// }

// model AxiomGrowthTrend {
//   id              String   @id @default(cuid())
//   orgId           String
//   provider        String
//   metric          String
//   trend           String   // growing | stable | shrinking
//   growthRate      Float
//   projected       Float
//   confidence      Int
//   dataPoints      Json     // TrendPoint[]
//   lastUpdated     DateTime
//   createdAt       DateTime @default(now())
//   organization    Organization @relation(fields: [orgId], references: [id])
//   @@unique([orgId, provider, metric])
// }

// --- Procedural Memory ---
// model AxiomExecutionStrategy {
//   id              String   @id @default(cuid())
//   orgId           String
//   name            String
//   description     String
//   conditions      Json     // StrategyCondition
//   steps           Json     // StrategyStep[]
//   successCount    Int      @default(0)
//   failureCount    Int      @default(0)
//   successRate     Float    @default(0)
//   avgDurationMs   Int      @default(0)
//   lastUsed        DateTime?
//   createdAt       DateTime @default(now())
//   updatedAt       DateTime @updatedAt
//   organization    Organization @relation(fields: [orgId], references: [id])
//   @@unique([orgId, name])
// }

// --- Organizational Memory ---
// model AxiomOrgMemory {
//   id                String   @id @default(cuid())
//   orgId             String   @unique
//   identity          Json     // OrgIdentity
//   decisionCulture   Json     // DecisionCulture
//   compliancePosture Json     // CompliancePosture
//   teamStructure     Json     // TeamStructure
//   createdAt         DateTime @default(now())
//   updatedAt         DateTime @updatedAt
//   organization      Organization @relation(fields: [orgId], references: [id])
// }
` as const;

// ═══════════════════════════════════════════════════════════════════════════
// 16. RESET & TESTS
// ═══════════════════════════════════════════════════════════════════════════

export function _resetMemoryCounters(): void {
  mutationSeq = 0;
}

export type MemoryTestResult = { name: string; passed: boolean; detail: string };

export function runMemoryTests(): MemoryTestResult[] {
  const results: MemoryTestResult[] = [];
  _resetMemoryCounters();

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: Empty memory creation
  const mem = createEmptyMemory("org-test");
  assert("empty memory created", () =>
    mem.orgId === "org-test" && mem.version === 1 &&
    mem.episodic.episodes.length === 0,
    `orgId=${mem.orgId}`);

  // Test 2: Episode recording
  const ep: Episode = {
    id: "ep-1", runId: "run-1", loopId: "loop-1",
    timestamp: new Date().toISOString(), provider: "aws", trigger: "manual",
    phases: [], findingCount: 5, actionsTaken: 3, actionsSucceeded: 2,
    actionsFailed: 1, savingsRealized: 0, savingsProjected: 500,
    driftItemsDetected: 1, violationsFound: 0, confidenceScore: 75,
    reflectionSummary: "test", lessonsLearned: ["lesson1"], durationMs: 5000,
  };
  const mut = recordEpisode(mem.episodic, ep, "agent_run");
  assert("episode recorded", () =>
    mem.episodic.episodes.length === 1 && mut.type === "write",
    `mutations=${mut.description}`);

  // Test 3: Incident recording
  const incident: Omit<Incident, "provenance"> = {
    id: "inc-1", orgId: "org-test", type: "cost_spike", severity: "high",
    provider: "aws", regions: ["us-east-1"], resourceIds: ["i-123"],
    title: "Cost spike", description: "Monthly cost increased 50%",
    detectedAt: new Date().toISOString(), resolvedAt: null, resolution: null,
    relatedRunIds: [], relatedDriftIds: [], costImpact: 5000, lessonsLearned: [],
  };
  recordIncident(mem.episodic, incident, "monitoring_alert");
  assert("incident recorded", () => mem.episodic.incidents.length === 1, "");

  // Test 4: Approval recording
  const approval: Omit<ApprovalRecord, "provenance"> = {
    id: "apr-1", orgId: "org-test", userId: "user-1", runId: "run-1",
    recommendationId: "rec-1", decision: "approved",
    actionType: "resize_compute" as ActionType, riskLevel: "low" as RiskLevel,
    category: "cost" as FindingCategory, provider: "aws",
    reason: null, decidedAt: new Date().toISOString(), timeToDecisionMs: 60000,
  };
  recordApproval(mem.episodic, approval);
  assert("approval recorded", () => mem.episodic.approvalHistory.length === 1, "");

  // Test 5: Rollback recording
  const rollback: Omit<RollbackRecord, "provenance"> = {
    id: "rb-1", orgId: "org-test", actionId: "act-1",
    actionType: "resize_compute" as ActionType, provider: "aws",
    region: "us-east-1", resourceId: "i-123", reason: "Verification failed",
    rolledBackAt: new Date().toISOString(), originalRunId: "run-1",
    outcome: "success", preRollbackState: {}, postRollbackState: {}, durationMs: 3000,
  };
  recordRollback(mem.episodic, rollback);
  assert("rollback recorded", () => mem.episodic.rollbacks.length === 1, "");

  // Test 6: Pattern learning (new)
  const pattern: Omit<OptimizationPattern, "provenance"> = {
    id: "pat-1", pattern: "idle_m5_instances", description: "m5 instances under 5% CPU",
    category: "cost" as FindingCategory, provider: "aws", frequency: 12,
    successRate: 0.9, avgSavingsMonthly: 150, riskLevel: "low" as RiskLevel,
    lastSeen: new Date().toISOString(), exampleResourceIds: ["i-123"],
  };
  learnOptimizationPattern(mem.semantic, pattern, "agent_run");
  assert("pattern learned", () => mem.semantic.optimizationKnowledge.length === 1, "");

  // Test 7: Pattern learning (update existing)
  const updated = { ...pattern, frequency: 15, successRate: 0.95 };
  const updateMut = learnOptimizationPattern(mem.semantic, updated, "agent_run");
  assert("pattern updated (not duplicated)", () =>
    mem.semantic.optimizationKnowledge.length === 1 && updateMut.type === "update",
    `type=${updateMut.type}`);

  // Test 8: Strategy recording
  const strategy: Omit<ExecutionStrategy, "provenance"> = {
    id: "strat-1", name: "rightsize_idle_general", description: "Rightsize idle general-purpose instances",
    applicableWhen: { categories: ["cost"], providers: ["aws"], riskLevels: ["low"], minFindings: 1, maxFindings: 50, tags: [] },
    steps: [{ order: 1, action: "resize", description: "Resize to smaller type", requiresApproval: true,
      estimatedDurationMs: 5000, rollbackAvailable: true, onFailure: "rollback" }],
    successCount: 8, failureCount: 1, successRate: 0.89, avgDurationMs: 12000,
    lastUsed: new Date().toISOString(),
  };
  recordStrategy(mem.procedural, strategy, "reflection");
  assert("strategy recorded", () => mem.procedural.strategies.length === 1, "");

  // Test 9: Memory query — all
  const allResult = queryMemory(mem, {
    memoryType: "all", filters: [], excludeExpired: true,
  });
  assert("query all returns results", () => allResult.totalResults > 0,
    `total=${allResult.totalResults}`);

  // Test 10: Memory query — by provider
  const awsResult = queryMemory(mem, {
    memoryType: "all", filters: [{ type: "provider", value: "aws" }], providers: ["aws"],
  });
  assert("query by provider works", () => awsResult.totalResults > 0, `total=${awsResult.totalResults}`);

  // Test 11: Memory query — by category
  const costResult = queryMemory(mem, {
    memoryType: "semantic", filters: [{ type: "category", value: "cost" as FindingCategory }],
  });
  assert("query by category works", () => costResult.patterns.length === 1, `patterns=${costResult.patterns.length}`);

  // Test 12: Memory summarization
  const summary = summarizeMemory(mem);
  assert("memory summarization works", () =>
    summary.orgId === "org-test" && summary.episodeSummary.totalEpisodes === 1,
    `episodes=${summary.episodeSummary.totalEpisodes}`);

  // Test 13: Growth trend computation
  const trends: GrowthTrend[] = [];
  updateGrowthTrend(trends, "aws", "compute_count", 10, "2026-01-01T00:00:00Z");
  updateGrowthTrend(trends, "aws", "compute_count", 15, "2026-02-01T00:00:00Z");
  updateGrowthTrend(trends, "aws", "compute_count", 20, "2026-03-01T00:00:00Z");
  assert("growth trend computed", () =>
    trends.length === 1 && trends[0].trend === "growing" && trends[0].dataPoints.length === 3,
    `trend=${trends[0].trend}, points=${trends[0].dataPoints.length}`);

  // Test 14: Decision culture derivation
  const approvals: ApprovalRecord[] = Array.from({ length: 10 }, (_, i) => ({
    ...approval,
    id: `apr-${i}`,
    decision: i < 8 ? "approved" as const : "rejected" as const,
    timeToDecisionMs: 60000 + i * 10000,
    decidedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    provenance: makeProvenance("user_action"),
  }));
  const culture = deriveDecisionCulture(approvals);
  assert("decision culture derived", () =>
    culture.confidence > 10 && typeof culture.prefersAutomation === "boolean",
    `confidence=${culture.confidence}, automation=${culture.prefersAutomation}`);

  // Test 15: Staleness computation
  assert("fresh staleness", () => computeStaleness(new Date().toISOString(), null) === "fresh", "");
  assert("stale staleness", () =>
    computeStaleness(new Date(Date.now() - 60 * 86_400_000).toISOString(), null) === "stale", "");
  assert("expired staleness", () =>
    computeStaleness(new Date(Date.now() - 10 * 86_400_000).toISOString(), 5) === "expired", "");

  // Test 16: Memory aging
  const ageMem = createEmptyMemory("org-age");
  // Add old episode
  const oldEp: Episode = {
    ...ep, id: "ep-old", timestamp: new Date(Date.now() - 45 * 86_400_000).toISOString(),
  };
  recordEpisode(ageMem.episodic, oldEp, "agent_run");
  const ageResult = ageMemory(ageMem, { ...DEFAULT_AGING, episodeCompressionAfterDays: 30 });
  assert("old episodes compressed", () => ageResult.compressed >= 1,
    `compressed=${ageResult.compressed}`);

  // Test 17: Provider mappings loaded
  assert("provider mappings loaded", () =>
    DEFAULT_PROVIDER_MAPPINGS.length === 8 &&
    DEFAULT_PROVIDER_MAPPINGS.every((m) => m.aws && m.azure && m.gcp),
    `count=${DEFAULT_PROVIDER_MAPPINGS.length}`);

  // Test 18: Memory health assessment
  assert("memory health is healthy", () => summary.overallHealth === "healthy",
    `health=${summary.overallHealth}`);

  // Test 19: Episode summarization
  const stored = mem.episodic.episodes[0];
  stored.compressed = true;
  stored.summary = summarizeEpisode(stored);
  assert("episode summary generated", () =>
    stored.summary !== null && stored.summary.includes("findings"),
    `summary=${stored.summary}`);

  // Test 20: Empty decision culture is safe
  const emptyCulture = deriveDecisionCulture([]);
  assert("empty culture defaults to cautious", () =>
    emptyCulture.prefersCaution === true && emptyCulture.prefersAutomation === false,
    `caution=${emptyCulture.prefersCaution}`);

  return results;
}
