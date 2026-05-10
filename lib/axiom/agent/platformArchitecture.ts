/**
 * Axiom Agent — Platform Architecture & Execution Strategy
 *
 * This module encodes the complete system architecture, subsystem breakdown,
 * build sequencing, risk analysis, and defensibility model as typed data.
 *
 * It serves three purposes:
 *   1. Living documentation queryable by the agent and the product
 *   2. Build-order guidance for engineering
 *   3. Risk/dependency tracking for leadership
 *
 * Architecture philosophy:
 *   - Provider logic never leaks into core agent
 *   - Every write operation is auditable, approvable, rollbackable
 *   - Intelligence lives in the agent core; provider adapters are dumb pipes
 *   - Security is not a feature — it's the foundation
 *   - AGI is a direction: earn autonomy, don't assume it
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. ARCHITECTURE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SystemLayer =
  | "presentation"      // UI, dashboards, notifications
  | "api"               // REST/GraphQL endpoints
  | "orchestration"     // agent core, cognitive loop, workflows
  | "intelligence"      // reasoning, planning, memory, reflection
  | "execution"         // apply, rollback, verify, tool framework
  | "provider"          // cloud adapters, snapshot generators, API wrappers
  | "security"          // auth, RBAC, encryption, audit, governance
  | "data"              // database, cache, queues, event streams
  | "observability";    // logging, metrics, alerts, traces

export type SubsystemStatus =
  | "production"        // deployed, tested, handling real traffic
  | "implemented"       // code complete, tested, not yet in prod use
  | "in_progress"       // actively being built
  | "partial"           // core functionality works, gaps remain
  | "scaffolded"        // interfaces defined, minimal implementation
  | "planned"           // designed but not coded
  | "research";         // exploring approaches

export type SubsystemPriority = "p0_critical" | "p1_high" | "p2_medium" | "p3_low";

export type Subsystem = {
  id: string;
  name: string;
  layer: SystemLayer;
  status: SubsystemStatus;
  priority: SubsystemPriority;
  description: string;
  modules: string[];               // implementing files
  dependsOn: string[];             // subsystem IDs
  exposesTo: string[];             // subsystem IDs that consume this
  currentCapabilities: string[];
  missingCapabilities: string[];
  securityProperties: string[];
  testCoverage: "comprehensive" | "moderate" | "minimal" | "none";
};

export type ArchitectureDiagram = {
  name: string;
  description: string;
  layers: string[];
  ascii: string;
};

export type BuildPhase = {
  id: string;
  name: string;
  timeframe: string;
  objectives: string[];
  subsystems: string[];            // subsystem IDs to build/enhance
  deliverables: string[];
  successCriteria: string[];
  risks: string[];
};

export type TechnicalRisk = {
  id: string;
  category: "architecture" | "security" | "scalability" | "integration" | "data" | "operations";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  impact: string;
  mitigation: string;
  owner: string;                   // team/role responsible
  status: "open" | "mitigated" | "accepted";
};

export type ProductRisk = {
  id: string;
  category: "adoption" | "trust" | "competition" | "pricing" | "compliance" | "ux";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  impact: string;
  mitigation: string;
};

export type DefensibilityFactor = {
  factor: string;
  description: string;
  moatStrength: "strong" | "moderate" | "weak";
  timeToReplicate: string;
};

export type MVPRequirement = {
  id: string;
  category: "functionality" | "security" | "trust" | "ux" | "operations";
  requirement: string;
  rationale: string;
  status: SubsystemStatus;
  blockedBy: string[];
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. SYSTEM ARCHITECTURE DIAGRAM
// ═══════════════════════════════════════════════════════════════════════════

export const ARCHITECTURE_DIAGRAMS: ArchitectureDiagram[] = [
  {
    name: "System Layer Architecture",
    description: "End-to-end data flow from cloud providers through agent intelligence to user-facing actions",
    layers: ["presentation", "api", "orchestration", "intelligence", "execution", "provider", "security", "data", "observability"],
    ascii: `
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                          │
│  Dashboard │ Approval UI │ Notifications │ Reports │ Onboarding    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                           API LAYER                                │
│  REST Endpoints │ tRPC Routes │ Webhooks │ Scheduled Triggers      │
│  Rate Limiting  │ Auth Middleware │ Input Validation               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      ORCHESTRATION LAYER                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Cognitive    │  │ Workflow     │  │ Operation                │   │
│  │ Architecture │  │ Engine       │  │ Orchestrator             │   │
│  │ (6-phase     │  │ (trigger →   │  │ (phased rollout,         │   │
│  │  loop)       │  │  condition → │  │  canary, rollback)       │   │
│  │              │  │  action)     │  │                          │   │
│  └──────┬───────┘  └──────┬──────┘  └────────────┬─────────────┘   │
│         │                 │                       │                 │
│  ┌──────▼─────────────────▼───────────────────────▼─────────────┐  │
│  │                    AGENT CORE (runAgent.ts)                   │  │
│  │  Scan → Classify → Prioritize → Recommend → Plan → Execute  │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      INTELLIGENCE LAYER                            │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │ Reasoning  │ │ Planning │ │ Memory     │ │ Reflection       │   │
│  │ Engine     │ │ Engine   │ │ System     │ │ Engine           │   │
│  │            │ │          │ │ (4-tier)   │ │                  │   │
│  │ Themes,    │ │ DAG,     │ │ episodic,  │ │ calibration,     │   │
│  │ tradeoffs, │ │ phasing, │ │ semantic,  │ │ noise analysis,  │   │
│  │ trends     │ │ rollback │ │ procedural,│ │ safety review    │   │
│  │            │ │          │ │ org        │ │                  │   │
│  └────────────┘ └──────────┘ └────────────┘ └──────────────────┘   │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │ Adaptive   │ │ Workflow │ │ Explain-   │ │ Multi-Cloud      │   │
│  │ Behavior   │ │ Intelli- │ │ ability    │ │ Prioritizer      │   │
│  │            │ │ gence    │ │ Engine     │ │                  │   │
│  └────────────┘ └──────────┘ └────────────┘ └──────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       EXECUTION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Tool         │  │ Apply Engine │  │ Verification             │  │
│  │ Framework    │  │ (pre-check,  │  │ Engine                   │  │
│  │ (10 tool     │  │  dry-run,    │  │ (post-apply checks,      │  │
│  │  categories) │  │  execute,    │  │  success criteria,       │  │
│  │              │  │  verify)     │  │  rollback triggers)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Terraform    │  │ Rollback     │  │ Drift                    │  │
│  │ Generator    │  │ Planner      │  │ Engine                   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        PROVIDER LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Provider Abstraction (Unified Interface)        │   │
│  │  validateConnection │ collectSnapshot │ estimateCosts        │   │
│  │  generatePlan │ applyAction │ verifyAction │ rollbackAction  │   │
│  └───────┬──────────────────┬──────────────────┬───────────────┘   │
│          │                  │                  │                    │
│  ┌───────▼──────┐  ┌───────▼──────┐  ┌────────▼─────┐             │
│  │ AWS Adapter  │  │ Azure Adapter│  │ GCP Adapter   │             │
│  │ ✓ snapshot   │  │ ✓ snapshot   │  │ ✓ snapshot    │             │
│  │ ✓ apply      │  │ ✗ apply      │  │ ✗ apply       │             │
│  │ ✓ rollback   │  │ ✗ rollback   │  │ ✗ rollback    │             │
│  │ ✓ 6 plugins  │  │ ~ 3 plugins  │  │ ~ 3 plugins   │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    CROSS-CUTTING CONCERNS                          │
│  ┌────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ SECURITY       │  │ OBSERVABILITY    │  │ DATA              │   │
│  │ • RBAC Engine  │  │ • Structured Log │  │ • Prisma/Postgres │   │
│  │ • Governance   │  │ • Metrics        │  │ • Credential Vault│   │
│  │ • Approval     │  │ • Alerting       │  │ • Task Queue      │   │
│  │   Workflows    │  │ • Correlation    │  │ • Event Stream    │   │
│  │ • Credential   │  │   IDs            │  │                   │   │
│  │   Vault        │  │ • Secret         │  │                   │   │
│  │ • Autopilot    │  │   Redaction      │  │                   │   │
│  │   Modes        │  │ • Dashboards     │  │                   │   │
│  └────────────────┘  └──────────────────┘  └───────────────────┘   │
└────────────────────────────────────────────────────────────────────┘`,
  },
  {
    name: "Agent Cognitive Loop",
    description: "The 6-phase reasoning cycle that drives all agent behavior",
    layers: ["orchestration", "intelligence"],
    ascii: `
        ┌─────────────────────────────────────────────┐
        │           COGNITIVE ARCHITECTURE             │
        │                                             │
        │    ┌──────────┐      ┌──────────┐           │
        │    │ OBSERVE  │─────▶│  REASON  │           │
        │    │          │      │          │           │
        │    │ snapshot,│      │ themes,  │           │
        │    │ drift,   │      │ tradeoffs│           │
        │    │ events   │      │ explain  │           │
        │    └────▲─────┘      └────┬─────┘           │
        │         │                 │                  │
        │         │                 ▼                  │
        │    ┌────┴─────┐      ┌──────────┐           │
        │    │ REFLECT  │      │   PLAN   │           │
        │    │          │      │          │           │
        │    │ calibrate│      │ phase,   │           │
        │    │ learn,   │      │ sequence,│           │
        │    │ adapt    │      │ approve  │           │
        │    └────▲─────┘      └────┬─────┘           │
        │         │                 │                  │
        │         │                 ▼                  │
        │    ┌────┴─────┐      ┌──────────┐           │
        │    │  VERIFY  │◀─────│   ACT    │           │
        │    │          │      │          │           │
        │    │ success  │      │ execute, │           │
        │    │ criteria,│      │ rollback,│           │
        │    │ drift    │      │ monitor  │           │
        │    └──────────┘      └──────────┘           │
        │                                             │
        │  ┌───────────────────────────────────────┐  │
        │  │          WORKING MEMORY               │  │
        │  │  episodic │ semantic │ procedural │ org│  │
        │  └───────────────────────────────────────┘  │
        └─────────────────────────────────────────────┘`,
  },
  {
    name: "Security Architecture",
    description: "Defense-in-depth security model with trust boundaries",
    layers: ["security"],
    ascii: `
┌─────────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY: PUBLIC                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auth Gateway: NextAuth + JWT + Session Validation        │   │
│  │ Rate Limiting │ Input Sanitization │ CORS │ CSP          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │               TRUST BOUNDARY: AUTHENTICATED              │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │ RBAC Engine: role → permissions → provider scope   │   │   │
│  │  │ Org Isolation: orgId on every query                │   │   │
│  │  │ Feature Gates: autopilot mode per account          │   │   │
│  │  └──────────────────────┬─────────────────────────────┘   │   │
│  │                         │                                 │   │
│  │  ┌──────────────────────▼─────────────────────────────┐   │   │
│  │  │          TRUST BOUNDARY: AGENT ACTIONS             │   │   │
│  │  │  ┌─────────────────────────────────────────────┐   │   │   │
│  │  │  │ Approval Workflow:                          │   │   │   │
│  │  │  │  read_only → recommend → approve → execute  │   │   │   │
│  │  │  │                                             │   │   │   │
│  │  │  │ Blast Radius Enforcement:                   │   │   │   │
│  │  │  │  max resources per step, canary first       │   │   │   │
│  │  │  │                                             │   │   │   │
│  │  │  │ Rollback Guarantee:                         │   │   │   │
│  │  │  │  state captured before every mutation        │   │   │   │
│  │  │  └─────────────────────────────────────────────┘   │   │   │
│  │  │                                                     │   │   │
│  │  │  ┌─────────────────────────────────────────────┐   │   │   │
│  │  │  │     TRUST BOUNDARY: CLOUD CREDENTIALS       │   │   │   │
│  │  │  │  AES-256-GCM encrypted at rest              │   │   │   │
│  │  │  │  Per-tenant vault isolation                  │   │   │   │
│  │  │  │  Least-privilege IAM roles                   │   │   │   │
│  │  │  │  No process.env for user credentials         │   │   │   │
│  │  │  │  Credential rotation support                 │   │   │   │
│  │  │  │  Session tokens with expiry                  │   │   │   │
│  │  │  └─────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                 AUDIT LAYER (IMMUTABLE)                    │   │
│  │  Every action │ Every approval │ Every credential access   │   │
│  │  Before/after state │ Correlation IDs │ Secret redaction   │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘`,
  },
  {
    name: "Data Flow: Scan to Action",
    description: "Complete data pipeline from cloud scan to verified execution",
    layers: ["provider", "intelligence", "execution", "security"],
    ascii: `
Cloud Provider APIs
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ AWS SDK      │     │ Azure SDK    │     │ GCP SDK      │
│ EC2, S3,     │     │ VMs, Storage │     │ GCE, GCS     │
│ CloudWatch   │     │ Monitor, ARM │     │ Monitoring   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │   SNAPSHOT LAYER     │
                │ Normalize → Enrich  │
                │ Quality Score       │
                │ Provider Evidence   │
                └──────────┬──────────┘
                           │
              ┌────────────▼────────────┐
              │    FINDING PIPELINE     │
              │ Classify → Score →      │
              │ Deduplicate → Explain   │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   REASONING ENGINE      │
              │ Themes → Tradeoffs →    │
              │ Trends → Narrative      │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  RECOMMENDATION BUILDER │
              │ Plain English + Code +  │
              │ Impact + Confidence     │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │    PLANNING ENGINE      │
              │ Phase → Dependencies → │
              │ Blast Radius → Schedule │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   APPROVAL WORKFLOW     │◄── Human Decision Point
              │ RBAC Check → Chain →   │
              │ Vote → Resolve          │
              └────────────┬────────────┘
                           │ (approved only)
              ┌────────────▼────────────┐
              │    EXECUTION ENGINE     │
              │ Pre-check → Dry-run →  │
              │ Canary → Execute →     │
              │ Verify → Audit Log     │
              └────────────┬────────────┘
                           │ (if failure)
              ┌────────────▼────────────┐
              │    ROLLBACK ENGINE      │
              │ Restore pre-state →    │
              │ Verify restoration →   │
              │ Incident notification  │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   REFLECTION ENGINE     │
              │ Score outcome → Learn → │
              │ Adapt (within bounds)   │
              └─────────────────────────┘`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. SUBSYSTEM INVENTORY
// ═══════════════════════════════════════════════════════════════════════════

export const SUBSYSTEMS: Subsystem[] = [
  // --- ORCHESTRATION LAYER ---
  {
    id: "ss-cognitive",
    name: "Cognitive Architecture",
    layer: "orchestration",
    status: "implemented",
    priority: "p0_critical",
    description: "6-phase reasoning loop (Observe → Reason → Plan → Act → Verify → Reflect) with autonomy ladder and safety bounds",
    modules: ["cognitiveArchitecture.ts"],
    dependsOn: ["ss-reasoning", "ss-planning", "ss-memory", "ss-reflection"],
    exposesTo: ["ss-agent-core"],
    currentCapabilities: ["6-phase loop", "autonomy levels L0-L5", "safety bounds", "escalation policy", "working memory"],
    missingCapabilities: ["event-driven triggering", "parallel phase execution", "phase timeout enforcement"],
    securityProperties: ["autonomy never self-promotes", "safety bounds enforced at every level", "human checkpoint on escalation"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-agent-core",
    name: "Agent Core (runAgent)",
    layer: "orchestration",
    status: "production",
    priority: "p0_critical",
    description: "Main entry point orchestrating scan → classify → prioritize → recommend → plan → execute pipeline",
    modules: ["runAgent.ts", "orchestrator.ts"],
    dependsOn: ["ss-snapshot", "ss-prioritizer", "ss-reasoning", "ss-planning", "ss-approval", "ss-execution"],
    exposesTo: ["ss-api"],
    currentCapabilities: ["full scan pipeline", "approval handling", "cost signals", "dry-run simulation", "prechecks"],
    missingCapabilities: ["streaming progress updates", "partial scan resume", "cross-account orchestration"],
    securityProperties: ["org-scoped execution", "credential isolation", "audit trail"],
    testCoverage: "moderate",
  },
  {
    id: "ss-workflow",
    name: "Workflow Engine",
    layer: "orchestration",
    status: "implemented",
    priority: "p1_high",
    description: "Event-driven automation: trigger → condition → action pipelines with execution history",
    modules: ["workflowEngine.ts"],
    dependsOn: ["ss-agent-core", "ss-monitoring"],
    exposesTo: ["ss-api"],
    currentCapabilities: ["6 trigger types", "8 action types", "condition evaluation", "execution history"],
    missingCapabilities: ["workflow versioning", "A/B workflow testing", "cross-workflow dependencies"],
    securityProperties: ["dangerous actions blocked", "full audit logging", "org isolation"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-operation-orch",
    name: "Operation Orchestrator",
    layer: "orchestration",
    status: "implemented",
    priority: "p0_critical",
    description: "Multi-step phased execution with dependency management, canary validation, and rollback coordination",
    modules: ["operationOrchestrator.ts"],
    dependsOn: ["ss-execution", "ss-approval", "ss-monitoring"],
    exposesTo: ["ss-agent-core"],
    currentCapabilities: ["6 operation types", "dependency DAG", "canary config", "blast radius enforcement", "rollback procedures"],
    missingCapabilities: ["cross-provider operations", "operation templates marketplace", "SLA-aware scheduling"],
    securityProperties: ["approval checkpoints", "blast radius limits", "automatic rollback on failure"],
    testCoverage: "comprehensive",
  },

  // --- INTELLIGENCE LAYER ---
  {
    id: "ss-reasoning",
    name: "Reasoning Engine",
    layer: "intelligence",
    status: "implemented",
    priority: "p0_critical",
    description: "Transforms raw findings into explainable intelligence through clustering, theme analysis, and tradeoff evaluation",
    modules: ["reasoningEngine.ts"],
    dependsOn: ["ss-snapshot", "ss-prioritizer"],
    exposesTo: ["ss-agent-core", "ss-planning"],
    currentCapabilities: ["theme discovery", "tradeoff analysis", "trend detection", "narrative generation"],
    missingCapabilities: ["cross-cloud reasoning", "causal inference", "historical trend comparison"],
    securityProperties: ["no data leaves the system", "explainable outputs"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-planning",
    name: "Planning Engine",
    layer: "intelligence",
    status: "implemented",
    priority: "p0_critical",
    description: "Multi-step planning with phased rollouts, dependency DAGs, and rollback triggers",
    modules: ["planningEngine.ts"],
    dependsOn: ["ss-reasoning", "ss-governance"],
    exposesTo: ["ss-operation-orch", "ss-execution"],
    currentCapabilities: ["4 rollout archetypes", "dependency graphs", "topological sort", "cycle detection"],
    missingCapabilities: ["cost-aware plan optimization", "SLA-constrained scheduling", "plan comparison"],
    securityProperties: ["approval checkpoints in every plan", "blast radius computed upfront"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-memory",
    name: "Memory System",
    layer: "intelligence",
    status: "implemented",
    priority: "p1_high",
    description: "4-tier persistent memory (episodic, semantic, procedural, organizational) with aging and query interface",
    modules: ["memorySystem.ts"],
    dependsOn: ["ss-data"],
    exposesTo: ["ss-cognitive", "ss-reasoning", "ss-reflection"],
    currentCapabilities: ["4 memory tiers", "query interface", "memory aging", "confidence decay", "incident recording"],
    missingCapabilities: ["DB persistence (currently in-memory)", "cross-org anonymized learning", "memory compaction"],
    securityProperties: ["org-isolated memory", "no cross-tenant leakage", "queryable provenance"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-reflection",
    name: "Reflection Engine",
    layer: "intelligence",
    status: "implemented",
    priority: "p1_high",
    description: "Self-evaluation across 7 domains with evidence-based adjustments capped at ±20%",
    modules: ["reflectionEngine.ts"],
    dependsOn: ["ss-memory", "ss-agent-core"],
    exposesTo: ["ss-cognitive", "ss-adaptive"],
    currentCapabilities: ["7-domain grading", "calibration analysis", "noise analysis", "safety review", "adoption tracking"],
    missingCapabilities: ["longitudinal trend analysis", "A/B experiment framework", "reflection scheduling"],
    securityProperties: ["adjustments capped", "safety domain always escalates", "transparent reasoning"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-adaptive",
    name: "Adaptive Behavior",
    layer: "intelligence",
    status: "implemented",
    priority: "p2_medium",
    description: "Learns from org behavior signals to derive transparent, reversible adjustment factors",
    modules: ["adaptiveBehavior.ts"],
    dependsOn: ["ss-memory"],
    exposesTo: ["ss-prioritizer", "ss-reasoning"],
    currentCapabilities: ["signal recording", "behavior profiling", "adjustment derivation", "safeguard checks"],
    missingCapabilities: ["cohort analysis", "seasonal pattern detection", "adjustment A/B testing"],
    securityProperties: ["all adjustments reversible", "safeguard validation", "transparent factors"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-workflow-intel",
    name: "Workflow Intelligence",
    layer: "intelligence",
    status: "implemented",
    priority: "p2_medium",
    description: "Self-improving across 7 measurable dimensions with governance safeguards",
    modules: ["workflowIntelligence.ts"],
    dependsOn: ["ss-adaptive", "ss-reflection"],
    exposesTo: ["ss-workflow"],
    currentCapabilities: ["7 learning dimensions", "pattern discovery", "adaptation lifecycle", "regression detection"],
    missingCapabilities: ["long-horizon optimization", "cross-org benchmarking"],
    securityProperties: ["±15% delta cap", "no autonomy escalation", "minimum sample size", "all reversible"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-explainability",
    name: "Explainability Engine",
    layer: "intelligence",
    status: "implemented",
    priority: "p0_critical",
    description: "Every recommendation fully explainable with grounded evidence, confidence scoring, and risk disclosure",
    modules: ["explainabilityEngine.ts"],
    dependsOn: ["ss-reasoning"],
    exposesTo: ["ss-agent-core", "ss-api"],
    currentCapabilities: ["evidence-based explanations", "confidence assessment", "assumption transparency", "risk disclosure"],
    missingCapabilities: ["interactive explanation drill-down", "explanation localization"],
    securityProperties: ["no hallucinated evidence", "provider data grounded", "assumption tracking"],
    testCoverage: "comprehensive",
  },

  // --- EXECUTION LAYER ---
  {
    id: "ss-execution",
    name: "Apply & Verification Engine",
    layer: "execution",
    status: "partial",
    priority: "p0_critical",
    description: "Pre-check → dry-run → execute → verify pipeline with rollback on failure",
    modules: ["runAgent.ts"],
    dependsOn: ["ss-provider-aws", "ss-approval"],
    exposesTo: ["ss-operation-orch"],
    currentCapabilities: ["AWS apply", "pre-checks", "dry-run simulation", "post-apply verification"],
    missingCapabilities: ["Azure apply", "GCP apply", "parallel execution", "execution timeout enforcement"],
    securityProperties: ["state captured before mutation", "rollback on any failure", "audit every action"],
    testCoverage: "moderate",
  },
  {
    id: "ss-tool-framework",
    name: "Tool Framework",
    layer: "execution",
    status: "implemented",
    priority: "p1_high",
    description: "Structured tool discovery, selection, invocation with retry, verification, and execution tracing",
    modules: ["toolFramework.ts"],
    dependsOn: ["ss-provider-aws"],
    exposesTo: ["ss-agent-core", "ss-operation-orch"],
    currentCapabilities: ["10 tool categories", "tool registry", "invocation with retry", "execution traces", "output verification"],
    missingCapabilities: ["Azure tools", "GCP tools", "tool marketplace", "custom tool registration API"],
    securityProperties: ["authorization gate on every invocation", "risk budget enforcement", "full trace audit"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-terraform",
    name: "Terraform Generator",
    layer: "execution",
    status: "partial",
    priority: "p1_high",
    description: "Generates provider-specific Terraform HCL for recommended actions",
    modules: ["toolFramework.ts"],
    dependsOn: ["ss-planning"],
    exposesTo: ["ss-agent-core"],
    currentCapabilities: ["AWS Terraform generation", "CLI command generation"],
    missingCapabilities: ["Azure ARM/Terraform", "GCP Terraform", "Terraform plan parsing", "state import"],
    securityProperties: ["generated code includes comments explaining rationale", "dry-run commands first"],
    testCoverage: "minimal",
  },
  {
    id: "ss-drift",
    name: "Drift Engine",
    layer: "execution",
    status: "implemented",
    priority: "p1_high",
    description: "Detects infrastructure drift from Terraform plans, approved plans, previous snapshots, and resilience baselines",
    modules: ["driftEngine.ts"],
    dependsOn: ["ss-snapshot", "ss-monitoring"],
    exposesTo: ["ss-agent-core", "ss-cognitive"],
    currentCapabilities: ["4 drift sources", "deterministic detection", "remediation suggestions"],
    missingCapabilities: ["cross-cloud drift correlation", "drift trend analysis", "automated drift remediation"],
    securityProperties: ["read-only detection", "no side effects", "explainable outputs"],
    testCoverage: "comprehensive",
  },

  // --- PROVIDER LAYER ---
  {
    id: "ss-snapshot",
    name: "Cloud Snapshot System",
    layer: "provider",
    status: "production",
    priority: "p0_critical",
    description: "Unified snapshot schema normalizing AWS, Azure, GCP resources into provider-agnostic structures",
    modules: ["cloudSnapshot.ts", "normalizer.ts"],
    dependsOn: ["ss-provider-aws", "ss-provider-azure", "ss-provider-gcp"],
    exposesTo: ["ss-agent-core", "ss-reasoning", "ss-drift"],
    currentCapabilities: ["compute normalization", "storage normalization", "quality scoring", "provider evidence"],
    missingCapabilities: ["networking resources", "database resources", "IAM resources", "serverless resources"],
    securityProperties: ["no credentials in snapshot", "secret redaction", "provider evidence separate from data"],
    testCoverage: "moderate",
  },
  {
    id: "ss-provider-aws",
    name: "AWS Provider Adapter",
    layer: "provider",
    status: "production",
    priority: "p0_critical",
    description: "Full AWS implementation: snapshot, apply, rollback, verify with 6 specialized plugins",
    modules: ["plugins/aws/snapshot-generator.ts"],
    dependsOn: ["ss-credentials"],
    exposesTo: ["ss-snapshot", "ss-execution"],
    currentCapabilities: [
      "EC2 + S3 snapshot", "CloudWatch metrics", "cost estimation",
      "IAM scan", "access key disable", "cost explorer",
      "infra discovery", "S3 public bucket scan", "security group exposure",
      "apply actions", "rollback actions", "verification",
    ],
    missingCapabilities: [
      "RDS/Aurora databases", "Lambda functions", "ECS/EKS containers",
      "VPC/networking", "IAM policy analysis", "CloudFormation stacks",
      "Reserved Instance management", "Savings Plan analysis",
    ],
    securityProperties: ["least-privilege IAM", "read-only by default", "scoped write permissions"],
    testCoverage: "moderate",
  },
  {
    id: "ss-provider-azure",
    name: "Azure Provider Adapter",
    layer: "provider",
    status: "partial",
    priority: "p1_high",
    description: "Azure snapshot and read operations implemented; apply and rollback pending",
    modules: ["plugins/azure/snapshot-generator.ts"],
    dependsOn: ["ss-credentials"],
    exposesTo: ["ss-snapshot"],
    currentCapabilities: [
      "VM snapshot", "Storage Account snapshot", "Azure Monitor metrics",
      "Recovery Services detection", "resource group collection",
      "infra discovery plugin", "security scan plugin",
    ],
    missingCapabilities: [
      "apply actions", "rollback actions",
      "Azure SQL/Cosmos DB", "AKS", "Azure Functions",
      "NSG analysis", "Azure Policy integration",
      "Azure Advisor integration", "cost optimization plugins",
    ],
    securityProperties: ["Reader role minimum", "TokenCredential auth", "subscription-scoped"],
    testCoverage: "minimal",
  },
  {
    id: "ss-provider-gcp",
    name: "GCP Provider Adapter",
    layer: "provider",
    status: "partial",
    priority: "p1_high",
    description: "GCP snapshot and read operations implemented; apply and rollback pending",
    modules: ["plugins/gcp/snapshot-generator.ts"],
    dependsOn: ["ss-credentials"],
    exposesTo: ["ss-snapshot"],
    currentCapabilities: [
      "GCE instance snapshot", "Cloud Storage bucket snapshot",
      "Cloud Monitoring metrics", "snapshot detection",
      "infra discovery plugin", "security scan plugin",
    ],
    missingCapabilities: [
      "apply actions", "rollback actions",
      "Cloud SQL", "GKE", "Cloud Functions/Run",
      "VPC/firewall analysis", "BigQuery",
      "Recommender API integration", "cost optimization plugins",
    ],
    securityProperties: ["service account auth", "project-scoped", "viewer role minimum"],
    testCoverage: "minimal",
  },

  // --- SECURITY LAYER ---
  {
    id: "ss-rbac",
    name: "RBAC & Approval Engine",
    layer: "security",
    status: "implemented",
    priority: "p0_critical",
    description: "Multi-role access control with approval chains, voting, escalation, and audit logging",
    modules: ["rbacEngine.ts"],
    dependsOn: [],
    exposesTo: ["ss-agent-core", "ss-execution", "ss-api"],
    currentCapabilities: [
      "role hierarchy", "provider-scoped permissions", "approval chains",
      "voting with quorum", "escalation", "expiration", "audit logging",
    ],
    missingCapabilities: ["SSO/SAML integration", "custom role definitions", "permission delegation"],
    securityProperties: ["every authorization logged", "least-privilege default", "time-bounded approvals"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-governance",
    name: "Governance Engine",
    layer: "security",
    status: "implemented",
    priority: "p0_critical",
    description: "Declarative policy engine for cost, security, resilience, and compliance enforcement",
    modules: ["governanceEngine.ts"],
    dependsOn: [],
    exposesTo: ["ss-agent-core", "ss-planning"],
    currentCapabilities: [
      "10 rule types", "4 enforcement levels", "scope filtering",
      "compliance scoring", "violation evidence", "remediation mapping",
    ],
    missingCapabilities: ["custom rule DSL", "policy versioning", "compliance report export", "regulatory mapping"],
    securityProperties: ["deterministic evaluation", "no false negatives on block-level", "audit trail"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-credentials",
    name: "Credential Vault",
    layer: "security",
    status: "production",
    priority: "p0_critical",
    description: "AES-256-GCM encrypted credential storage with per-tenant isolation and assume-role support",
    modules: ["security/credentialVault.ts", "plugins/credentials.ts"],
    dependsOn: [],
    exposesTo: ["ss-provider-aws", "ss-provider-azure", "ss-provider-gcp"],
    currentCapabilities: [
      "AES-256-GCM encryption", "per-tenant isolation", "assume-role (AWS)",
      "secret redaction", "credential retrieval by ref",
    ],
    missingCapabilities: [
      "credential rotation automation", "key management service integration",
      "temporary credential generation", "credential health monitoring",
      "hardware security module (HSM) support",
    ],
    securityProperties: [
      "never in process.env", "encrypted at rest", "12-byte random IV",
      "16-byte auth tag", "32-char minimum key", "redacted in logs",
    ],
    testCoverage: "moderate",
  },
  {
    id: "ss-approval",
    name: "Approval Workflows",
    layer: "security",
    status: "implemented",
    priority: "p0_critical",
    description: "Human-in-the-loop approval with RBAC-aware chains, voting, and escalation",
    modules: ["rbacEngine.ts", "autopilot.ts"],
    dependsOn: ["ss-rbac"],
    exposesTo: ["ss-execution", "ss-operation-orch"],
    currentCapabilities: [
      "4 autopilot modes", "approval chains", "voting with quorum",
      "escalation on timeout", "mode confirmation copy",
    ],
    missingCapabilities: ["Slack/Teams approval integration", "mobile push approvals", "delegation"],
    securityProperties: ["no auto-escalation of autopilot mode", "risk ceiling enforcement"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-autopilot",
    name: "Autopilot System",
    layer: "security",
    status: "implemented",
    priority: "p0_critical",
    description: "4-mode autonomy control (observe → recommend → assisted → full_guarded) with policy resolution",
    modules: ["autopilot.ts"],
    dependsOn: ["ss-rbac", "ss-governance"],
    exposesTo: ["ss-agent-core"],
    currentCapabilities: ["4 modes", "policy resolution", "risk ceilings", "escalation logic", "mode change logging"],
    missingCapabilities: ["per-action-class autopilot", "gradual mode transitions", "mode recommendations"],
    securityProperties: ["mode changes logged", "admin-only mode changes", "risk ceiling per mode"],
    testCoverage: "comprehensive",
  },

  // --- OBSERVABILITY LAYER ---
  {
    id: "ss-observability",
    name: "Observability Platform",
    layer: "observability",
    status: "implemented",
    priority: "p1_high",
    description: "Structured logging, metrics, alerting, correlation IDs, and secret redaction",
    modules: ["observability.ts"],
    dependsOn: [],
    exposesTo: ["ss-agent-core", "ss-execution", "ss-api"],
    currentCapabilities: [
      "structured logging", "counters/gauges/histograms", "correlation IDs",
      "secret redaction", "pluggable sinks", "alert rules", "health checks",
      "dashboards", "exportable metrics",
    ],
    missingCapabilities: ["distributed tracing", "log aggregation pipeline", "real-time dashboards"],
    securityProperties: ["secrets never in logs", "correlation across operations", "immutable audit entries"],
    testCoverage: "comprehensive",
  },
  {
    id: "ss-monitoring",
    name: "Monitoring Agent",
    layer: "observability",
    status: "implemented",
    priority: "p1_high",
    description: "Continuous monitoring with 8 change categories, anti-noise strategy, and alert deduplication",
    modules: ["monitoringAgent.ts"],
    dependsOn: ["ss-snapshot"],
    exposesTo: ["ss-workflow", "ss-cognitive"],
    currentCapabilities: [
      "8 change categories", "alert deduplication", "suppression",
      "cooldown periods", "notification building",
    ],
    missingCapabilities: ["real-time event streaming", "anomaly detection ML", "alert correlation"],
    securityProperties: ["read-only monitoring", "no side effects", "org-scoped"],
    testCoverage: "comprehensive",
  },

  // --- DATA LAYER ---
  {
    id: "ss-data",
    name: "Data Platform",
    layer: "data",
    status: "production",
    priority: "p0_critical",
    description: "PostgreSQL via Prisma with models for accounts, runs, findings, approvals, audit events",
    modules: ["prisma/schema.prisma"],
    dependsOn: [],
    exposesTo: ["ss-agent-core", "ss-memory", "ss-api"],
    currentCapabilities: [
      "CloudAccount", "AxiomAgentRun", "AxiomFinding", "AxiomRecommendation",
      "AxiomExecutionPlan", "AxiomApprovalRequest", "AxiomAuditEvent",
      "AxiomOrgPreferences", "AxiomScheduledRun", "AxiomAgentTask",
    ],
    missingCapabilities: [
      "memory persistence tables", "drift history", "metric time-series",
      "cross-account linking", "data retention policies",
    ],
    securityProperties: ["org-scoped queries", "no cross-tenant access", "encrypted connections"],
    testCoverage: "moderate",
  },

  // --- PRESENTATION LAYER ---
  {
    id: "ss-prioritizer",
    name: "Prioritizer & Recommendations",
    layer: "intelligence",
    status: "production",
    priority: "p0_critical",
    description: "Disposition classification, priority scoring, and rich recommendation building",
    modules: ["prioritizer.ts", "recommendationBuilder.ts", "multiCloudPrioritizer.ts"],
    dependsOn: ["ss-snapshot"],
    exposesTo: ["ss-reasoning", "ss-agent-core"],
    currentCapabilities: [
      "disposition classification", "priority scoring", "preference-aware scoring",
      "rich recommendations", "multi-cloud prioritization",
    ],
    missingCapabilities: ["ML-based priority learning", "personalized scoring"],
    securityProperties: ["deterministic classification", "explainable scores"],
    testCoverage: "comprehensive",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. AWS-FIRST EXECUTION STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

export type AWSCompletionItem = {
  id: string;
  area: string;
  status: SubsystemStatus;
  priority: SubsystemPriority;
  description: string;
  estimateWeeks: number;
  dependencies: string[];
};

export const AWS_COMPLETION_ROADMAP: AWSCompletionItem[] = [
  {
    id: "aws-1",
    area: "Resource Coverage",
    status: "planned",
    priority: "p0_critical",
    description: "Add RDS/Aurora snapshot: instance class, storage, multi-AZ, read replicas, backup retention, Performance Insights",
    estimateWeeks: 2,
    dependencies: [],
  },
  {
    id: "aws-2",
    area: "Resource Coverage",
    status: "planned",
    priority: "p1_high",
    description: "Add ECS/EKS container snapshot: cluster config, service definitions, task counts, scaling policies",
    estimateWeeks: 3,
    dependencies: [],
  },
  {
    id: "aws-3",
    area: "Resource Coverage",
    status: "planned",
    priority: "p1_high",
    description: "Add Lambda snapshot: function config, invocation counts, duration, memory utilization, cold starts",
    estimateWeeks: 2,
    dependencies: [],
  },
  {
    id: "aws-4",
    area: "Resource Coverage",
    status: "planned",
    priority: "p2_medium",
    description: "Add VPC/networking snapshot: subnets, security groups, NAT gateways, transit gateway, flow logs",
    estimateWeeks: 2,
    dependencies: [],
  },
  {
    id: "aws-5",
    area: "Cost Optimization",
    status: "planned",
    priority: "p0_critical",
    description: "Reserved Instance and Savings Plan analysis: utilization, coverage, purchase recommendations",
    estimateWeeks: 3,
    dependencies: ["aws-1"],
  },
  {
    id: "aws-6",
    area: "Cost Optimization",
    status: "planned",
    priority: "p1_high",
    description: "Cost Explorer deep integration: daily cost trends, anomaly detection, forecast",
    estimateWeeks: 2,
    dependencies: [],
  },
  {
    id: "aws-7",
    area: "Security",
    status: "planned",
    priority: "p0_critical",
    description: "IAM policy analysis: over-permissioned roles, unused access keys, MFA enforcement, cross-account access",
    estimateWeeks: 3,
    dependencies: [],
  },
  {
    id: "aws-8",
    area: "Execution",
    status: "in_progress",
    priority: "p0_critical",
    description: "Production apply pipeline: pre-check → dry-run → canary → execute → verify → audit for all resource types",
    estimateWeeks: 4,
    dependencies: ["aws-1", "aws-2", "aws-3"],
  },
  {
    id: "aws-9",
    area: "Execution",
    status: "planned",
    priority: "p0_critical",
    description: "Rollback engine: state capture before mutation, automated restoration, rollback verification",
    estimateWeeks: 3,
    dependencies: ["aws-8"],
  },
  {
    id: "aws-10",
    area: "Monitoring",
    status: "planned",
    priority: "p1_high",
    description: "Scheduled scan orchestration: cron-based scans, scan comparison, trend analysis over time",
    estimateWeeks: 2,
    dependencies: [],
  },
  {
    id: "aws-11",
    area: "Monitoring",
    status: "planned",
    priority: "p1_high",
    description: "CloudTrail event-driven monitoring: near-real-time change detection via EventBridge/SNS",
    estimateWeeks: 3,
    dependencies: ["aws-10"],
  },
  {
    id: "aws-12",
    area: "Compliance",
    status: "planned",
    priority: "p1_high",
    description: "AWS Config integration: compliance rule mapping, remediation suggestions, conformance pack support",
    estimateWeeks: 2,
    dependencies: ["aws-7"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. 90-DAY BUILD PHASES
// ═══════════════════════════════════════════════════════════════════════════

export const BUILD_PHASES: BuildPhase[] = [
  {
    id: "phase-1",
    name: "Foundation & AWS Depth",
    timeframe: "Days 1–30",
    objectives: [
      "Complete AWS apply/rollback pipeline for production use",
      "Add RDS/Aurora to snapshot coverage",
      "Implement IAM security analysis",
      "Harden credential management",
      "Achieve production-grade audit trail",
    ],
    subsystems: ["ss-execution", "ss-provider-aws", "ss-credentials", "ss-observability"],
    deliverables: [
      "AWS apply engine handles EC2 resize, S3 lifecycle, RDS right-sizing",
      "Rollback engine with pre-state capture and verified restoration",
      "IAM security scanner finding over-permissioned roles",
      "Credential rotation detection and health monitoring",
      "Complete audit log for every mutation with before/after state",
    ],
    successCriteria: [
      "Zero data loss during any apply operation",
      "100% of mutations have rollback capability",
      "Audit trail passes SOC2-style review",
      "IAM scanner finds >80% of over-permissioned roles in test accounts",
    ],
    risks: [
      "AWS API inconsistencies across services may slow apply engine",
      "Rollback is impossible for some operations (e.g., deleted snapshots)",
    ],
  },
  {
    id: "phase-2",
    name: "Multi-Cloud Foundation & Trust",
    timeframe: "Days 31–60",
    objectives: [
      "Azure adapter: apply + rollback for core resources",
      "GCP adapter: apply + rollback for core resources",
      "Provider abstraction layer hardening",
      "Enterprise trust scoring system",
      "Memory system database persistence",
    ],
    subsystems: ["ss-provider-azure", "ss-provider-gcp", "ss-snapshot", "ss-memory", "ss-data"],
    deliverables: [
      "Azure VM resize and storage tier changes via apply engine",
      "GCP instance resize and storage class changes via apply engine",
      "Unified provider interface with no provider-specific logic in core",
      "Trust score computed per org based on track record",
      "Memory system persisted to PostgreSQL with migration",
    ],
    successCriteria: [
      "Azure and GCP apply engines pass same test suite as AWS",
      "Zero provider-specific code in agent core modules",
      "Memory survives process restart",
      "Trust score correlates with actual safety record",
    ],
    risks: [
      "Azure/GCP API differences may require abstraction layer redesign",
      "Memory schema migration for existing orgs",
    ],
  },
  {
    id: "phase-3",
    name: "Enterprise Readiness & Intelligence",
    timeframe: "Days 61–90",
    objectives: [
      "Scheduled scans with trend analysis",
      "Cross-cloud reasoning (findings spanning multiple providers)",
      "Approval workflow integrations (Slack/email)",
      "Compliance reporting export",
      "Production hardening and load testing",
    ],
    subsystems: ["ss-workflow", "ss-reasoning", "ss-governance", "ss-approval", "ss-observability"],
    deliverables: [
      "Cron-scheduled scans with scan-over-scan comparison",
      "Cross-cloud recommendations when multiple providers connected",
      "Slack bot for approval requests and notifications",
      "PDF/CSV compliance report generation",
      "Load testing results for 100+ accounts",
    ],
    successCriteria: [
      "Scheduled scans run reliably for 30 consecutive days",
      "Cross-cloud insights generated for >80% of multi-cloud orgs",
      "Approval latency reduced >50% with Slack integration",
      "System handles 100 concurrent scans without degradation",
    ],
    risks: [
      "Cross-cloud reasoning quality may be low initially",
      "Slack API rate limits during high-volume approval periods",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. TECHNICAL RISKS
// ═══════════════════════════════════════════════════════════════════════════

export const TECHNICAL_RISKS: TechnicalRisk[] = [
  {
    id: "tr-1",
    category: "security",
    severity: "critical",
    description: "Cloud credential compromise would give attackers production infrastructure access",
    impact: "Complete loss of customer trust, potential data breach, legal liability",
    mitigation: "AES-256-GCM encryption, per-tenant isolation, assume-role with external ID, credential rotation monitoring, no credentials in logs/env vars",
    owner: "security",
    status: "mitigated",
  },
  {
    id: "tr-2",
    category: "operations",
    severity: "critical",
    description: "Apply engine bug could damage production infrastructure",
    impact: "Customer outage, data loss, trust destruction",
    mitigation: "Pre-state capture, canary deployment, blast radius limits, automatic rollback, human approval for all writes, dry-run first",
    owner: "engineering",
    status: "mitigated",
  },
  {
    id: "tr-3",
    category: "architecture",
    severity: "high",
    description: "Provider abstraction may leak; AWS-specific assumptions in core agent logic",
    impact: "Azure/GCP become second-class, code duplication, maintenance burden",
    mitigation: "Strict interface boundary, provider layer tests run against all three, code review checklist for provider leakage",
    owner: "engineering",
    status: "open",
  },
  {
    id: "tr-4",
    category: "scalability",
    severity: "high",
    description: "Large enterprise accounts (10K+ resources) may timeout during snapshot collection",
    impact: "Incomplete scans, wrong recommendations, customer frustration",
    mitigation: "Paginated collection, regional parallelism, incremental snapshots, background processing with progress updates",
    owner: "engineering",
    status: "open",
  },
  {
    id: "tr-5",
    category: "data",
    severity: "high",
    description: "Memory system currently in-memory — all learning lost on restart",
    impact: "Agent appears to forget everything, can't learn from past runs",
    mitigation: "Phase 2 priority: persist to PostgreSQL. Schema designed, needs migration and write-through cache",
    owner: "engineering",
    status: "open",
  },
  {
    id: "tr-6",
    category: "integration",
    severity: "medium",
    description: "Cloud provider API rate limits may throttle large-scale operations",
    impact: "Slow scans, incomplete data, failed operations",
    mitigation: "Exponential backoff, request budgeting, regional parallelism, cached data for non-critical paths",
    owner: "engineering",
    status: "mitigated",
  },
  {
    id: "tr-7",
    category: "security",
    severity: "high",
    description: "Agent autonomy escalation — system could theoretically increase its own permissions",
    impact: "Unauthorized infrastructure changes, compliance violation",
    mitigation: "Autonomy never self-promotes (enforced in cognitiveArchitecture.ts), admin-only mode changes, all mode changes audited",
    owner: "security",
    status: "mitigated",
  },
  {
    id: "tr-8",
    category: "architecture",
    severity: "medium",
    description: "Barrel file (index.ts) at ~750 lines with 20+ modules — risk of export collisions and compile-time issues",
    impact: "Build failures, developer friction, onboarding difficulty",
    mitigation: "Namespace-based exports, aliasing convention, automated collision detection in CI",
    owner: "engineering",
    status: "accepted",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. PRODUCT RISKS
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCT_RISKS: ProductRisk[] = [
  {
    id: "pr-1",
    category: "trust",
    severity: "critical",
    description: "Enterprises won't connect production cloud accounts to a platform they don't deeply trust",
    impact: "Zero enterprise adoption regardless of feature quality",
    mitigation: "Read-only by default, SOC2 certification, transparent audit trail, customer-controlled IAM roles, gradual trust building",
  },
  {
    id: "pr-2",
    category: "trust",
    severity: "critical",
    description: "A single bad apply (production outage caused by agent) destroys trust for the entire platform",
    impact: "Customer churn, negative word-of-mouth, potential legal action",
    mitigation: "Canary-first execution, blast radius limits, mandatory approval, automatic rollback, incident response SLA",
  },
  {
    id: "pr-3",
    category: "adoption",
    severity: "high",
    description: "AWS-only platform limits addressable market — many enterprises are multi-cloud",
    impact: "Lost deals to competitors with broader cloud support",
    mitigation: "Azure/GCP in active development. Read-only multi-cloud in 60 days, apply in 90 days",
  },
  {
    id: "pr-4",
    category: "competition",
    severity: "high",
    description: "Cloud providers building native optimization tools (AWS Trusted Advisor, Azure Advisor, GCP Recommender)",
    impact: "Free built-in tools reduce willingness to pay for third-party",
    mitigation: "Cross-cloud intelligence (no provider offers this), autonomous execution (advisors only advise), organizational memory (no provider remembers)",
  },
  {
    id: "pr-5",
    category: "ux",
    severity: "high",
    description: "Alert fatigue from too many low-value findings degrades trust in agent intelligence",
    impact: "Users ignore agent, stop checking recommendations, churn",
    mitigation: "Noise analysis in reflection engine, suppression rules, adaptive behavior learning, priority scoring with org context",
  },
  {
    id: "pr-6",
    category: "compliance",
    severity: "medium",
    description: "EU AI Act may classify autonomous infrastructure agents as high-risk AI systems",
    impact: "Regulatory compliance burden, potential market restrictions",
    mitigation: "Explainability engine built from day 1, full audit trail, human oversight at every level, transparency reports",
  },
  {
    id: "pr-7",
    category: "pricing",
    severity: "medium",
    description: "Customers may not pay enough to justify compute costs for continuous agent operation",
    impact: "Unprofitable at scale",
    mitigation: "Batch-first (cheap), event-driven (medium), continuous (premium tier only). Savings-based pricing: charge % of savings delivered.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. DEFENSIBILITY FACTORS
// ═══════════════════════════════════════════════════════════════════════════

export const DEFENSIBILITY: DefensibilityFactor[] = [
  {
    factor: "Organizational Memory",
    description: "Agent accumulates org-specific knowledge: incident patterns, approval preferences, risk tolerance, seasonal patterns. This memory is unique per customer and cannot be replicated by a competitor.",
    moatStrength: "strong",
    timeToReplicate: "12-24 months of customer usage data",
  },
  {
    factor: "Cross-Cloud Intelligence",
    description: "No cloud provider has incentive to optimize across clouds. AWS won't suggest moving workloads to GCP. Axiom is provider-neutral by design.",
    moatStrength: "strong",
    timeToReplicate: "6-12 months (architecture + provider integrations)",
  },
  {
    factor: "Autonomous Execution with Trust",
    description: "Competitors either advise (no execution) or execute (no trust model). Axiom's graduated autonomy ladder with earned trust is architecturally unique.",
    moatStrength: "strong",
    timeToReplicate: "18+ months (trust model + safety track record)",
  },
  {
    factor: "Explainable AI for Infrastructure",
    description: "Every recommendation has grounded evidence, confidence scoring, assumption transparency, and risk disclosure. Most competitors are black boxes.",
    moatStrength: "moderate",
    timeToReplicate: "6-9 months (architecture), but trust takes longer",
  },
  {
    factor: "Reflection & Self-Improvement",
    description: "Agent measures its own decision quality, identifies noise, and adapts within governance bounds. This creates a flywheel: more usage → better agent.",
    moatStrength: "moderate",
    timeToReplicate: "12+ months (requires production usage data)",
  },
  {
    factor: "Enterprise Safety Architecture",
    description: "RBAC, governance policies, approval chains, blast radius limits, rollback-first execution. This is enterprise table stakes but takes years to build correctly.",
    moatStrength: "moderate",
    timeToReplicate: "12-18 months",
  },
  {
    factor: "TypeScript-Native Agent Architecture",
    description: "Full agent intelligence in TypeScript means it runs anywhere Next.js runs — serverless, edge, embedded. No Python/Java dependency chain.",
    moatStrength: "weak",
    timeToReplicate: "3-6 months (technology choice, not deep moat)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 9. MVP REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════

export const MVP_REQUIREMENTS: MVPRequirement[] = [
  {
    id: "mvp-1",
    category: "functionality",
    requirement: "Scan AWS account and produce actionable findings with evidence",
    rationale: "Core value proposition — without accurate findings, nothing else matters",
    status: "production",
    blockedBy: [],
  },
  {
    id: "mvp-2",
    category: "functionality",
    requirement: "Generate Terraform/CLI code for every recommendation",
    rationale: "Users need a clear path from insight to action, even before auto-apply",
    status: "production",
    blockedBy: [],
  },
  {
    id: "mvp-3",
    category: "functionality",
    requirement: "Apply approved changes with pre-check, execution, and verification",
    rationale: "This is the transition from advisor to operator — the key differentiator",
    status: "partial",
    blockedBy: ["aws-8", "aws-9"],
  },
  {
    id: "mvp-4",
    category: "security",
    requirement: "Read-only onboarding with clear permission escalation path",
    rationale: "Enterprises will not connect production accounts if the first step requires write access",
    status: "production",
    blockedBy: [],
  },
  {
    id: "mvp-5",
    category: "security",
    requirement: "Complete audit trail: who did what, when, with what result",
    rationale: "Non-negotiable for enterprise compliance. Without this, no SOC2, no enterprise deal.",
    status: "implemented",
    blockedBy: [],
  },
  {
    id: "mvp-6",
    category: "trust",
    requirement: "Explainable recommendations: every suggestion has evidence and confidence score",
    rationale: "Trust requires understanding. Black-box recommendations will be ignored.",
    status: "implemented",
    blockedBy: [],
  },
  {
    id: "mvp-7",
    category: "trust",
    requirement: "Rollback capability for every write operation",
    rationale: "The safety net that makes enterprises willing to try auto-apply",
    status: "partial",
    blockedBy: ["aws-9"],
  },
  {
    id: "mvp-8",
    category: "trust",
    requirement: "Human approval required for all write operations (no silent auto-apply at MVP)",
    rationale: "Trust is earned over time. MVP must be conservative.",
    status: "production",
    blockedBy: [],
  },
  {
    id: "mvp-9",
    category: "ux",
    requirement: "Dashboard showing findings, recommendations, approval queue, and execution history",
    rationale: "Users need a single pane of glass to understand and control the agent",
    status: "production",
    blockedBy: [],
  },
  {
    id: "mvp-10",
    category: "ux",
    requirement: "Onboarding flow that connects cloud account in <5 minutes",
    rationale: "Time-to-value is critical. Complex onboarding kills adoption.",
    status: "production",
    blockedBy: [],
  },
  {
    id: "mvp-11",
    category: "operations",
    requirement: "Scheduled scans with email/Slack notifications",
    rationale: "Agent must work autonomously in the background to deliver continuous value",
    status: "partial",
    blockedBy: ["aws-10"],
  },
  {
    id: "mvp-12",
    category: "security",
    requirement: "Encrypted credential storage with no credentials in logs or environment variables",
    rationale: "Fundamental security hygiene. A credential leak is an extinction-level event.",
    status: "production",
    blockedBy: [],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 10. WHAT TO DEFER
// ═══════════════════════════════════════════════════════════════════════════

export type DeferredItem = {
  item: string;
  reason: string;
  deferUntil: string;
  riskOfDeferring: "low" | "medium" | "high";
};

export const DEFERRED_ITEMS: DeferredItem[] = [
  {
    item: "Multi-agent coordination",
    reason: "Unsolved research problem. Single-agent does everything we need for 2+ years.",
    deferUntil: "2029+",
    riskOfDeferring: "low",
  },
  {
    item: "Predictive infrastructure orchestration",
    reason: "Requires business signal integration and years of historical data we don't have yet.",
    deferUntil: "2029+",
    riskOfDeferring: "low",
  },
  {
    item: "Self-healing workflows",
    reason: "Requires extensive runbook catalog and rehearsal infrastructure. Trust not yet earned.",
    deferUntil: "2028+",
    riskOfDeferring: "low",
  },
  {
    item: "Custom governance rule DSL",
    reason: "10 built-in rule types cover 80% of needs. Custom DSL is enterprise feature.",
    deferUntil: "2027 Q3",
    riskOfDeferring: "medium",
  },
  {
    item: "ML-based anomaly detection",
    reason: "Deterministic rules work well for known patterns. ML requires training data we're still accumulating.",
    deferUntil: "2028",
    riskOfDeferring: "low",
  },
  {
    item: "SSO/SAML integration",
    reason: "Important for enterprise, but not blocking initial adoption. NextAuth handles OAuth.",
    deferUntil: "2027 Q1",
    riskOfDeferring: "medium",
  },
  {
    item: "Kubernetes-native monitoring",
    reason: "ECS/EKS snapshot is higher priority. K8s-native monitoring is a separate product surface.",
    deferUntil: "2027 Q2",
    riskOfDeferring: "medium",
  },
  {
    item: "Hardware Security Module (HSM) support",
    reason: "AES-256-GCM with software keys is sufficient for current scale. HSM is regulated-industry requirement.",
    deferUntil: "2027 Q4",
    riskOfDeferring: "low",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 11. WHAT MAKES ENTERPRISES TRUST THIS PLATFORM
// ═══════════════════════════════════════════════════════════════════════════

export type TrustFactor = {
  factor: string;
  importance: "essential" | "important" | "nice_to_have";
  status: SubsystemStatus;
  description: string;
};

export const ENTERPRISE_TRUST_FACTORS: TrustFactor[] = [
  {
    factor: "Read-only by default",
    importance: "essential",
    status: "production",
    description: "First connection is always read-only. Write permissions are a separate, deliberate escalation.",
  },
  {
    factor: "Customer-controlled IAM roles",
    importance: "essential",
    status: "production",
    description: "Customer creates the IAM role with exact permissions they choose. We never ask for admin access.",
  },
  {
    factor: "Complete audit trail",
    importance: "essential",
    status: "implemented",
    description: "Every action the agent takes is logged with who triggered it, what changed, before/after state, and why.",
  },
  {
    factor: "Human approval for all writes",
    importance: "essential",
    status: "production",
    description: "No write operation executes without explicit human approval through a typed workflow.",
  },
  {
    factor: "Rollback on any failure",
    importance: "essential",
    status: "partial",
    description: "Pre-state captured before every mutation. Any failure triggers automatic rollback.",
  },
  {
    factor: "Encrypted credentials",
    importance: "essential",
    status: "production",
    description: "AES-256-GCM encrypted, per-tenant isolated, never in logs or environment variables.",
  },
  {
    factor: "Explainable recommendations",
    importance: "essential",
    status: "implemented",
    description: "Every recommendation includes evidence, confidence, assumptions, and risks. No black boxes.",
  },
  {
    factor: "Blast radius limits",
    importance: "important",
    status: "implemented",
    description: "No operation can affect more than 50 resources in a single step. Canary validation required.",
  },
  {
    factor: "Governance policy support",
    importance: "important",
    status: "implemented",
    description: "10 policy rule types covering cost, security, resilience, compliance. 4 enforcement levels.",
  },
  {
    factor: "SOC2 Type II certification",
    importance: "important",
    status: "planned",
    description: "Industry-standard security certification. Architecture supports it; certification process pending.",
  },
  {
    factor: "Tenant data isolation",
    importance: "essential",
    status: "production",
    description: "Every database query scoped by orgId. No cross-tenant data access. Tested with isolation checks.",
  },
  {
    factor: "No silent autonomy escalation",
    importance: "essential",
    status: "implemented",
    description: "Agent cannot increase its own autonomy level. Only human admins can promote. All changes logged.",
  },
  {
    factor: "Drift detection",
    importance: "important",
    status: "implemented",
    description: "Detects when infrastructure drifts from approved state. Alerts on unauthorized changes.",
  },
  {
    factor: "Incident response SLA",
    importance: "important",
    status: "planned",
    description: "Defined response times for agent-caused incidents. Transparent escalation and post-mortem.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 12. QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getSubsystemsByLayer(layer: SystemLayer): Subsystem[] {
  return SUBSYSTEMS.filter((s) => s.layer === layer);
}

export function getSubsystemsByStatus(status: SubsystemStatus): Subsystem[] {
  return SUBSYSTEMS.filter((s) => s.status === status);
}

export function getSubsystemById(id: string): Subsystem | undefined {
  return SUBSYSTEMS.find((s) => s.id === id);
}

export function getCriticalSubsystems(): Subsystem[] {
  return SUBSYSTEMS.filter((s) => s.priority === "p0_critical");
}

export function getSubsystemGaps(): Array<{ subsystem: string; missing: string[] }> {
  return SUBSYSTEMS
    .filter((s) => s.missingCapabilities.length > 0)
    .map((s) => ({ subsystem: s.name, missing: s.missingCapabilities }));
}

export function getArchitectureCompleteness(): {
  total: number;
  production: number;
  implemented: number;
  partial: number;
  planned: number;
  percentOperational: number;
} {
  const total = SUBSYSTEMS.length;
  const production = SUBSYSTEMS.filter((s) => s.status === "production").length;
  const implemented = SUBSYSTEMS.filter((s) => s.status === "implemented").length;
  const partial = SUBSYSTEMS.filter((s) => s.status === "partial").length;
  const planned = SUBSYSTEMS.filter((s) => s.status === "planned").length;
  return {
    total,
    production,
    implemented,
    partial,
    planned,
    percentOperational: Math.round(((production + implemented) / total) * 100),
  };
}

export function getAWSCompletionProgress(): {
  total: number;
  completed: number;
  inProgress: number;
  planned: number;
  totalWeeks: number;
} {
  const items = AWS_COMPLETION_ROADMAP;
  return {
    total: items.length,
    completed: items.filter((i) => i.status === "production").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    planned: items.filter((i) => i.status === "planned").length,
    totalWeeks: items.reduce((sum, i) => sum + i.estimateWeeks, 0),
  };
}

export function getMVPReadiness(): {
  total: number;
  ready: number;
  partial: number;
  missing: number;
  percentReady: number;
  blockers: string[];
} {
  const total = MVP_REQUIREMENTS.length;
  const ready = MVP_REQUIREMENTS.filter((r) => r.status === "production" || r.status === "implemented").length;
  const partial = MVP_REQUIREMENTS.filter((r) => r.status === "partial").length;
  const missing = MVP_REQUIREMENTS.filter((r) => r.status === "planned" || r.status === "scaffolded").length;
  const blockers = MVP_REQUIREMENTS
    .filter((r) => r.status !== "production" && r.status !== "implemented")
    .flatMap((r) => r.blockedBy);
  return {
    total,
    ready,
    partial,
    missing,
    percentReady: Math.round((ready / total) * 100),
    blockers: [...new Set(blockers)],
  };
}

export function getOpenRisks(): TechnicalRisk[] {
  return TECHNICAL_RISKS.filter((r) => r.status === "open");
}

export function getCriticalRisks(): Array<TechnicalRisk | ProductRisk> {
  const tech = TECHNICAL_RISKS.filter((r) => r.severity === "critical");
  const prod = PRODUCT_RISKS.filter((r) => r.severity === "critical");
  return [...tech, ...prod];
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type ArchitectureTestResult = { name: string; passed: boolean; detail: string };

export function runArchitectureTests(): ArchitectureTestResult[] {
  const results: ArchitectureTestResult[] = [];

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: All subsystem IDs are unique
  const ids = SUBSYSTEMS.map((s) => s.id);
  assert("unique subsystem IDs", () => new Set(ids).size === ids.length, `total=${ids.length}`);

  // Test 2: All dependencies reference valid subsystems
  const validIds = new Set(ids);
  const badDeps = SUBSYSTEMS.flatMap((s) => s.dependsOn.filter((d) => !validIds.has(d)));
  assert("valid dependencies", () => badDeps.length === 0, `bad: ${badDeps.join(", ") || "none"}`);

  // Test 3: Every layer has at least one subsystem
  const layers: SystemLayer[] = ["presentation", "api", "orchestration", "intelligence", "execution", "provider", "security", "data", "observability"];
  for (const layer of layers) {
    const count = getSubsystemsByLayer(layer).length;
    assert(`layer ${layer} populated`, () => count > 0, `count=${count}`);
  }

  // Test 4: Critical subsystems have test coverage
  const criticalUntested = getCriticalSubsystems().filter((s) => s.testCoverage === "none");
  assert("critical subsystems tested", () => criticalUntested.length === 0,
    `untested critical: ${criticalUntested.map((s) => s.name).join(", ") || "none"}`);

  // Test 5: All build phases have subsystems
  for (const phase of BUILD_PHASES) {
    assert(`phase ${phase.id} has subsystems`, () => phase.subsystems.length > 0,
      `subsystems=${phase.subsystems.length}`);
  }

  // Test 6: MVP requirements exist
  assert("MVP requirements defined", () => MVP_REQUIREMENTS.length >= 10,
    `count=${MVP_REQUIREMENTS.length}`);

  // Test 7: Architecture completeness computes
  const completeness = getArchitectureCompleteness();
  assert("completeness computes", () => completeness.total > 0 && completeness.percentOperational >= 0,
    `total=${completeness.total}, operational=${completeness.percentOperational}%`);

  // Test 8: Trust factors include all essentials
  const essentials = ENTERPRISE_TRUST_FACTORS.filter((t) => t.importance === "essential");
  assert("essential trust factors defined", () => essentials.length >= 5,
    `count=${essentials.length}`);

  // Test 9: Technical risks all have mitigations
  const unmitigated = TECHNICAL_RISKS.filter((r) => !r.mitigation);
  assert("all risks have mitigations", () => unmitigated.length === 0,
    `unmitigated=${unmitigated.length}`);

  // Test 10: Defensibility factors defined
  assert("defensibility factors exist", () => DEFENSIBILITY.length >= 5,
    `count=${DEFENSIBILITY.length}`);

  // Test 11: AWS roadmap items have estimates
  const noEstimate = AWS_COMPLETION_ROADMAP.filter((i) => i.estimateWeeks <= 0);
  assert("AWS items estimated", () => noEstimate.length === 0,
    `missing estimates=${noEstimate.length}`);

  // Test 12: Deferred items have reasoning
  const noReason = DEFERRED_ITEMS.filter((i) => !i.reason);
  assert("deferred items have reasons", () => noReason.length === 0,
    `no reason=${noReason.length}`);

  // Test 13: Security properties on critical subsystems
  const criticalNoSecurity = getCriticalSubsystems().filter((s) => s.securityProperties.length === 0);
  assert("critical subsystems have security properties", () => criticalNoSecurity.length === 0,
    `missing security: ${criticalNoSecurity.map((s) => s.name).join(", ") || "none"}`);

  // Test 14: No circular subsystem dependencies
  function hasSubsystemCycle(): boolean {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    function dfs(id: string): boolean {
      if (inStack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      inStack.add(id);
      const s = getSubsystemById(id);
      for (const dep of s?.dependsOn ?? []) {
        if (dfs(dep)) return true;
      }
      inStack.delete(id);
      return false;
    }
    return SUBSYSTEMS.some((s) => dfs(s.id));
  }
  assert("no subsystem dependency cycles", () => !hasSubsystemCycle(), "acyclic");

  // Test 15: Product risks cover key categories
  const riskCategories = new Set(PRODUCT_RISKS.map((r) => r.category));
  assert("product risks cover trust", () => riskCategories.has("trust"), `categories: ${[...riskCategories].join(", ")}`);

  return results;
}
