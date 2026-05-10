/**
 * Axiom Agent — Enterprise Trust Model & Security Architecture
 *
 * This module defines how Axiom earns, maintains, and measures enterprise trust.
 * Trust is not a feature — it's the foundation that determines whether any
 * enterprise will connect their production cloud environment to the platform.
 *
 * Trust model philosophy:
 *   1. Trust is earned incrementally, never assumed
 *   2. Every action is explainable, auditable, and reversible
 *   3. The system cannot escalate its own privileges
 *   4. Security failures are extinction-level events — treat them accordingly
 *   5. Transparency is the default. Secrets are the exception (credentials only).
 *
 * This module is executable typed data, not just documentation.
 * It can be rendered in the product, queried by the agent, and validated by tests.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. TRUST MODEL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type TrustLevel =
  | "unverified"        // account connected, no scans yet
  | "observing"         // read-only scans running, building baseline
  | "advising"          // agent produces recommendations, human decides
  | "assisting"         // agent executes approved actions with human oversight
  | "operating"         // agent executes pre-approved action classes autonomously
  | "trusted";          // agent operates with full pre-approved scope (never self-granted)

export type TrustDimension =
  | "execution_safety"    // has the agent ever caused harm?
  | "recommendation_quality" // are recommendations accurate and actionable?
  | "rollback_reliability"   // do rollbacks always succeed?
  | "audit_completeness"     // is the audit trail complete and tamper-evident?
  | "credential_hygiene"     // are credentials handled safely?
  | "noise_control"          // does the agent avoid alert fatigue?
  | "response_time"          // does the agent respond quickly to issues?
  | "transparency"           // does the agent explain its reasoning?;

export type TrustScore = {
  overall: number;            // 0-100
  dimensions: Record<TrustDimension, number>;
  level: TrustLevel;
  history: TrustEvent[];
  lastEvaluated: string;      // ISO date
  promotionEligible: boolean;
  promotionBlockers: string[];
};

export type TrustEvent = {
  timestamp: string;
  type: "promotion" | "demotion" | "incident" | "milestone" | "review";
  fromLevel?: TrustLevel;
  toLevel?: TrustLevel;
  reason: string;
  actor: "admin" | "system" | "automated_review";
};

export type TrustRequirement = {
  fromLevel: TrustLevel;
  toLevel: TrustLevel;
  requirements: PromotionRequirement[];
  minimumDuration: string;       // e.g., "30 days at previous level"
  humanApprovalRequired: boolean;
  autoPromotionAllowed: boolean;  // always false — trust is granted, not taken
};

export type PromotionRequirement = {
  dimension: TrustDimension;
  minimumScore: number;
  measurement: string;
  evidenceRequired: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. SECURITY ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════

export type SecurityLayer = {
  name: string;
  depth: number;                  // 1 = outermost, higher = deeper
  controls: SecurityControl[];
  threats: string[];
  trustBoundary: string;
};

export type SecurityControl = {
  id: string;
  name: string;
  type: "preventive" | "detective" | "corrective" | "compensating";
  description: string;
  implementation: string;
  status: "active" | "planned" | "testing";
  automationLevel: "fully_automated" | "semi_automated" | "manual";
};

export type ThreatModel = {
  id: string;
  category: "credential_theft" | "privilege_escalation" | "data_exfiltration" | "service_disruption"
    | "supply_chain" | "insider_threat" | "agent_misuse" | "cross_tenant";
  description: string;
  likelihood: "high" | "medium" | "low";
  impact: "critical" | "high" | "medium" | "low";
  mitigations: string[];
  residualRisk: string;
  monitoringSignals: string[];
};

export type ComplianceFramework = {
  name: string;
  description: string;
  status: "certified" | "in_progress" | "planned" | "not_applicable";
  requirements: ComplianceRequirement[];
  estimatedCertification: string;  // "2027 Q1" or "N/A"
};

export type ComplianceRequirement = {
  control: string;
  description: string;
  axiomImplementation: string;
  status: "met" | "partial" | "planned";
};

export type CredentialPolicy = {
  name: string;
  description: string;
  enforcement: "mandatory" | "recommended" | "optional";
  implementation: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. TRUST LADDER — HOW TRUST IS EARNED
// ═══════════════════════════════════════════════════════════════════════════

export const TRUST_LADDER: TrustRequirement[] = [
  {
    fromLevel: "unverified",
    toLevel: "observing",
    requirements: [
      {
        dimension: "credential_hygiene",
        minimumScore: 80,
        measurement: "Credentials encrypted, validated, and scoped correctly",
        evidenceRequired: "Successful connection validation with read-only permissions",
      },
    ],
    minimumDuration: "immediate upon successful connection",
    humanApprovalRequired: false,
    autoPromotionAllowed: false,
  },
  {
    fromLevel: "observing",
    toLevel: "advising",
    requirements: [
      {
        dimension: "recommendation_quality",
        minimumScore: 70,
        measurement: "3+ completed scans with >70% actionable findings",
        evidenceRequired: "Scan completion records, finding accuracy assessment",
      },
      {
        dimension: "noise_control",
        minimumScore: 60,
        measurement: "<30% of findings suppressed by user",
        evidenceRequired: "Suppression rate from adaptive behavior signals",
      },
    ],
    minimumDuration: "7 days at observing level",
    humanApprovalRequired: false,
    autoPromotionAllowed: false,
  },
  {
    fromLevel: "advising",
    toLevel: "assisting",
    requirements: [
      {
        dimension: "recommendation_quality",
        minimumScore: 80,
        measurement: ">80% approval rate on recommendations",
        evidenceRequired: "Approval/rejection records from RBAC engine",
      },
      {
        dimension: "execution_safety",
        minimumScore: 90,
        measurement: "0 incidents in observation period",
        evidenceRequired: "Incident log empty for this org",
      },
      {
        dimension: "audit_completeness",
        minimumScore: 90,
        measurement: "100% of actions have audit trail",
        evidenceRequired: "Audit log completeness check",
      },
      {
        dimension: "rollback_reliability",
        minimumScore: 95,
        measurement: "All dry-runs executed successfully",
        evidenceRequired: "Dry-run execution records",
      },
    ],
    minimumDuration: "30 days at advising level",
    humanApprovalRequired: true,
    autoPromotionAllowed: false,
  },
  {
    fromLevel: "assisting",
    toLevel: "operating",
    requirements: [
      {
        dimension: "execution_safety",
        minimumScore: 95,
        measurement: "20+ successful apply operations with 0 rollbacks due to agent error",
        evidenceRequired: "Execution history with success/failure analysis",
      },
      {
        dimension: "rollback_reliability",
        minimumScore: 99,
        measurement: "100% of triggered rollbacks succeeded",
        evidenceRequired: "Rollback execution records",
      },
      {
        dimension: "transparency",
        minimumScore: 85,
        measurement: "All actions have explainable rationale and evidence",
        evidenceRequired: "Explainability engine coverage report",
      },
      {
        dimension: "recommendation_quality",
        minimumScore: 85,
        measurement: ">85% approval rate, <5% rejection rate",
        evidenceRequired: "6-month approval/rejection trend",
      },
    ],
    minimumDuration: "90 days at assisting level",
    humanApprovalRequired: true,
    autoPromotionAllowed: false,
  },
  {
    fromLevel: "operating",
    toLevel: "trusted",
    requirements: [
      {
        dimension: "execution_safety",
        minimumScore: 99,
        measurement: "100+ successful autonomous operations with 0 incidents",
        evidenceRequired: "12-month execution history with zero safety incidents",
      },
      {
        dimension: "recommendation_quality",
        minimumScore: 90,
        measurement: ">90% approval rate across all action types",
        evidenceRequired: "12-month recommendation quality trend",
      },
      {
        dimension: "rollback_reliability",
        minimumScore: 99,
        measurement: "100% rollback success rate across all scenarios tested",
        evidenceRequired: "Complete rollback test results",
      },
      {
        dimension: "audit_completeness",
        minimumScore: 99,
        measurement: "100% audit coverage with tamper-evident logging",
        evidenceRequired: "Audit integrity verification report",
      },
      {
        dimension: "credential_hygiene",
        minimumScore: 95,
        measurement: "No credential exposure incidents, rotation compliance 100%",
        evidenceRequired: "Credential health monitoring history",
      },
      {
        dimension: "noise_control",
        minimumScore: 85,
        measurement: "<10% suppression rate, trending down",
        evidenceRequired: "Noise analysis trend from reflection engine",
      },
    ],
    minimumDuration: "180 days at operating level",
    humanApprovalRequired: true,
    autoPromotionAllowed: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. DEFENSE-IN-DEPTH SECURITY LAYERS
// ═══════════════════════════════════════════════════════════════════════════

export const SECURITY_LAYERS: SecurityLayer[] = [
  {
    name: "Network & Edge",
    depth: 1,
    trustBoundary: "Public internet to application boundary",
    threats: ["DDoS", "bot attacks", "credential stuffing", "API abuse"],
    controls: [
      {
        id: "sc-1",
        name: "TLS Everywhere",
        type: "preventive",
        description: "All connections encrypted with TLS 1.3. No plaintext HTTP.",
        implementation: "Vercel edge network + HSTS headers",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-2",
        name: "Rate Limiting",
        type: "preventive",
        description: "API rate limits per org, per endpoint. Prevents abuse and cost-based DoS.",
        implementation: "Vercel edge middleware + Redis sliding window",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-3",
        name: "Input Validation",
        type: "preventive",
        description: "All API inputs validated against typed schemas before processing.",
        implementation: "Zod schema validation on every tRPC/API route",
        status: "active",
        automationLevel: "fully_automated",
      },
    ],
  },
  {
    name: "Authentication & Identity",
    depth: 2,
    trustBoundary: "Unauthenticated to authenticated user",
    threats: ["credential theft", "session hijacking", "OAuth token theft", "phishing"],
    controls: [
      {
        id: "sc-4",
        name: "NextAuth Session Management",
        type: "preventive",
        description: "JWT-based sessions with secure httpOnly cookies. Session rotation on privilege changes.",
        implementation: "NextAuth v5 with database session strategy",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-5",
        name: "OAuth Provider Auth",
        type: "preventive",
        description: "Users authenticate via Google/GitHub OAuth. No password storage.",
        implementation: "NextAuth OAuth providers, no custom password flow",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-6",
        name: "Session Timeout & Rotation",
        type: "preventive",
        description: "Sessions expire after inactivity. Tokens rotated on sensitive operations.",
        implementation: "Configurable session TTL, rotation on role change",
        status: "active",
        automationLevel: "fully_automated",
      },
    ],
  },
  {
    name: "Authorization & Access Control",
    depth: 3,
    trustBoundary: "Authenticated user to authorized actions",
    threats: ["privilege escalation", "horizontal access (cross-org)", "unauthorized actions"],
    controls: [
      {
        id: "sc-7",
        name: "RBAC Engine",
        type: "preventive",
        description: "Role-based access control with 4-level hierarchy (viewer → operator → admin → owner). Provider-scoped permissions.",
        implementation: "rbacEngine.ts with Prisma-backed memberships",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-8",
        name: "Org Isolation",
        type: "preventive",
        description: "Every database query includes orgId filter. No cross-tenant data access possible through the API.",
        implementation: "Prisma query middleware enforcing orgId on all models",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-9",
        name: "Approval Chains",
        type: "preventive",
        description: "Write operations require approval from authorized users. Multi-approver support with quorum.",
        implementation: "rbacEngine.ts approval chain system",
        status: "active",
        automationLevel: "semi_automated",
      },
    ],
  },
  {
    name: "Agent Action Control",
    depth: 4,
    trustBoundary: "Approved actions to cloud infrastructure",
    threats: ["agent misuse", "autonomy escalation", "blast radius exceedance", "unintended mutations"],
    controls: [
      {
        id: "sc-10",
        name: "Autopilot Mode Enforcement",
        type: "preventive",
        description: "4 autonomy modes with increasing capability. Mode can only be changed by admin. Agent cannot self-promote.",
        implementation: "autopilot.ts with mode change audit logging",
        status: "active",
        automationLevel: "semi_automated",
      },
      {
        id: "sc-11",
        name: "Blast Radius Limits",
        type: "preventive",
        description: "No operation can affect more than 50 resources in a single step. Canary validation required for multi-step operations.",
        implementation: "operationOrchestrator.ts blast radius enforcement",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-12",
        name: "Pre-State Capture",
        type: "corrective",
        description: "Before any mutation, the current state of the resource is captured for rollback.",
        implementation: "runAgent.ts apply handler with state serialization",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-13",
        name: "Automatic Rollback",
        type: "corrective",
        description: "Any execution failure triggers automatic rollback to pre-state. Rollback failure triggers human escalation.",
        implementation: "runAgent.ts rollback handler + escalation",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-14",
        name: "Dry-Run First",
        type: "detective",
        description: "Every apply operation runs in dry-run mode first. Actual execution only if dry-run succeeds.",
        implementation: "runAgent.ts dry-run simulation",
        status: "active",
        automationLevel: "fully_automated",
      },
    ],
  },
  {
    name: "Credential Protection",
    depth: 5,
    trustBoundary: "Platform to cloud provider APIs",
    threats: ["credential theft", "credential exposure in logs", "credential leakage to users"],
    controls: [
      {
        id: "sc-15",
        name: "AES-256-GCM Encryption",
        type: "preventive",
        description: "All cloud credentials encrypted at rest with AES-256-GCM. 12-byte random IV, 16-byte auth tag per record.",
        implementation: "security/credentialVault.ts",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-16",
        name: "No Credentials in Environment",
        type: "preventive",
        description: "User cloud credentials never stored in process.env. Retrieved from encrypted vault per-request.",
        implementation: "plugins/credentials.ts vault lookup pattern",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-17",
        name: "Secret Redaction",
        type: "detective",
        description: "All log entries, API responses, and error messages scanned for credential patterns and redacted before output.",
        implementation: "security/secretRedaction.ts pattern matching",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-18",
        name: "Assume-Role Pattern",
        type: "preventive",
        description: "AWS uses cross-account assume-role with external ID. Customer creates the role with exact permissions they choose.",
        implementation: "plugins/credentials.ts AWS assume-role broker",
        status: "active",
        automationLevel: "semi_automated",
      },
    ],
  },
  {
    name: "Audit & Observability",
    depth: 6,
    trustBoundary: "All system activity to audit record",
    threats: ["tampered audit trail", "missing audit entries", "undetected anomalies"],
    controls: [
      {
        id: "sc-19",
        name: "Immutable Audit Trail",
        type: "detective",
        description: "Every agent action recorded with before/after state, actor, timestamp, correlation ID. Append-only.",
        implementation: "observability.ts + AxiomAuditEvent model",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-20",
        name: "Correlation IDs",
        type: "detective",
        description: "Every operation chain gets a unique correlation ID. Traces every action from trigger to completion.",
        implementation: "observability.ts generateCorrelationId()",
        status: "active",
        automationLevel: "fully_automated",
      },
      {
        id: "sc-21",
        name: "Structured Logging",
        type: "detective",
        description: "All logs are structured JSON with severity, category, correlation ID, and timestamp. Queryable.",
        implementation: "observability.ts structured log system",
        status: "active",
        automationLevel: "fully_automated",
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. THREAT MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const THREAT_MODEL: ThreatModel[] = [
  {
    id: "tm-1",
    category: "credential_theft",
    description: "Attacker gains access to encrypted credential vault and attempts to decrypt customer cloud credentials",
    likelihood: "medium",
    impact: "critical",
    mitigations: [
      "AES-256-GCM encryption with per-record random IV",
      "Encryption key stored in environment, not in database",
      "32-character minimum key length enforced",
      "Credential access logged and monitored",
      "Customer-controlled IAM roles limit blast radius even if credentials compromised",
    ],
    residualRisk: "If encryption key is compromised, all credentials are exposed. Key rotation capability planned.",
    monitoringSignals: ["Unusual credential access patterns", "Failed decryption attempts", "Credential validation failures"],
  },
  {
    id: "tm-2",
    category: "privilege_escalation",
    description: "Agent autonomy level escalated without admin approval, enabling unauthorized write operations",
    likelihood: "low",
    impact: "critical",
    mitigations: [
      "Autonomy level changes require admin role (enforced in autopilot.ts)",
      "Agent cannot call its own mode-change API (no self-referential execution path)",
      "All mode changes logged with actor identification",
      "Cognitive architecture explicitly blocks self-promotion",
    ],
    residualRisk: "A bug in RBAC enforcement could allow non-admin to change mode. Covered by RBAC unit tests.",
    monitoringSignals: ["Autopilot mode change events", "Non-admin attempting mode changes", "Rapid mode oscillation"],
  },
  {
    id: "tm-3",
    category: "cross_tenant",
    description: "Org A's data or credentials accessible by org B through API manipulation or query injection",
    likelihood: "low",
    impact: "critical",
    mitigations: [
      "orgId required on every database query via Prisma middleware",
      "API routes extract orgId from authenticated session, not from request body",
      "Credential vault returns null for wrong orgId",
      "No cross-org data aggregation endpoints exist",
    ],
    residualRisk: "A new API endpoint forgetting to include orgId filter. Covered by code review checklist.",
    monitoringSignals: ["Queries without orgId filter (static analysis)", "Unusual data access patterns"],
  },
  {
    id: "tm-4",
    category: "agent_misuse",
    description: "Agent generates recommendations that benefit the platform (e.g., over-provisioning) rather than the customer",
    likelihood: "low",
    impact: "high",
    mitigations: [
      "Agent has no financial incentive model — recommendations are purely analytical",
      "Explainability engine requires evidence for every recommendation",
      "Reflection engine tracks approval rates — consistently rejected recommendations trigger review",
      "Open recommendation logic (deterministic, not LLM-based for now)",
    ],
    residualRisk: "Subtle biases in scoring weights could favor certain outcomes. Reflection engine monitors for this.",
    monitoringSignals: ["Low approval rates per recommendation type", "Consistently rejected action categories"],
  },
  {
    id: "tm-5",
    category: "service_disruption",
    description: "Agent apply operation causes production outage in customer infrastructure",
    likelihood: "medium",
    impact: "critical",
    mitigations: [
      "Human approval required for all write operations",
      "Dry-run execution before real apply",
      "Blast radius limit: max 50 resources per step",
      "Canary validation: smallest scope first, verify before expanding",
      "Pre-state capture for rollback",
      "Automatic rollback on any failure",
      "Incident notification pipeline",
    ],
    residualRisk: "Some operations are not fully reversible (e.g., data deletion). These require elevated approval.",
    monitoringSignals: ["Apply failure rate", "Rollback trigger rate", "Verification failure rate", "Customer-reported incidents"],
  },
  {
    id: "tm-6",
    category: "data_exfiltration",
    description: "Cloud snapshot data (resource configs, costs, IAM policies) exfiltrated from the platform",
    likelihood: "low",
    impact: "high",
    mitigations: [
      "Snapshot data stored in org-scoped database rows",
      "No bulk export API for snapshot data",
      "API responses include only data relevant to the requesting user's role",
      "TLS encryption in transit",
      "Database encryption at rest (managed by hosting provider)",
    ],
    residualRisk: "Database compromise would expose snapshot data. Mitigation: database encryption + backup security.",
    monitoringSignals: ["Unusual data volume in API responses", "Bulk read patterns", "Export API usage spikes"],
  },
  {
    id: "tm-7",
    category: "insider_threat",
    description: "Platform employee accesses customer cloud credentials or infrastructure data",
    likelihood: "low",
    impact: "critical",
    mitigations: [
      "Credential vault encryption key access limited to production secrets",
      "No admin UI for viewing decrypted credentials",
      "Audit trail on all credential access (even internal)",
      "SOC2 access control policies (planned)",
    ],
    residualRisk: "Engineers with production access could theoretically access encryption keys. HSM planned for future.",
    monitoringSignals: ["Production secret access logs", "Manual credential decryption attempts"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. COMPLIANCE READINESS
// ═══════════════════════════════════════════════════════════════════════════

export const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    name: "SOC 2 Type II",
    description: "Service Organization Control 2 — security, availability, processing integrity, confidentiality, privacy",
    status: "in_progress",
    estimatedCertification: "2027 Q2",
    requirements: [
      {
        control: "CC6.1 — Logical Access",
        description: "Restrict logical access to information assets",
        axiomImplementation: "RBAC engine with role hierarchy, org isolation, session management",
        status: "met",
      },
      {
        control: "CC6.2 — Authentication",
        description: "Authenticate users before granting access",
        axiomImplementation: "NextAuth OAuth with session validation, no password storage",
        status: "met",
      },
      {
        control: "CC6.3 — Authorization",
        description: "Restrict access based on role and need",
        axiomImplementation: "RBAC with provider-scoped permissions, approval chains",
        status: "met",
      },
      {
        control: "CC7.1 — Monitoring",
        description: "Monitor system components for anomalies",
        axiomImplementation: "Structured logging, metrics, alerting, correlation IDs",
        status: "met",
      },
      {
        control: "CC7.2 — Incident Detection",
        description: "Detect and respond to security incidents",
        axiomImplementation: "Alert rules, monitoring agent, drift detection",
        status: "partial",
      },
      {
        control: "CC8.1 — Change Management",
        description: "Authorize, test, and approve changes before deployment",
        axiomImplementation: "Approval workflows, dry-run, canary deployment, audit trail",
        status: "met",
      },
      {
        control: "CC9.1 — Risk Mitigation",
        description: "Identify and mitigate risks",
        axiomImplementation: "Governance engine, risk scoring, blast radius limits, rollback",
        status: "met",
      },
    ],
  },
  {
    name: "GDPR",
    description: "General Data Protection Regulation — EU data protection",
    status: "in_progress",
    estimatedCertification: "2027 Q3",
    requirements: [
      {
        control: "Data Minimization",
        description: "Collect only necessary personal data",
        axiomImplementation: "No personal data collected. Cloud resource metadata only. No user content accessed.",
        status: "met",
      },
      {
        control: "Right to Erasure",
        description: "Delete user data upon request",
        axiomImplementation: "Account deletion cascades to all org data including snapshots, findings, audit logs",
        status: "partial",
      },
      {
        control: "Data Processing Agreement",
        description: "Define data processing terms with customers",
        axiomImplementation: "DPA template needed for enterprise contracts",
        status: "planned",
      },
    ],
  },
  {
    name: "ISO 27001",
    description: "Information Security Management System standard",
    status: "planned",
    estimatedCertification: "2028 Q1",
    requirements: [
      {
        control: "A.9 — Access Control",
        description: "Limit access to information and information processing facilities",
        axiomImplementation: "RBAC, org isolation, approval workflows",
        status: "met",
      },
      {
        control: "A.10 — Cryptography",
        description: "Ensure proper use of cryptography",
        axiomImplementation: "AES-256-GCM credential encryption, TLS in transit",
        status: "met",
      },
      {
        control: "A.12 — Operations Security",
        description: "Ensure correct and secure operations",
        axiomImplementation: "Audit logging, monitoring, change management",
        status: "partial",
      },
    ],
  },
  {
    name: "EU AI Act",
    description: "European Union Artificial Intelligence Act — AI system risk classification and requirements",
    status: "planned",
    estimatedCertification: "2028 Q2",
    requirements: [
      {
        control: "Transparency",
        description: "AI system must be transparent about its capabilities and limitations",
        axiomImplementation: "Explainability engine provides evidence, confidence, assumptions for every recommendation",
        status: "met",
      },
      {
        control: "Human Oversight",
        description: "High-risk AI systems must have human oversight mechanisms",
        axiomImplementation: "Human approval for all write operations, autonomy ladder, admin-only promotion",
        status: "met",
      },
      {
        control: "Risk Management",
        description: "AI systems must have risk management systems",
        axiomImplementation: "Governance engine, blast radius limits, rollback, safety bounds in cognitive architecture",
        status: "met",
      },
      {
        control: "Technical Documentation",
        description: "Maintain technical documentation of AI system design and operation",
        axiomImplementation: "Architecture modules (this file), typed roadmap, test suites",
        status: "partial",
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. CREDENTIAL MANAGEMENT POLICIES
// ═══════════════════════════════════════════════════════════════════════════

export const CREDENTIAL_POLICIES: CredentialPolicy[] = [
  {
    name: "Encryption at Rest",
    description: "All cloud credentials encrypted with AES-256-GCM before storage",
    enforcement: "mandatory",
    implementation: "credentialVault.ts encryptCredential() with random 12-byte IV per record",
  },
  {
    name: "No Environment Variable Storage",
    description: "Customer cloud credentials never stored in process.env or .env files",
    enforcement: "mandatory",
    implementation: "credentials.ts retrieves from vault per-request, never caches in env",
  },
  {
    name: "Secret Redaction in Logs",
    description: "All log output scanned for credential patterns (AWS keys, tokens, passwords) and redacted",
    enforcement: "mandatory",
    implementation: "secretRedaction.ts pattern matching before log write",
  },
  {
    name: "Least-Privilege IAM Roles",
    description: "Customer IAM roles should have minimum permissions needed. Read-only for scanning, scoped write for apply.",
    enforcement: "recommended",
    implementation: "IAM policy templates provided per use case (scan-only, scan+apply)",
  },
  {
    name: "Assume-Role with External ID",
    description: "AWS cross-account access uses assume-role with customer-defined external ID to prevent confused deputy",
    enforcement: "recommended",
    implementation: "credentials.ts AWS assume-role broker with external ID validation",
  },
  {
    name: "Credential Rotation Monitoring",
    description: "Monitor credential age and alert when credentials haven't been rotated in 90 days",
    enforcement: "recommended",
    implementation: "Planned: credential health monitoring in observability layer",
  },
  {
    name: "Session Token Expiry",
    description: "Temporary credentials (STS tokens) have maximum 1-hour expiry. Refreshed per scan.",
    enforcement: "mandatory",
    implementation: "AWS STS assume-role with DurationSeconds=3600",
  },
  {
    name: "Credential Access Audit",
    description: "Every credential retrieval logged with actor, timestamp, and purpose",
    enforcement: "mandatory",
    implementation: "credentials.ts logs credential access via observability layer",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. SAFETY INVARIANTS — THINGS THAT MUST ALWAYS BE TRUE
// ═══════════════════════════════════════════════════════════════════════════

export type SafetyInvariant = {
  id: string;
  category: "execution" | "data" | "access" | "autonomy" | "audit";
  invariant: string;
  enforcement: string;
  violationResponse: string;
  testable: boolean;
};

export const SAFETY_INVARIANTS: SafetyInvariant[] = [
  {
    id: "si-1",
    category: "autonomy",
    invariant: "Agent autonomy level can never increase without explicit admin approval",
    enforcement: "autopilot.ts mode change requires admin role. cognitiveArchitecture.ts blocks self-promotion.",
    violationResponse: "Immediate mode lock to observe_only. Incident notification to org owner.",
    testable: true,
  },
  {
    id: "si-2",
    category: "execution",
    invariant: "Every write operation has a corresponding rollback plan before execution begins",
    enforcement: "Apply handler refuses execution if pre-state capture fails",
    violationResponse: "Operation cancelled. Audit entry records the refusal with reason.",
    testable: true,
  },
  {
    id: "si-3",
    category: "execution",
    invariant: "No operation affects more than 50 resources in a single step",
    enforcement: "operationOrchestrator.ts blast radius validation before step execution",
    violationResponse: "Step rejected. Operation paused. Requires replanning with smaller batches.",
    testable: true,
  },
  {
    id: "si-4",
    category: "data",
    invariant: "No API endpoint returns data from a different organization than the authenticated user's org",
    enforcement: "Prisma middleware adds orgId filter to all queries",
    violationResponse: "Request fails with authorization error. Security alert logged.",
    testable: true,
  },
  {
    id: "si-5",
    category: "data",
    invariant: "Cloud credentials never appear in logs, API responses, error messages, or user-visible output",
    enforcement: "secretRedaction.ts scans all output. credentialVault.ts never returns raw credentials to API layer.",
    violationResponse: "Credential rotation required. Security incident created. Affected logs purged.",
    testable: true,
  },
  {
    id: "si-6",
    category: "audit",
    invariant: "Every state mutation has an audit trail entry with before-state, after-state, actor, and timestamp",
    enforcement: "observability.ts audit hooks on all mutation paths",
    violationResponse: "Unaudited mutation detected via reconciliation check. Retroactive audit entry created. Alert raised.",
    testable: true,
  },
  {
    id: "si-7",
    category: "access",
    invariant: "Read-only cloud permissions are sufficient for scanning. Write permissions only needed for apply.",
    enforcement: "Snapshot generators use read-only API calls. Apply requires separate IAM verification.",
    violationResponse: "Scan proceeds with read-only. Apply refuses without write permission validation.",
    testable: true,
  },
  {
    id: "si-8",
    category: "execution",
    invariant: "Canary validation passes before any operation expands beyond the initial scope",
    enforcement: "operationOrchestrator.ts canary gate dependency type blocks expansion until canary succeeds",
    violationResponse: "Operation paused at canary gate. Requires manual review to continue.",
    testable: true,
  },
  {
    id: "si-9",
    category: "autonomy",
    invariant: "Reflection engine adjustments never exceed ±20% of current values in a single cycle",
    enforcement: "reflectionEngine.ts MAX_ADJUSTMENT_DELTA = 0.20",
    violationResponse: "Adjustment capped at boundary. Excess logged as governance event.",
    testable: true,
  },
  {
    id: "si-10",
    category: "autonomy",
    invariant: "Workflow intelligence adaptations cannot escalate autonomy or reduce safety requirements",
    enforcement: "workflowIntelligence.ts governance safeguard: no_autonomy_escalation",
    violationResponse: "Adaptation rejected. Governance violation logged.",
    testable: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 9. ONBOARDING TRUST JOURNEY
// ═══════════════════════════════════════════════════════════════════════════

export type OnboardingStep = {
  step: number;
  name: string;
  trustImplication: string;
  permissionsRequired: string;
  userAction: string;
  agentAction: string;
  timeToComplete: string;
  reversible: boolean;
};

export const ONBOARDING_JOURNEY: OnboardingStep[] = [
  {
    step: 1,
    name: "Create Account",
    trustImplication: "Platform receives user email and org name. No cloud access.",
    permissionsRequired: "None (platform account only)",
    userAction: "Sign up via OAuth (Google/GitHub)",
    agentAction: "Create org record. No cloud interaction.",
    timeToComplete: "30 seconds",
    reversible: true,
  },
  {
    step: 2,
    name: "Connect Cloud Account (Read-Only)",
    trustImplication: "Platform receives read-only access to cloud resource metadata. No write access. No user data accessed.",
    permissionsRequired: "AWS: ReadOnlyAccess | Azure: Reader | GCP: Viewer",
    userAction: "Create IAM role/service principal with read-only permissions. Enter credentials or assume-role ARN.",
    agentAction: "Validate connection. List accessible regions. Count resources.",
    timeToComplete: "3-5 minutes",
    reversible: true,
  },
  {
    step: 3,
    name: "First Scan",
    trustImplication: "Platform collects resource configuration snapshots. Costs estimated. No modifications.",
    permissionsRequired: "Same read-only from step 2",
    userAction: "Click 'Run First Scan' or wait for automatic scan",
    agentAction: "Collect snapshot. Classify findings. Generate recommendations with evidence.",
    timeToComplete: "2-10 minutes depending on account size",
    reversible: true,
  },
  {
    step: 4,
    name: "Review Recommendations",
    trustImplication: "User evaluates agent intelligence quality. Builds confidence (or not) in agent reasoning.",
    permissionsRequired: "No additional permissions",
    userAction: "Review findings, approve/reject/snooze recommendations",
    agentAction: "Record approval signals. Learn from user preferences. Adapt future recommendations.",
    timeToComplete: "15-30 minutes",
    reversible: true,
  },
  {
    step: 5,
    name: "Enable Apply (Optional)",
    trustImplication: "Significant trust escalation. Platform can now modify cloud resources (with approval).",
    permissionsRequired: "AWS: Scoped write IAM | Azure: Contributor on specific resources | GCP: Editor on specific resources",
    userAction: "Create write-enabled IAM role. Update credential in platform. Enable 'assisted' autopilot mode.",
    agentAction: "Validate write permissions. Run dry-run test. Log mode change.",
    timeToComplete: "10-15 minutes",
    reversible: true,
  },
  {
    step: 6,
    name: "First Approved Apply",
    trustImplication: "Platform makes first real change to cloud infrastructure. This is the trust threshold.",
    permissionsRequired: "Same write permissions from step 5",
    userAction: "Approve a specific recommendation. Observe execution in real-time.",
    agentAction: "Capture pre-state. Dry-run. Execute. Verify. Log audit trail. Report result.",
    timeToComplete: "5-15 minutes",
    reversible: true,
  },
  {
    step: 7,
    name: "Scheduled Scans",
    trustImplication: "Agent operates autonomously in read-only mode on a schedule. User reviews results.",
    permissionsRequired: "Same read-only from step 2",
    userAction: "Configure scan schedule (daily/weekly). Set up Slack/email notifications.",
    agentAction: "Run scans on schedule. Compare results. Surface trends. Notify on new findings.",
    timeToComplete: "5 minutes to configure",
    reversible: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 10. QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function computeTrustScore(
  executionHistory: { success: number; failure: number; rollbacksTriggered: number },
  recommendationHistory: { approved: number; rejected: number; suppressed: number },
  auditCoverage: number,          // 0-100
  credentialIncidents: number,
  daysSinceOnboarding: number,
): TrustScore {
  const totalExecutions = executionHistory.success + executionHistory.failure;
  const totalRecs = recommendationHistory.approved + recommendationHistory.rejected;

  const executionSafety = totalExecutions === 0 ? 50 :
    Math.round((executionHistory.success / totalExecutions) * 100);
  const recommendationQuality = totalRecs === 0 ? 50 :
    Math.round((recommendationHistory.approved / totalRecs) * 100);
  const rollbackReliability = executionHistory.rollbacksTriggered === 0 ? 100 :
    Math.round(((executionHistory.rollbacksTriggered - executionHistory.failure) / executionHistory.rollbacksTriggered) * 100);
  const noiseControl = totalRecs === 0 ? 50 :
    Math.max(0, 100 - Math.round((recommendationHistory.suppressed / totalRecs) * 100));
  const credentialHygiene = credentialIncidents === 0 ? 100 : Math.max(0, 100 - credentialIncidents * 30);

  const dimensions: Record<TrustDimension, number> = {
    execution_safety: Math.min(100, executionSafety),
    recommendation_quality: Math.min(100, recommendationQuality),
    rollback_reliability: Math.min(100, rollbackReliability),
    audit_completeness: Math.min(100, auditCoverage),
    credential_hygiene: Math.min(100, credentialHygiene),
    noise_control: Math.min(100, noiseControl),
    response_time: 75,   // placeholder until measured
    transparency: 80,     // explainability engine is implemented
  };

  const weights: Record<TrustDimension, number> = {
    execution_safety: 0.25,
    recommendation_quality: 0.15,
    rollback_reliability: 0.15,
    audit_completeness: 0.10,
    credential_hygiene: 0.15,
    noise_control: 0.05,
    response_time: 0.05,
    transparency: 0.10,
  };

  const overall = Math.round(
    Object.entries(dimensions).reduce((sum, [dim, score]) =>
      sum + score * weights[dim as TrustDimension], 0)
  );

  let level: TrustLevel = "unverified";
  if (daysSinceOnboarding > 0) level = "observing";
  if (daysSinceOnboarding > 7 && overall >= 60) level = "advising";
  if (daysSinceOnboarding > 37 && overall >= 75 && totalExecutions > 0) level = "assisting";
  if (daysSinceOnboarding > 127 && overall >= 85 && executionSafety >= 95) level = "operating";
  if (daysSinceOnboarding > 307 && overall >= 95 && executionSafety >= 99) level = "trusted";

  const blockers: string[] = [];
  if (executionSafety < 90) blockers.push("Execution safety below 90%");
  if (rollbackReliability < 95) blockers.push("Rollback reliability below 95%");
  if (credentialIncidents > 0) blockers.push(`${credentialIncidents} credential incident(s)`);
  if (auditCoverage < 90) blockers.push("Audit coverage below 90%");

  return {
    overall,
    dimensions,
    level,
    history: [],
    lastEvaluated: new Date().toISOString(),
    promotionEligible: blockers.length === 0,
    promotionBlockers: blockers,
  };
}

export function getSecurityControlsByType(type: SecurityControl["type"]): SecurityControl[] {
  return SECURITY_LAYERS.flatMap((l) => l.controls.filter((c) => c.type === type));
}

export function getActiveSecurityControls(): SecurityControl[] {
  return SECURITY_LAYERS.flatMap((l) => l.controls.filter((c) => c.status === "active"));
}

export function getCriticalThreats(): ThreatModel[] {
  return THREAT_MODEL.filter((t) => t.impact === "critical");
}

export function getComplianceReadiness(): {
  framework: string;
  status: ComplianceFramework["status"];
  metCount: number;
  totalCount: number;
  percentMet: number;
}[] {
  return COMPLIANCE_FRAMEWORKS.map((f) => {
    const met = f.requirements.filter((r) => r.status === "met").length;
    return {
      framework: f.name,
      status: f.status,
      metCount: met,
      totalCount: f.requirements.length,
      percentMet: Math.round((met / f.requirements.length) * 100),
    };
  });
}

export function getInvariantCoverage(): {
  total: number;
  testable: number;
  categories: Record<SafetyInvariant["category"], number>;
} {
  const cats: Record<string, number> = {};
  for (const inv of SAFETY_INVARIANTS) {
    cats[inv.category] = (cats[inv.category] || 0) + 1;
  }
  return {
    total: SAFETY_INVARIANTS.length,
    testable: SAFETY_INVARIANTS.filter((i) => i.testable).length,
    categories: cats as Record<SafetyInvariant["category"], number>,
  };
}

export function getTrustLevelRequirements(targetLevel: TrustLevel): TrustRequirement | undefined {
  return TRUST_LADDER.find((r) => r.toLevel === targetLevel);
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type TrustModelTestResult = { name: string; passed: boolean; detail: string };

export function runTrustModelTests(): TrustModelTestResult[] {
  const results: TrustModelTestResult[] = [];

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: Trust ladder covers all promotions
  const levels: TrustLevel[] = ["unverified", "observing", "advising", "assisting", "operating", "trusted"];
  for (let i = 0; i < levels.length - 1; i++) {
    const req = TRUST_LADDER.find((r) => r.fromLevel === levels[i] && r.toLevel === levels[i + 1]);
    assert(`trust ladder ${levels[i]} → ${levels[i + 1]}`, () => !!req,
      req ? `${req.requirements.length} requirements` : "MISSING");
  }

  // Test 2: No auto-promotion allowed
  const autoPromotions = TRUST_LADDER.filter((r) => r.autoPromotionAllowed);
  assert("no auto-promotion", () => autoPromotions.length === 0,
    `auto-promotions=${autoPromotions.length}`);

  // Test 3: Human approval required for write-level promotions
  const writePromotions = TRUST_LADDER.filter((r) =>
    r.toLevel === "assisting" || r.toLevel === "operating" || r.toLevel === "trusted");
  const allRequireHuman = writePromotions.every((r) => r.humanApprovalRequired);
  assert("write promotions require human", () => allRequireHuman,
    `checked=${writePromotions.length}`);

  // Test 4: Security layers are ordered by depth
  const depths = SECURITY_LAYERS.map((l) => l.depth);
  const sorted = [...depths].sort((a, b) => a - b);
  assert("security layers ordered", () => JSON.stringify(depths) === JSON.stringify(sorted),
    `depths=${depths.join(",")}`);

  // Test 5: All security controls have unique IDs
  const controlIds = SECURITY_LAYERS.flatMap((l) => l.controls.map((c) => c.id));
  assert("unique control IDs", () => new Set(controlIds).size === controlIds.length,
    `total=${controlIds.length}`);

  // Test 6: Active controls exist
  const active = getActiveSecurityControls();
  assert("active controls exist", () => active.length >= 15,
    `active=${active.length}`);

  // Test 7: Threat model covers critical categories
  const threatCats = new Set(THREAT_MODEL.map((t) => t.category));
  assert("threat model covers credentials", () => threatCats.has("credential_theft"), "");
  assert("threat model covers escalation", () => threatCats.has("privilege_escalation"), "");
  assert("threat model covers cross-tenant", () => threatCats.has("cross_tenant"), "");

  // Test 8: All threats have mitigations
  const unmitigated = THREAT_MODEL.filter((t) => t.mitigations.length === 0);
  assert("all threats mitigated", () => unmitigated.length === 0,
    `unmitigated=${unmitigated.length}`);

  // Test 9: Compliance frameworks defined
  assert("compliance frameworks exist", () => COMPLIANCE_FRAMEWORKS.length >= 3,
    `count=${COMPLIANCE_FRAMEWORKS.length}`);

  // Test 10: Safety invariants all testable
  const untestable = SAFETY_INVARIANTS.filter((i) => !i.testable);
  assert("all invariants testable", () => untestable.length === 0,
    `untestable=${untestable.length}`);

  // Test 11: Trust score computation
  const score = computeTrustScore(
    { success: 50, failure: 1, rollbacksTriggered: 2 },
    { approved: 80, rejected: 10, suppressed: 5 },
    95,
    0,
    120,
  );
  assert("trust score computes", () => score.overall > 0 && score.overall <= 100,
    `overall=${score.overall}, level=${score.level}`);

  // Test 12: Zero-execution trust score
  const newScore = computeTrustScore(
    { success: 0, failure: 0, rollbacksTriggered: 0 },
    { approved: 0, rejected: 0, suppressed: 0 },
    0,
    0,
    0,
  );
  assert("new account has base score", () => newScore.level === "unverified",
    `level=${newScore.level}`);

  // Test 13: Credential policies exist
  assert("credential policies defined", () => CREDENTIAL_POLICIES.length >= 5,
    `count=${CREDENTIAL_POLICIES.length}`);

  // Test 14: Onboarding journey defined
  assert("onboarding journey exists", () => ONBOARDING_JOURNEY.length >= 5,
    `steps=${ONBOARDING_JOURNEY.length}`);

  // Test 15: All onboarding steps are reversible
  const irreversible = ONBOARDING_JOURNEY.filter((s) => !s.reversible);
  assert("onboarding fully reversible", () => irreversible.length === 0,
    `irreversible=${irreversible.length}`);

  return results;
}
