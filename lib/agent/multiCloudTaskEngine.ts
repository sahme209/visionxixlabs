/**
 * Multi-Cloud Task Engine.
 *
 * Normalises user intent ("Show all public storage", "Find unused compute",
 * "Generate Terraform fix") into typed tasks the platform can dispatch
 * against the right adapter (AWS / Azure / GCP / GitHub / Security
 * scanner / Execution planner / Desktop). Each task is honest about
 * whether it can run live now, in preview, or is planned.
 *
 * The brain + planning loop ask this engine: "given the user's intent and
 * the current platform state, what should we do next, where, and with
 * what permissions?".
 */

import type { CloudProvider } from "@/lib/domain/provider";
import { COVERAGE_ROWS, type CapabilityCoverageRow, type CoverageStatus } from "@/lib/cloud/capabilityCoverageMap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskCategory =
  | "discover"           // show me / list / inventory
  | "find_risk"          // public exposure, IAM, encryption
  | "find_savings"       // idle, oversized, unused
  | "find_pipeline_risk" // failed workflows, missing protections
  | "generate_fix"       // terraform / CLI plan
  | "compare"            // cross-provider comparison
  | "scan"               // run a scan
  | "rollback"           // prepare rollback
  | "explain"            // explain a finding/decision
  | "validate"           // validate setup / scope
  | "review"             // review pipeline / desktop / audit
  | "open_desktop"       // export plan to desktop for review
  | "unknown";

export type TaskTargetDomain = "aws" | "azure" | "gcp" | "github" | "desktop" | "security_scanner" | "all_clouds" | "platform";

export type TaskAvailability = "live" | "preview" | "expanding" | "planned" | "blocked";

export interface TaskCapabilityRequirement {
  domain: TaskTargetDomain;
  capability: string;
  requiredStatus: "live" | "preview_acceptable";
}

export interface NormalisedTask {
  id: string;
  intent: string;
  category: TaskCategory;
  targets: TaskTargetDomain[];
  requiredCapabilities: TaskCapabilityRequirement[];
  /** Honest availability for this task right now. */
  availability: TaskAvailability;
  /** Roles allowed to invoke this task. */
  requiredRoles: string[];
  /** Plain-language one-liner. */
  summary: string;
  /** Direct action the user can take to run / continue the task. */
  safeNextAction: { label: string; href: string };
  /** Honest source — what backs the answer today. */
  source: "live" | "preview" | "expanding" | "blocked";
}

export interface IntentClassification {
  category: TaskCategory;
  targets: TaskTargetDomain[];
  capabilityKeys: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

const PROVIDER_KEYWORDS: Record<CloudProvider, string[]> = {
  aws:   ["aws", "amazon", "ec2", "s3", "rds", "vpc", "iam role", "lambda"],
  azure: ["azure", "vm", "blob", "entra", "subscription", "resource group"],
  gcp:   ["gcp", "google cloud", "gke", "bigquery", "compute engine", "cloud run"],
};

const DESKTOP_KEYWORDS  = ["desktop", "local", "workstation", "open in desktop", "review locally"];
const PIPELINE_KEYWORDS = ["pipeline", "github", "actions", "release", "deploy", "branch protection", "ci"];
const SECURITY_KEYWORDS = ["security", "risk", "vulnerability", "exposure", "public", "encryption", "iam", "cve"];

function detectTargets(intent: string): TaskTargetDomain[] {
  const t = intent.toLowerCase();
  const out: Set<TaskTargetDomain> = new Set();
  for (const [provider, words] of Object.entries(PROVIDER_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) out.add(provider as TaskTargetDomain);
  }
  if (PIPELINE_KEYWORDS.some((w) => t.includes(w))) out.add("github");
  if (DESKTOP_KEYWORDS.some((w) => t.includes(w))) out.add("desktop");
  if (SECURITY_KEYWORDS.some((w) => t.includes(w)) && out.size === 0) out.add("security_scanner");
  if (out.size === 0) out.add("all_clouds");
  return [...out];
}

function detectCategory(intent: string): TaskCategory {
  const t = intent.toLowerCase();
  if (/(show|list|inventory|find all|what is)/.test(t)) return "discover";
  if (/(risky|public|exposed|breach|cve|vulnerab|misconfig|encryption|iam overreach)/.test(t)) return "find_risk";
  if (/(unused|idle|oversized|wasted|savings|optim)/.test(t)) return "find_savings";
  if (/(deployment|deploy|pipeline|workflow|release|branch protection)/.test(t)) return "find_pipeline_risk";
  if (/(generate|terraform|plan|fix|remediate)/.test(t)) return "generate_fix";
  if (/(compare|vs|diff)/.test(t)) return "compare";
  if (/(scan|run a scan|posture)/.test(t)) return "scan";
  if (/(rollback|revert|undo)/.test(t)) return "rollback";
  if (/(why|explain|reason)/.test(t)) return "explain";
  if (/(validate|verify|setup ok|configured)/.test(t)) return "validate";
  if (/(review|inspect|look at)/.test(t)) return "review";
  if (/(desktop|open in desktop|local)/.test(t)) return "open_desktop";
  return "unknown";
}

function detectCapabilityKeys(category: TaskCategory): string[] {
  switch (category) {
    case "discover":            return ["inventory"];
    case "find_risk":           return ["security_checks", "reasoning_layer"];
    case "find_savings":        return ["cost"];
    case "find_pipeline_risk":  return ["readiness_scoring", "branch_protection", "workflow_discovery"];
    case "generate_fix":        return ["execution_plans"];
    case "compare":             return ["inventory", "security_checks"];
    case "scan":                return ["inventory", "security_checks"];
    case "rollback":            return ["execution_plans"];
    case "explain":             return ["reasoning_layer"];
    case "validate":            return ["connection"];
    case "review":              return ["readiness_scoring"];
    case "open_desktop":        return ["handoff_inbox", "local_review"];
    case "unknown":             return [];
  }
}

export function classifyIntent(intent: string): IntentClassification {
  const category = detectCategory(intent);
  const targets  = detectTargets(intent);
  const capabilityKeys = detectCapabilityKeys(category);
  const confidence = category === "unknown" ? 0.2 : 0.6 + Math.min(targets.length, 3) * 0.1;
  return { category, targets, capabilityKeys, confidence };
}

// ---------------------------------------------------------------------------
// Availability resolution
// ---------------------------------------------------------------------------

function statusOf(domain: TaskTargetDomain, capabilityKey: string): CoverageStatus | null {
  const rows = COVERAGE_ROWS.filter((r) => {
    if (domain === "all_clouds")  return r.domain === "aws" || r.domain === "azure" || r.domain === "gcp";
    if (domain === "platform")    return true;
    return r.domain === domain;
  }).filter((r) => r.area.includes(capabilityKey) || r.id.includes(capabilityKey));
  if (rows.length === 0) return null;

  // Best-status wins (live > preview > expanding > blocked > planned).
  const rank: Record<CoverageStatus, number> = { live: 4, preview: 3, expanding: 2, blocked: 1, planned: 0 };
  rows.sort((a, b) => rank[b.status] - rank[a.status]);
  return rows[0].status;
}

function statusToAvailability(status: CoverageStatus | null): TaskAvailability {
  if (!status) return "planned";
  return status;
}

function statusToSource(status: CoverageStatus | null): NormalisedTask["source"] {
  if (!status || status === "planned") return "blocked";
  if (status === "expanding")            return "expanding";
  if (status === "preview")              return "preview";
  if (status === "blocked")              return "blocked";
  return "live";
}

// ---------------------------------------------------------------------------
// Task composition
// ---------------------------------------------------------------------------

function summaryFor(category: TaskCategory, targets: TaskTargetDomain[]): string {
  const tgt = targets.length === 1 ? targets[0] : targets.join(" + ");
  switch (category) {
    case "discover":            return `Inventory ${tgt} resources from the latest snapshot.`;
    case "find_risk":           return `Surface ${tgt} risk findings ordered by severity.`;
    case "find_savings":        return `Surface ${tgt} cost/savings opportunities.`;
    case "find_pipeline_risk":  return `Score ${tgt} release readiness and list blockers.`;
    case "generate_fix":        return `Compose a plan candidate with Terraform / CLI artefacts.`;
    case "compare":             return `Compare ${tgt} risk and capability state.`;
    case "scan":                return `Run a fresh scan over ${tgt}.`;
    case "rollback":            return `Compose a rollback plan with verification steps.`;
    case "explain":             return `Explain the underlying reasoning for the finding.`;
    case "validate":            return `Validate the ${tgt} connection or setup.`;
    case "review":              return `Review the latest ${tgt} state.`;
    case "open_desktop":        return `Hand the plan off to the desktop workstation for local review.`;
    case "unknown":             return `Could not confidently classify this intent — narrow the question.`;
  }
}

function safeNextActionFor(category: TaskCategory, targets: TaskTargetDomain[]): { label: string; href: string } {
  const primary = targets[0];
  switch (category) {
    case "discover":            return { label: "Open inventory",        href: primary === "github" ? "/dashboard/releaseops" : `/dashboard/cloud/${primary === "all_clouds" ? "" : primary}` };
    case "find_risk":           return { label: "Open security scanner", href: "/dashboard/security-scanner" };
    case "find_savings":        return { label: "Open cost insights",    href: "/dashboard/finops" };
    case "find_pipeline_risk":  return { label: "Open ReleaseOps",       href: "/dashboard/releaseops" };
    case "generate_fix":        return { label: "Open execution plans",  href: "/dashboard/execution" };
    case "compare":             return { label: "Open multi-cloud overview", href: "/dashboard/command-center" };
    case "scan":                return { label: "Run scan",              href: "/dashboard/security-scanner" };
    case "rollback":            return { label: "Open rollback planner", href: "/dashboard/execution?focus=rollback" };
    case "explain":             return { label: "Open copilot",          href: "/dashboard/copilot" };
    case "validate":            return { label: "Re-validate setup",     href: "/operator/onboarding" };
    case "review":              return { label: "Open review surface",   href: "/dashboard/command-center" };
    case "open_desktop":        return { label: "Open desktop inbox",    href: "/desktop/inbox" };
    case "unknown":             return { label: "Open copilot",          href: "/dashboard/copilot" };
  }
}

export interface BuildTaskInput {
  intent: string;
  /** Optional override — caller-provided classification (e.g. from a structured form). */
  classification?: IntentClassification;
  /** Operator roles for permission check. */
  operatorRoles?: string[];
}

export function buildTask(input: BuildTaskInput): NormalisedTask {
  const classification = input.classification ?? classifyIntent(input.intent);
  const targets = classification.targets;

  // Per-target × per-capability statuses → worst-status wins for availability
  // (a task is only as available as its least-ready requirement).
  const statuses: CoverageStatus[] = [];
  const requiredCapabilities: TaskCapabilityRequirement[] = [];

  for (const target of targets) {
    for (const cap of classification.capabilityKeys) {
      const status = statusOf(target, cap);
      if (status) statuses.push(status);
      requiredCapabilities.push({
        domain: target,
        capability: cap,
        requiredStatus: classification.category === "validate" ? "live" : "preview_acceptable",
      });
    }
  }

  const rank: Record<CoverageStatus, number> = { live: 4, preview: 3, expanding: 2, blocked: 1, planned: 0 };
  const worst = statuses.length === 0
    ? null
    : statuses.reduce<CoverageStatus>((acc, s) => (rank[s] < rank[acc] ? s : acc), statuses[0]);

  return {
    id: `task.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`,
    intent: input.intent,
    category: classification.category,
    targets,
    requiredCapabilities,
    availability: statusToAvailability(worst),
    requiredRoles: classification.category === "generate_fix" || classification.category === "rollback"
      ? ["operator", "approver"]
      : ["operator"],
    summary: summaryFor(classification.category, targets),
    safeNextAction: safeNextActionFor(classification.category, targets),
    source: statusToSource(worst),
  };
}

/**
 * Catalogue the canonical tasks the platform currently advertises. Used by
 * the operations brain to show the user "what can I ask Axiom to do?".
 */
export function listCanonicalTasks(): NormalisedTask[] {
  const intents = [
    "Show me all public storage across my clouds",
    "Find unused compute in AWS",
    "Find risky firewall rules in Azure",
    "Show production deployment blockers",
    "Generate Terraform to fix the top finding",
    "Compare AWS and Azure risk posture",
    "Run a security scan now",
    "Prepare a rollback for the last plan",
    "Why is this finding considered risky",
    "Validate my cloud setup",
    "Review pipeline health",
    "Open the latest plan in desktop",
  ];
  return intents.map((intent) => buildTask({ intent }));
}

export function listTaskCategories(): TaskCategory[] {
  return ["discover", "find_risk", "find_savings", "find_pipeline_risk", "generate_fix", "compare", "scan", "rollback", "explain", "validate", "review", "open_desktop"];
}

export function describeCoverageForTarget(target: TaskTargetDomain): CapabilityCoverageRow[] {
  if (target === "all_clouds") return COVERAGE_ROWS.filter((r) => r.domain === "aws" || r.domain === "azure" || r.domain === "gcp");
  if (target === "platform")   return COVERAGE_ROWS;
  return COVERAGE_ROWS.filter((r) => r.domain === target);
}
