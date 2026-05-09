/**
 * Axiom Governance & Compliance Engine
 *
 * Enforces organizational policies against cloud snapshots:
 *   - Cost governance (budget caps, waste thresholds, commitment requirements)
 *   - Resilience governance (multi-region, replication, backup mandates)
 *   - Security/exposure governance (no public storage, encryption required)
 *   - Backup/replication governance (retention minimums, cross-region replication)
 *
 * Design principles:
 *   - Declarative policies: JSON-friendly schema, storable in DB or config
 *   - Deterministic evaluation: same snapshot + policies → same violations
 *   - Actionable: every violation includes severity, remediation, and approval routing
 *   - Provider-agnostic: uniform model across AWS, Azure, GCP
 *   - Composable: policies can be scoped by provider, region, tag, environment
 */

import type {
  CloudSnapshot,
  CloudResource,
  ComputeResource,
  StorageResource,
  CloudProvider,
} from "../cloudSnapshot";
import {
  FindingCategory,
  RiskLevel,
  ActionDisposition,
  ActionType,
} from "../enums";

// ---------------------------------------------------------------------------
// 1. Policy schema
// ---------------------------------------------------------------------------

export type PolicyDomain =
  | "cost"
  | "resilience"
  | "security"
  | "backup"
  | "tagging"
  | "compliance";

export type PolicySeverity = "info" | "warning" | "violation" | "critical";

export type PolicyEnforcement = "audit" | "warn" | "enforce" | "block";

export type PolicyScope = {
  providers?: CloudProvider[];
  regions?: string[];
  environments?: string[];       // matched against tags.environment / tags.env
  resourceTypes?: ("compute" | "storage")[];
  tagMatch?: Record<string, string>;  // all must match
  tagAbsent?: string[];               // resource must NOT have these tags
  excludeResourceIds?: string[];
};

export type GovernancePolicy = {
  id: string;
  name: string;
  description: string;
  domain: PolicyDomain;
  severity: PolicySeverity;
  enforcement: PolicyEnforcement;
  enabled: boolean;
  scope: PolicyScope;
  rule: PolicyRule;
  remediation: PolicyRemediation;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PolicyRule =
  | NoPublicStorageRule
  | RequireReplicationRule
  | RequireMultiRegionRule
  | RequireBackupsRule
  | MaxMonthlyCostRule
  | MaxIdleCpuRule
  | RequireTagsRule
  | MaxResourceCountRule
  | RequireEncryptionRule
  | MinStorageClassRule;

export type NoPublicStorageRule = {
  type: "no_public_storage";
};

export type RequireReplicationRule = {
  type: "require_replication";
};

export type RequireMultiRegionRule = {
  type: "require_multi_region";
  minRegions: number;
};

export type RequireBackupsRule = {
  type: "require_backups";
};

export type MaxMonthlyCostRule = {
  type: "max_monthly_cost";
  maxUsd: number;
};

export type MaxIdleCpuRule = {
  type: "max_idle_cpu";
  thresholdPct: number;       // flag if CPU avg < this
  minSampleHours: number;     // only evaluate if enough data
};

export type RequireTagsRule = {
  type: "require_tags";
  requiredTags: string[];
};

export type MaxResourceCountRule = {
  type: "max_resource_count";
  resourceType: "compute" | "storage";
  maxCount: number;
};

export type RequireEncryptionRule = {
  type: "require_encryption";
};

export type MinStorageClassRule = {
  type: "min_storage_class";
  allowedClasses: string[];   // e.g. ["standard", "infrequent"] — "archive" not allowed for prod
};

// ---------------------------------------------------------------------------
// 2. Violation types
// ---------------------------------------------------------------------------

export type PolicyViolation = {
  id: string;
  policyId: string;
  policyName: string;
  domain: PolicyDomain;
  severity: PolicySeverity;
  enforcement: PolicyEnforcement;
  provider: CloudProvider;
  accountId: string;
  region: string;
  resourceId: string;
  resourceType: "compute" | "storage";
  title: string;
  description: string;
  evidence: ViolationEvidence[];
  remediation: ViolationRemediation;
  detectedAt: string;
  deduplicationKey: string;
};

export type ViolationEvidence = {
  field: string;
  expected: string;
  actual: string;
};

export type ViolationRemediation = {
  action: string;
  description: string;
  automatable: boolean;
  effort: "trivial" | "low" | "medium" | "high";
  suggestedDisposition: ActionDisposition;
  suggestedActionType?: ActionType;
  approvalRequired: boolean;
};

export type PolicyRemediation = {
  action: string;
  description: string;
  automatable: boolean;
  effort: "trivial" | "low" | "medium" | "high";
  suggestedActionType?: ActionType;
};

// ---------------------------------------------------------------------------
// 3. Evaluation report
// ---------------------------------------------------------------------------

export type GovernanceReport = {
  orgId: string;
  evaluatedAt: string;
  snapshotProvider: CloudProvider;
  snapshotAccountId: string;
  policiesEvaluated: number;
  policiesSkipped: number;
  violations: PolicyViolation[];
  summary: GovernanceSummary;
  notification: GovernanceNotification;
};

export type GovernanceSummary = {
  totalViolations: number;
  byDomain: Record<PolicyDomain, number>;
  bySeverity: Record<PolicySeverity, number>;
  byEnforcement: Record<PolicyEnforcement, number>;
  blockedActions: number;
  automatableRemediations: number;
  complianceScore: number;   // 0-100, higher = more compliant
};

export type GovernanceNotification = {
  title: string;
  urgency: "none" | "low" | "medium" | "high" | "critical";
  sections: GovernanceNotificationSection[];
};

export type GovernanceNotificationSection = {
  heading: string;
  items: string[];
};

// ---------------------------------------------------------------------------
// 4. Policy evaluation context
// ---------------------------------------------------------------------------

export type PolicyEvalContext = {
  snapshot: CloudSnapshot;
  orgId: string;
  now: string;
};

// ---------------------------------------------------------------------------
// 5. Policy rule evaluators
// ---------------------------------------------------------------------------

type RuleEvaluator = (
  policy: GovernancePolicy,
  ctx: PolicyEvalContext,
) => PolicyViolation[];

let violationSeq = 0;

function violationId(): string {
  return `gov-${Date.now()}-${++violationSeq}`;
}

function dedup(policyId: string, resourceId: string, field: string): string {
  return `${policyId}:${resourceId}:${field}`;
}

function matchesScope(resource: CloudResource, scope: PolicyScope, snapshot: CloudSnapshot): boolean {
  if (scope.providers?.length && !scope.providers.includes(resource.provider)) return false;
  if (scope.regions?.length && !scope.regions.includes(resource.region)) return false;
  if (scope.resourceTypes?.length && !scope.resourceTypes.includes(resource.resourceType)) return false;
  if (scope.excludeResourceIds?.includes(resource.resourceId)) return false;

  const tags = resource.tags ?? {};

  if (scope.environments?.length) {
    const env = tags["environment"] ?? tags["env"] ?? tags["Environment"] ?? tags["ENV"] ?? "";
    if (!scope.environments.includes(env)) return false;
  }

  if (scope.tagMatch) {
    for (const [k, v] of Object.entries(scope.tagMatch)) {
      if (tags[k] !== v) return false;
    }
  }

  if (scope.tagAbsent?.length) {
    for (const t of scope.tagAbsent) {
      if (t in tags) return false;
    }
  }

  return true;
}

function makeViolation(
  policy: GovernancePolicy,
  resource: CloudResource,
  ctx: PolicyEvalContext,
  title: string,
  description: string,
  evidence: ViolationEvidence[],
  remediationOverride?: Partial<ViolationRemediation>,
): PolicyViolation {
  return {
    id: violationId(),
    policyId: policy.id,
    policyName: policy.name,
    domain: policy.domain,
    severity: policy.severity,
    enforcement: policy.enforcement,
    provider: resource.provider,
    accountId: ctx.snapshot.accountId,
    region: resource.region,
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    title,
    description,
    evidence,
    remediation: {
      action: policy.remediation.action,
      description: policy.remediation.description,
      automatable: policy.remediation.automatable,
      effort: policy.remediation.effort,
      suggestedDisposition: policy.enforcement === "block"
        ? ActionDisposition.Blocked
        : policy.remediation.automatable
          ? ActionDisposition.AutoFixCandidate
          : ActionDisposition.ApprovalRequired,
      suggestedActionType: policy.remediation.suggestedActionType,
      approvalRequired: policy.enforcement === "enforce" || policy.enforcement === "block",
      ...remediationOverride,
    },
    detectedAt: ctx.now,
    deduplicationKey: dedup(policy.id, resource.resourceId, policy.rule.type),
  };
}

// --- No public storage ---
function evalNoPublicStorage(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const r of ctx.snapshot.resources) {
    if (r.resourceType !== "storage") continue;
    if (!matchesScope(r, policy.scope, ctx.snapshot)) continue;
    const tags = r.tags ?? {};
    const isPublic =
      tags["publicAccess"] === "true" ||
      tags["publicAccess"] === "enabled" ||
      tags["acl"] === "public-read" ||
      tags["acl"] === "public-read-write";
    if (isPublic) {
      violations.push(makeViolation(
        policy, r, ctx,
        `Public storage detected: ${r.resourceId}`,
        `Storage resource ${r.resourceId} in ${r.region} has public access enabled. ` +
        `This violates the "${policy.name}" policy.`,
        [{ field: "publicAccess", expected: "disabled", actual: tags["publicAccess"] ?? tags["acl"] ?? "unknown" }],
      ));
    }
  }
  return violations;
}

// --- Require replication ---
function evalRequireReplication(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const r of ctx.snapshot.resources) {
    if (r.resourceType !== "storage") continue;
    if (!matchesScope(r, policy.scope, ctx.snapshot)) continue;
    const tags = r.tags ?? {};
    const hasReplication =
      tags["replication"] === "true" ||
      tags["replication"] === "enabled" ||
      tags["crossRegionReplication"] === "true";
    if (!hasReplication) {
      violations.push(makeViolation(
        policy, r, ctx,
        `Storage without replication: ${r.resourceId}`,
        `Storage resource ${r.resourceId} in ${r.region} has no cross-region replication. ` +
        `This violates the "${policy.name}" policy.`,
        [{ field: "replication", expected: "enabled", actual: tags["replication"] ?? "not_configured" }],
      ));
    }
  }
  return violations;
}

// --- Require multi-region ---
function evalRequireMultiRegion(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const rule = policy.rule as RequireMultiRegionRule;
  if (ctx.snapshot.regions.length >= rule.minRegions) return [];
  if (ctx.snapshot.resources.length === 0) return [];

  const representative = ctx.snapshot.resources[0];
  if (!matchesScope(representative, policy.scope, ctx.snapshot)) return [];

  return [{
    id: violationId(),
    policyId: policy.id,
    policyName: policy.name,
    domain: policy.domain,
    severity: policy.severity,
    enforcement: policy.enforcement,
    provider: ctx.snapshot.provider,
    accountId: ctx.snapshot.accountId,
    region: ctx.snapshot.regions.join(", "),
    resourceId: ctx.snapshot.accountId,
    resourceType: "compute",
    title: `Single-region deployment detected`,
    description:
      `Account ${ctx.snapshot.accountId} has resources in only ${ctx.snapshot.regions.length} region(s) ` +
      `(${ctx.snapshot.regions.join(", ")}). Policy "${policy.name}" requires at least ${rule.minRegions}.`,
    evidence: [{
      field: "regionCount",
      expected: `>= ${rule.minRegions}`,
      actual: String(ctx.snapshot.regions.length),
    }],
    remediation: {
      action: policy.remediation.action,
      description: policy.remediation.description,
      automatable: false,
      effort: "high",
      suggestedDisposition: ActionDisposition.ApprovalRequired,
      approvalRequired: true,
    },
    detectedAt: ctx.now,
    deduplicationKey: dedup(policy.id, ctx.snapshot.accountId, "regionCount"),
  }];
}

// --- Require backups ---
function evalRequireBackups(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  if (!ctx.snapshot.flags.noBackupsDetected) return [];
  if (ctx.snapshot.resources.length === 0) return [];

  const representative = ctx.snapshot.resources[0];
  if (!matchesScope(representative, policy.scope, ctx.snapshot)) return [];

  return [{
    id: violationId(),
    policyId: policy.id,
    policyName: policy.name,
    domain: policy.domain,
    severity: policy.severity,
    enforcement: policy.enforcement,
    provider: ctx.snapshot.provider,
    accountId: ctx.snapshot.accountId,
    region: ctx.snapshot.regions.join(", "),
    resourceId: ctx.snapshot.accountId,
    resourceType: "compute",
    title: `No backups detected`,
    description:
      `Account ${ctx.snapshot.accountId} has no automated backups configured. ` +
      `Policy "${policy.name}" requires backup protection for all production resources.`,
    evidence: [{ field: "noBackupsDetected", expected: "false", actual: "true" }],
    remediation: {
      action: policy.remediation.action,
      description: policy.remediation.description,
      automatable: policy.remediation.automatable,
      effort: policy.remediation.effort,
      suggestedDisposition: ActionDisposition.ApprovalRequired,
      approvalRequired: true,
    },
    detectedAt: ctx.now,
    deduplicationKey: dedup(policy.id, ctx.snapshot.accountId, "noBackupsDetected"),
  }];
}

// --- Max monthly cost ---
function evalMaxMonthlyCost(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const rule = policy.rule as MaxMonthlyCostRule;
  const spend = ctx.snapshot.monthlySpend ?? 0;
  if (spend <= rule.maxUsd) return [];

  return [{
    id: violationId(),
    policyId: policy.id,
    policyName: policy.name,
    domain: policy.domain,
    severity: policy.severity,
    enforcement: policy.enforcement,
    provider: ctx.snapshot.provider,
    accountId: ctx.snapshot.accountId,
    region: ctx.snapshot.regions.join(", "),
    resourceId: ctx.snapshot.accountId,
    resourceType: "compute",
    title: `Monthly spend exceeds budget`,
    description:
      `Account ${ctx.snapshot.accountId} monthly spend is $${spend.toLocaleString()} ` +
      `which exceeds the $${rule.maxUsd.toLocaleString()} budget set by "${policy.name}".`,
    evidence: [{
      field: "monthlySpend",
      expected: `<= $${rule.maxUsd}`,
      actual: `$${spend}`,
    }],
    remediation: {
      action: policy.remediation.action,
      description: policy.remediation.description,
      automatable: false,
      effort: "medium",
      suggestedDisposition: ActionDisposition.ApprovalRequired,
      approvalRequired: true,
    },
    detectedAt: ctx.now,
    deduplicationKey: dedup(policy.id, ctx.snapshot.accountId, "monthlySpend"),
  }];
}

// --- Max idle CPU ---
function evalMaxIdleCpu(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const rule = policy.rule as MaxIdleCpuRule;
  const violations: PolicyViolation[] = [];

  for (const r of ctx.snapshot.resources) {
    if (r.resourceType !== "compute") continue;
    if (!matchesScope(r, policy.scope, ctx.snapshot)) continue;
    const compute = r as ComputeResource;
    if (compute.state !== "running") continue;
    if (!compute.usage?.cpuAvgPct && compute.usage?.cpuAvgPct !== 0) continue;
    if ((compute.usage.sampleWindowHours ?? 0) < rule.minSampleHours) continue;

    if (compute.usage.cpuAvgPct < rule.thresholdPct) {
      violations.push(makeViolation(
        policy, r, ctx,
        `Idle compute: ${r.resourceId} (${compute.usage.cpuAvgPct.toFixed(1)}% CPU)`,
        `Instance ${r.resourceId} (${compute.instanceType}) in ${r.region} is running at ` +
        `${compute.usage.cpuAvgPct.toFixed(1)}% average CPU, below the ${rule.thresholdPct}% threshold. ` +
        `Consider right-sizing or decommissioning.`,
        [{
          field: "cpuAvgPct",
          expected: `>= ${rule.thresholdPct}%`,
          actual: `${compute.usage.cpuAvgPct.toFixed(1)}%`,
        }],
      ));
    }
  }
  return violations;
}

// --- Require tags ---
function evalRequireTags(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const rule = policy.rule as RequireTagsRule;
  const violations: PolicyViolation[] = [];

  for (const r of ctx.snapshot.resources) {
    if (!matchesScope(r, policy.scope, ctx.snapshot)) continue;
    const tags = r.tags ?? {};
    const missing = rule.requiredTags.filter((t) => !(t in tags));
    if (missing.length > 0) {
      violations.push(makeViolation(
        policy, r, ctx,
        `Missing required tags on ${r.resourceId}`,
        `Resource ${r.resourceId} in ${r.region} is missing required tags: ${missing.join(", ")}. ` +
        `Policy "${policy.name}" requires all resources to have these tags.`,
        missing.map((t) => ({ field: t, expected: "present", actual: "missing" })),
      ));
    }
  }
  return violations;
}

// --- Max resource count ---
function evalMaxResourceCount(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const rule = policy.rule as MaxResourceCountRule;
  const matching = ctx.snapshot.resources.filter(
    (r) => r.resourceType === rule.resourceType && matchesScope(r, policy.scope, ctx.snapshot),
  );
  if (matching.length <= rule.maxCount) return [];

  const representative = matching[0];
  return [{
    id: violationId(),
    policyId: policy.id,
    policyName: policy.name,
    domain: policy.domain,
    severity: policy.severity,
    enforcement: policy.enforcement,
    provider: ctx.snapshot.provider,
    accountId: ctx.snapshot.accountId,
    region: representative.region,
    resourceId: ctx.snapshot.accountId,
    resourceType: rule.resourceType,
    title: `${rule.resourceType} count exceeds limit (${matching.length}/${rule.maxCount})`,
    description:
      `Account has ${matching.length} ${rule.resourceType} resources, exceeding the limit of ` +
      `${rule.maxCount} set by "${policy.name}".`,
    evidence: [{
      field: `${rule.resourceType}Count`,
      expected: `<= ${rule.maxCount}`,
      actual: String(matching.length),
    }],
    remediation: {
      action: policy.remediation.action,
      description: policy.remediation.description,
      automatable: false,
      effort: "medium",
      suggestedDisposition: ActionDisposition.ApprovalRequired,
      approvalRequired: true,
    },
    detectedAt: ctx.now,
    deduplicationKey: dedup(policy.id, ctx.snapshot.accountId, `${rule.resourceType}Count`),
  }];
}

// --- Require encryption ---
function evalRequireEncryption(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const r of ctx.snapshot.resources) {
    if (r.resourceType !== "storage") continue;
    if (!matchesScope(r, policy.scope, ctx.snapshot)) continue;
    const tags = r.tags ?? {};
    const encrypted =
      tags["encryption"] === "true" ||
      tags["encryption"] === "enabled" ||
      tags["serverSideEncryption"] === "true" ||
      tags["serverSideEncryption"] === "AES256" ||
      tags["serverSideEncryption"] === "aws:kms";
    if (!encrypted) {
      violations.push(makeViolation(
        policy, r, ctx,
        `Unencrypted storage: ${r.resourceId}`,
        `Storage resource ${r.resourceId} in ${r.region} does not have encryption enabled. ` +
        `Policy "${policy.name}" requires all storage to be encrypted at rest.`,
        [{ field: "encryption", expected: "enabled", actual: tags["encryption"] ?? "not_configured" }],
      ));
    }
  }
  return violations;
}

// --- Min storage class ---
function evalMinStorageClass(policy: GovernancePolicy, ctx: PolicyEvalContext): PolicyViolation[] {
  const rule = policy.rule as MinStorageClassRule;
  const violations: PolicyViolation[] = [];
  for (const r of ctx.snapshot.resources) {
    if (r.resourceType !== "storage") continue;
    if (!matchesScope(r, policy.scope, ctx.snapshot)) continue;
    const storage = r as StorageResource;
    if (!rule.allowedClasses.includes(storage.storageClass)) {
      violations.push(makeViolation(
        policy, r, ctx,
        `Disallowed storage class on ${r.resourceId}: ${storage.storageClass}`,
        `Storage resource ${r.resourceId} uses class "${storage.storageClass}" which is not in the ` +
        `allowed list (${rule.allowedClasses.join(", ")}) defined by "${policy.name}".`,
        [{ field: "storageClass", expected: rule.allowedClasses.join(" | "), actual: storage.storageClass }],
      ));
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// 6. Rule evaluator registry
// ---------------------------------------------------------------------------

const EVALUATORS: Record<PolicyRule["type"], RuleEvaluator> = {
  no_public_storage: evalNoPublicStorage,
  require_replication: evalRequireReplication,
  require_multi_region: evalRequireMultiRegion,
  require_backups: evalRequireBackups,
  max_monthly_cost: evalMaxMonthlyCost,
  max_idle_cpu: evalMaxIdleCpu,
  require_tags: evalRequireTags,
  max_resource_count: evalMaxResourceCount,
  require_encryption: evalRequireEncryption,
  min_storage_class: evalMinStorageClass,
};

// ---------------------------------------------------------------------------
// 7. Main evaluation function
// ---------------------------------------------------------------------------

export type EvaluateGovernanceInput = {
  orgId: string;
  snapshot: CloudSnapshot;
  policies: GovernancePolicy[];
  suppressedKeys?: Set<string>;
};

export function evaluateGovernance(input: EvaluateGovernanceInput): GovernanceReport {
  const now = new Date().toISOString();
  const ctx: PolicyEvalContext = {
    snapshot: input.snapshot,
    orgId: input.orgId,
    now,
  };

  const allViolations: PolicyViolation[] = [];
  let skipped = 0;

  for (const policy of input.policies) {
    if (!policy.enabled) { skipped++; continue; }

    const evaluator = EVALUATORS[policy.rule.type];
    if (!evaluator) { skipped++; continue; }

    const violations = evaluator(policy, ctx);

    for (const v of violations) {
      if (input.suppressedKeys?.has(v.deduplicationKey)) continue;
      allViolations.push(v);
    }
  }

  allViolations.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const summary = buildSummary(allViolations, input.policies.length, skipped);
  const notification = buildNotification(allViolations, summary);

  return {
    orgId: input.orgId,
    evaluatedAt: now,
    snapshotProvider: input.snapshot.provider,
    snapshotAccountId: input.snapshot.accountId,
    policiesEvaluated: input.policies.length - skipped,
    policiesSkipped: skipped,
    violations: allViolations,
    summary,
    notification,
  };
}

// ---------------------------------------------------------------------------
// 8. Summary builder
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<PolicySeverity, number> = {
  info: 0,
  warning: 1,
  violation: 2,
  critical: 3,
};

function severityRank(s: PolicySeverity): number {
  return SEVERITY_RANK[s] ?? 0;
}

function buildSummary(
  violations: PolicyViolation[],
  totalPolicies: number,
  skipped: number,
): GovernanceSummary {
  const byDomain: Record<PolicyDomain, number> = {
    cost: 0, resilience: 0, security: 0, backup: 0, tagging: 0, compliance: 0,
  };
  const bySeverity: Record<PolicySeverity, number> = {
    info: 0, warning: 0, violation: 0, critical: 0,
  };
  const byEnforcement: Record<PolicyEnforcement, number> = {
    audit: 0, warn: 0, enforce: 0, block: 0,
  };

  let blocked = 0;
  let automatable = 0;

  for (const v of violations) {
    byDomain[v.domain]++;
    bySeverity[v.severity]++;
    byEnforcement[v.enforcement]++;
    if (v.enforcement === "block") blocked++;
    if (v.remediation.automatable) automatable++;
  }

  const evaluated = totalPolicies - skipped;
  const passing = evaluated > 0 ? Math.max(0, evaluated - new Set(violations.map((v) => v.policyId)).size) : 0;
  const complianceScore = evaluated > 0 ? Math.round((passing / evaluated) * 100) : 100;

  return {
    totalViolations: violations.length,
    byDomain,
    bySeverity,
    byEnforcement,
    blockedActions: blocked,
    automatableRemediations: automatable,
    complianceScore,
  };
}

// ---------------------------------------------------------------------------
// 9. Notification builder
// ---------------------------------------------------------------------------

function buildNotification(
  violations: PolicyViolation[],
  summary: GovernanceSummary,
): GovernanceNotification {
  if (violations.length === 0) {
    return {
      title: "Governance check passed — all policies compliant",
      urgency: "none",
      sections: [],
    };
  }

  const urgency: GovernanceNotification["urgency"] =
    summary.bySeverity.critical > 0 ? "critical" :
    summary.bySeverity.violation > 0 ? "high" :
    summary.bySeverity.warning > 0 ? "medium" : "low";

  const sections: GovernanceNotificationSection[] = [];

  const criticals = violations.filter((v) => v.severity === "critical");
  if (criticals.length > 0) {
    sections.push({
      heading: `Critical (${criticals.length})`,
      items: criticals.map((v) => `[${v.domain}] ${v.title}`),
    });
  }

  const violationLevel = violations.filter((v) => v.severity === "violation");
  if (violationLevel.length > 0) {
    sections.push({
      heading: `Violations (${violationLevel.length})`,
      items: violationLevel.map((v) => `[${v.domain}] ${v.title}`),
    });
  }

  const warnings = violations.filter((v) => v.severity === "warning");
  if (warnings.length > 0) {
    sections.push({
      heading: `Warnings (${warnings.length})`,
      items: warnings.map((v) => `[${v.domain}] ${v.title}`),
    });
  }

  const infos = violations.filter((v) => v.severity === "info");
  if (infos.length > 0) {
    sections.push({
      heading: `Info (${infos.length})`,
      items: infos.map((v) => `[${v.domain}] ${v.title}`),
    });
  }

  sections.push({
    heading: "Summary",
    items: [
      `Compliance score: ${summary.complianceScore}%`,
      `Blocked actions: ${summary.blockedActions}`,
      `Auto-remediable: ${summary.automatableRemediations}`,
    ],
  });

  return {
    title: `Governance: ${violations.length} violation(s) found — score ${summary.complianceScore}%`,
    urgency,
    sections,
  };
}

// ---------------------------------------------------------------------------
// 10. Sample policies
// ---------------------------------------------------------------------------

export const SAMPLE_POLICIES: GovernancePolicy[] = [
  {
    id: "gov-no-public-storage",
    name: "No public storage allowed",
    description: "All storage resources must have public access disabled. Public buckets risk data exposure.",
    domain: "security",
    severity: "critical",
    enforcement: "block",
    enabled: true,
    scope: {},
    rule: { type: "no_public_storage" },
    remediation: {
      action: "restrict_access",
      description: "Disable public access on the storage resource and apply bucket-level ACL restrictions.",
      automatable: true,
      effort: "trivial",
      suggestedActionType: ActionType.ApplyStoragePolicy,
    },
  },
  {
    id: "gov-require-replication-prod",
    name: "Production storage must have replication",
    description: "All storage tagged as production must have cross-region replication enabled.",
    domain: "resilience",
    severity: "violation",
    enforcement: "enforce",
    enabled: true,
    scope: { environments: ["production", "prod"] },
    rule: { type: "require_replication" },
    remediation: {
      action: "enable_replication",
      description: "Enable cross-region replication for production storage resources.",
      automatable: true,
      effort: "medium",
      suggestedActionType: ActionType.ApplyStoragePolicy,
    },
  },
  {
    id: "gov-multi-region-prod",
    name: "Production workloads must span 2+ regions",
    description: "Single-region production deployments violate resilience requirements.",
    domain: "resilience",
    severity: "violation",
    enforcement: "enforce",
    enabled: true,
    scope: {},
    rule: { type: "require_multi_region", minRegions: 2 },
    remediation: {
      action: "expand_regions",
      description: "Deploy resources to at least one additional region for disaster recovery.",
      automatable: false,
      effort: "high",
    },
  },
  {
    id: "gov-require-backups",
    name: "Automated backups required",
    description: "All production accounts must have automated backup configured.",
    domain: "backup",
    severity: "violation",
    enforcement: "enforce",
    enabled: true,
    scope: {},
    rule: { type: "require_backups" },
    remediation: {
      action: "enable_backups",
      description: "Configure automated backups via AWS Backup, Azure Recovery Services, or GCP snapshots.",
      automatable: true,
      effort: "medium",
    },
  },
  {
    id: "gov-budget-cap",
    name: "Monthly spend must not exceed $50,000",
    description: "Account-level monthly cost cap to prevent runaway spend.",
    domain: "cost",
    severity: "warning",
    enforcement: "warn",
    enabled: true,
    scope: {},
    rule: { type: "max_monthly_cost", maxUsd: 50_000 },
    remediation: {
      action: "review_spend",
      description: "Review recent cost drivers and identify optimization opportunities.",
      automatable: false,
      effort: "medium",
    },
  },
  {
    id: "gov-idle-instances",
    name: "Flag idle instances (<5% CPU over 72h)",
    description: "Instances running below 5% average CPU for 72+ hours should be right-sized or stopped.",
    domain: "cost",
    severity: "warning",
    enforcement: "warn",
    enabled: true,
    scope: { resourceTypes: ["compute"] },
    rule: { type: "max_idle_cpu", thresholdPct: 5, minSampleHours: 72 },
    remediation: {
      action: "rightsize_or_stop",
      description: "Right-size the instance to a smaller type or stop/decommission it.",
      automatable: true,
      effort: "low",
      suggestedActionType: ActionType.ResizeCompute,
    },
  },
  {
    id: "gov-require-cost-tags",
    name: "All resources must have cost-allocation tags",
    description: "Resources must be tagged with team, environment, and project for cost attribution.",
    domain: "tagging",
    severity: "info",
    enforcement: "audit",
    enabled: true,
    scope: {},
    rule: { type: "require_tags", requiredTags: ["team", "environment", "project"] },
    remediation: {
      action: "add_tags",
      description: "Apply required cost-allocation tags to the resource.",
      automatable: true,
      effort: "trivial",
    },
  },
  {
    id: "gov-require-encryption",
    name: "All storage must be encrypted at rest",
    description: "Storage without encryption at rest violates data protection policies.",
    domain: "security",
    severity: "critical",
    enforcement: "block",
    enabled: true,
    scope: { resourceTypes: ["storage"] },
    rule: { type: "require_encryption" },
    remediation: {
      action: "enable_encryption",
      description: "Enable server-side encryption (AES-256 or KMS) on the storage resource.",
      automatable: true,
      effort: "low",
      suggestedActionType: ActionType.ApplyStoragePolicy,
    },
  },
  {
    id: "gov-max-compute-count",
    name: "Maximum 100 compute instances per account",
    description: "Prevents unchecked instance sprawl. Accounts exceeding 100 instances require review.",
    domain: "cost",
    severity: "warning",
    enforcement: "warn",
    enabled: true,
    scope: {},
    rule: { type: "max_resource_count", resourceType: "compute", maxCount: 100 },
    remediation: {
      action: "review_instances",
      description: "Audit running instances and decommission unnecessary workloads.",
      automatable: false,
      effort: "medium",
      suggestedActionType: ActionType.DecommissionCompute,
    },
  },
  {
    id: "gov-prod-storage-class",
    name: "Production storage must use standard or infrequent class",
    description: "Archive-class storage is not acceptable for production workloads due to retrieval latency.",
    domain: "compliance",
    severity: "warning",
    enforcement: "warn",
    enabled: true,
    scope: { environments: ["production", "prod"] },
    rule: { type: "min_storage_class", allowedClasses: ["standard", "infrequent", "intelligent"] },
    remediation: {
      action: "upgrade_storage_class",
      description: "Migrate storage to an acceptable class for production workloads.",
      automatable: true,
      effort: "medium",
      suggestedActionType: ActionType.ApplyStoragePolicy,
    },
  },
];

// ---------------------------------------------------------------------------
// 11. Policy presets (starter bundles)
// ---------------------------------------------------------------------------

export type PolicyPresetName = "startup" | "enterprise" | "regulated";

export type PolicyPreset = {
  name: PolicyPresetName;
  description: string;
  policies: GovernancePolicy[];
};

export const POLICY_PRESETS: Record<PolicyPresetName, PolicyPreset> = {
  startup: {
    name: "startup",
    description: "Lightweight governance for early-stage teams: cost controls and basic security.",
    policies: SAMPLE_POLICIES.filter((p) =>
      ["gov-no-public-storage", "gov-budget-cap", "gov-idle-instances", "gov-require-cost-tags"].includes(p.id),
    ),
  },
  enterprise: {
    name: "enterprise",
    description: "Full governance for enterprise accounts: security, resilience, cost, and tagging.",
    policies: SAMPLE_POLICIES.filter((p) =>
      !["gov-prod-storage-class"].includes(p.id),
    ),
  },
  regulated: {
    name: "regulated",
    description: "Strict governance for regulated industries: all policies enabled with block enforcement.",
    policies: SAMPLE_POLICIES.map((p) => ({
      ...p,
      enforcement: p.severity === "critical" ? "block" as const : "enforce" as const,
      severity: p.severity === "info" ? "warning" as const : p.severity,
    })),
  },
};

export function getPresetPolicies(preset: PolicyPresetName): GovernancePolicy[] {
  return POLICY_PRESETS[preset]?.policies ?? [];
}

// ---------------------------------------------------------------------------
// 12. Helpers for approval workflow integration
// ---------------------------------------------------------------------------

export type GovernanceApprovalContext = {
  violation: PolicyViolation;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  suggestedApprovers: string[];   // role names
  autoFixEligible: boolean;
};

export function toApprovalContext(violation: PolicyViolation): GovernanceApprovalContext {
  const riskLevel: RiskLevel =
    violation.severity === "critical" ? RiskLevel.High :
    violation.severity === "violation" ? RiskLevel.Medium :
    RiskLevel.Low;

  const requiresApproval =
    violation.enforcement === "enforce" || violation.enforcement === "block";

  const suggestedApprovers: string[] = [];
  if (violation.domain === "security" || violation.domain === "compliance") {
    suggestedApprovers.push("security_reviewer");
  }
  if (violation.domain === "cost") {
    suggestedApprovers.push("finance_viewer");
  }
  suggestedApprovers.push("admin", "owner");

  return {
    violation,
    riskLevel,
    requiresApproval,
    suggestedApprovers,
    autoFixEligible: violation.remediation.automatable && violation.enforcement !== "block",
  };
}

export function filterByEnforcement(
  violations: PolicyViolation[],
  enforcement: PolicyEnforcement,
): PolicyViolation[] {
  return violations.filter((v) => v.enforcement === enforcement);
}

export function groupByDomain(
  violations: PolicyViolation[],
): Record<PolicyDomain, PolicyViolation[]> {
  const groups: Record<PolicyDomain, PolicyViolation[]> = {
    cost: [], resilience: [], security: [], backup: [], tagging: [], compliance: [],
  };
  for (const v of violations) {
    groups[v.domain].push(v);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// 13. Policy validation
// ---------------------------------------------------------------------------

export type PolicyValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validatePolicy(policy: GovernancePolicy): PolicyValidationResult {
  const errors: string[] = [];

  if (!policy.id || policy.id.trim().length === 0) errors.push("Policy must have an id");
  if (!policy.name || policy.name.trim().length === 0) errors.push("Policy must have a name");
  if (!policy.rule) errors.push("Policy must have a rule");
  if (!EVALUATORS[policy.rule?.type]) errors.push(`Unknown rule type: ${policy.rule?.type}`);

  if (policy.rule?.type === "require_multi_region") {
    const rule = policy.rule as RequireMultiRegionRule;
    if (!rule.minRegions || rule.minRegions < 1) errors.push("minRegions must be >= 1");
  }
  if (policy.rule?.type === "max_monthly_cost") {
    const rule = policy.rule as MaxMonthlyCostRule;
    if (!rule.maxUsd || rule.maxUsd <= 0) errors.push("maxUsd must be > 0");
  }
  if (policy.rule?.type === "max_idle_cpu") {
    const rule = policy.rule as MaxIdleCpuRule;
    if (rule.thresholdPct < 0 || rule.thresholdPct > 100) errors.push("thresholdPct must be 0-100");
    if (rule.minSampleHours <= 0) errors.push("minSampleHours must be > 0");
  }
  if (policy.rule?.type === "require_tags") {
    const rule = policy.rule as RequireTagsRule;
    if (!rule.requiredTags?.length) errors.push("requiredTags must be non-empty");
  }
  if (policy.rule?.type === "max_resource_count") {
    const rule = policy.rule as MaxResourceCountRule;
    if (rule.maxCount <= 0) errors.push("maxCount must be > 0");
  }
  if (policy.rule?.type === "min_storage_class") {
    const rule = policy.rule as MinStorageClassRule;
    if (!rule.allowedClasses?.length) errors.push("allowedClasses must be non-empty");
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 14. Reset (for testing)
// ---------------------------------------------------------------------------

export function _resetGovernanceCounter(): void {
  violationSeq = 0;
}

// ---------------------------------------------------------------------------
// 15. Invariant tests
// ---------------------------------------------------------------------------

export type GovernanceTestResult = { name: string; passed: boolean; detail: string };

export function runGovernanceTests(): GovernanceTestResult[] {
  const results: GovernanceTestResult[] = [];
  _resetGovernanceCounter();

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  function makeSnapshot(overrides?: Partial<CloudSnapshot>): CloudSnapshot {
    return {
      provider: "aws",
      accountId: "123456789012",
      scannedAt: "2026-05-09T00:00:00Z",
      regions: ["us-east-1", "us-west-2"],
      resources: [],
      monthlySpend: 10_000,
      flags: { singleRegion: false, noBackupsDetected: false },
      ...overrides,
    };
  }

  function makeStorage(overrides?: Partial<StorageResource>): StorageResource {
    return {
      resourceType: "storage",
      provider: "aws",
      resourceId: "bucket-prod-data",
      region: "us-east-1",
      storageClass: "standard",
      ...overrides,
    };
  }

  function makeCompute(overrides?: Partial<ComputeResource>): ComputeResource {
    return {
      resourceType: "compute",
      provider: "aws",
      resourceId: "i-abc123",
      region: "us-east-1",
      instanceType: "m5.xlarge",
      tier: "general",
      vcpus: 4,
      memoryGb: 16,
      state: "running",
      ...overrides,
    };
  }

  // Test 1: Public storage detection
  const publicPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-no-public-storage")!;
  const publicSnap = makeSnapshot({
    resources: [makeStorage({ tags: { publicAccess: "true" } })],
  });
  const publicReport = evaluateGovernance({
    orgId: "org-1", snapshot: publicSnap, policies: [publicPolicy],
  });
  assert("public storage detected", () => publicReport.violations.length === 1,
    `violations=${publicReport.violations.length}`);

  // Test 2: Private storage passes
  const privateSnap = makeSnapshot({
    resources: [makeStorage({ tags: { publicAccess: "false" } })],
  });
  const privateReport = evaluateGovernance({
    orgId: "org-1", snapshot: privateSnap, policies: [publicPolicy],
  });
  assert("private storage passes", () => privateReport.violations.length === 0,
    `violations=${privateReport.violations.length}`);

  // Test 3: Replication enforcement
  const replPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-require-replication-prod")!;
  const noReplSnap = makeSnapshot({
    resources: [makeStorage({ tags: { environment: "production" } })],
  });
  const replReport = evaluateGovernance({
    orgId: "org-1", snapshot: noReplSnap, policies: [replPolicy],
  });
  assert("replication violation detected", () => replReport.violations.length === 1,
    `violations=${replReport.violations.length}`);

  // Test 4: Replication present passes
  const replSnap = makeSnapshot({
    resources: [makeStorage({ tags: { environment: "production", replication: "true" } })],
  });
  const replPassReport = evaluateGovernance({
    orgId: "org-1", snapshot: replSnap, policies: [replPolicy],
  });
  assert("replication present passes", () => replPassReport.violations.length === 0,
    `violations=${replPassReport.violations.length}`);

  // Test 5: Multi-region enforcement
  const regionPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-multi-region-prod")!;
  const singleRegionSnap = makeSnapshot({
    regions: ["us-east-1"],
    resources: [makeCompute()],
  });
  const regionReport = evaluateGovernance({
    orgId: "org-1", snapshot: singleRegionSnap, policies: [regionPolicy],
  });
  assert("single-region violation detected", () => regionReport.violations.length === 1,
    `violations=${regionReport.violations.length}`);

  // Test 6: Multi-region passes
  const multiRegionSnap = makeSnapshot({
    regions: ["us-east-1", "us-west-2"],
    resources: [makeCompute()],
  });
  const regionPassReport = evaluateGovernance({
    orgId: "org-1", snapshot: multiRegionSnap, policies: [regionPolicy],
  });
  assert("multi-region passes", () => regionPassReport.violations.length === 0,
    `violations=${regionPassReport.violations.length}`);

  // Test 7: Backup enforcement
  const backupPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-require-backups")!;
  const noBackupSnap = makeSnapshot({
    flags: { singleRegion: false, noBackupsDetected: true },
    resources: [makeCompute()],
  });
  const backupReport = evaluateGovernance({
    orgId: "org-1", snapshot: noBackupSnap, policies: [backupPolicy],
  });
  assert("no-backup violation detected", () => backupReport.violations.length === 1,
    `violations=${backupReport.violations.length}`);

  // Test 8: Budget cap
  const budgetPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-budget-cap")!;
  const overBudgetSnap = makeSnapshot({ monthlySpend: 75_000 });
  const budgetReport = evaluateGovernance({
    orgId: "org-1", snapshot: overBudgetSnap, policies: [budgetPolicy],
  });
  assert("budget exceeded detected", () => budgetReport.violations.length === 1,
    `violations=${budgetReport.violations.length}`);

  // Test 9: Under budget passes
  const underBudgetSnap = makeSnapshot({ monthlySpend: 30_000 });
  const budgetPassReport = evaluateGovernance({
    orgId: "org-1", snapshot: underBudgetSnap, policies: [budgetPolicy],
  });
  assert("under budget passes", () => budgetPassReport.violations.length === 0,
    `violations=${budgetPassReport.violations.length}`);

  // Test 10: Idle CPU detection
  const idlePolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-idle-instances")!;
  const idleSnap = makeSnapshot({
    resources: [makeCompute({
      usage: { cpuAvgPct: 2.1, sampleWindowHours: 168 },
    })],
  });
  const idleReport = evaluateGovernance({
    orgId: "org-1", snapshot: idleSnap, policies: [idlePolicy],
  });
  assert("idle instance detected", () => idleReport.violations.length === 1,
    `violations=${idleReport.violations.length}`);

  // Test 11: Tag enforcement
  const tagPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-require-cost-tags")!;
  const untaggedSnap = makeSnapshot({
    resources: [makeCompute({ tags: { team: "backend" } })],
  });
  const tagReport = evaluateGovernance({
    orgId: "org-1", snapshot: untaggedSnap, policies: [tagPolicy],
  });
  assert("missing tags detected", () => tagReport.violations.length === 1,
    `violations=${tagReport.violations.length}`);

  // Test 12: Disabled policy skipped
  const disabledPolicy = { ...publicPolicy, enabled: false };
  const disabledReport = evaluateGovernance({
    orgId: "org-1", snapshot: publicSnap, policies: [disabledPolicy],
  });
  assert("disabled policy skipped", () => disabledReport.violations.length === 0,
    `violations=${disabledReport.violations.length}, skipped=${disabledReport.policiesSkipped}`);

  // Test 13: Suppression works
  const suppressedReport = evaluateGovernance({
    orgId: "org-1", snapshot: publicSnap, policies: [publicPolicy],
    suppressedKeys: new Set([`gov-no-public-storage:bucket-prod-data:no_public_storage`]),
  });
  assert("suppression works", () => suppressedReport.violations.length === 0,
    `violations=${suppressedReport.violations.length}`);

  // Test 14: Compliance score computation
  const multiPolicyReport = evaluateGovernance({
    orgId: "org-1",
    snapshot: publicSnap,
    policies: SAMPLE_POLICIES,
  });
  assert("compliance score 0-100", () =>
    multiPolicyReport.summary.complianceScore >= 0 && multiPolicyReport.summary.complianceScore <= 100,
    `score=${multiPolicyReport.summary.complianceScore}`);

  // Test 15: Policy validation
  const validResult = validatePolicy(publicPolicy);
  assert("valid policy passes validation", () => validResult.valid, `errors=${validResult.errors.join(", ")}`);

  const invalidPolicy: GovernancePolicy = {
    ...publicPolicy,
    id: "",
    name: "",
    rule: { type: "max_monthly_cost", maxUsd: -1 } as MaxMonthlyCostRule,
  };
  const invalidResult = validatePolicy(invalidPolicy);
  assert("invalid policy fails validation", () => !invalidResult.valid && invalidResult.errors.length >= 2,
    `errors=${invalidResult.errors.join("; ")}`);

  // Test 17: Scope filtering by provider
  const azurePolicy: GovernancePolicy = {
    ...publicPolicy,
    scope: { providers: ["azure"] },
  };
  const awsSnap = makeSnapshot({
    provider: "aws",
    resources: [makeStorage({ provider: "aws", tags: { publicAccess: "true" } })],
  });
  const scopeReport = evaluateGovernance({
    orgId: "org-1", snapshot: awsSnap, policies: [azurePolicy],
  });
  assert("provider scope filters correctly", () => scopeReport.violations.length === 0,
    `violations=${scopeReport.violations.length}`);

  // Test 18: Approval context generation
  const approval = toApprovalContext(publicReport.violations[0]);
  assert("approval context generated", () =>
    approval.riskLevel === RiskLevel.High && approval.requiresApproval === true,
    `risk=${approval.riskLevel}, req=${approval.requiresApproval}`);

  // Test 19: Presets load
  const startupPreset = getPresetPolicies("startup");
  const enterprisePreset = getPresetPolicies("enterprise");
  assert("presets load correctly", () =>
    startupPreset.length === 4 && enterprisePreset.length >= 8,
    `startup=${startupPreset.length}, enterprise=${enterprisePreset.length}`);

  // Test 20: Encryption check
  const encPolicy = SAMPLE_POLICIES.find((p) => p.id === "gov-require-encryption")!;
  const unencryptedSnap = makeSnapshot({
    resources: [makeStorage({})],
  });
  const encReport = evaluateGovernance({
    orgId: "org-1", snapshot: unencryptedSnap, policies: [encPolicy],
  });
  assert("unencrypted storage detected", () => encReport.violations.length === 1,
    `violations=${encReport.violations.length}`);

  return results;
}
