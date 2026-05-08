import { prisma } from "@/lib/db";
import type { CloudProvider } from "../cloudSnapshot";
import type { ConfidenceScore } from "../costSignals";
import type { ExecutionPlanItem, RiskLevel } from "../executionPlan";
import type {
  RiskTolerance,
  ApprovalPolicy,
  OutputFormat,
  BusinessContext,
} from "../enums";
import type { ActionDisposition, AgentFinding, FindingCategory } from "./types";

// ---------------------------------------------------------------------------
// Resolved preferences — typed, with safe defaults already applied
// ---------------------------------------------------------------------------

export type OrgPreferences = {
  organizationId: string;
  preferredProviders: CloudProvider[];
  riskTolerance: RiskTolerance;
  approvalPolicy: ApprovalPolicy;
  autoApplyEnabled: boolean;
  outputFormat: OutputFormat;
  businessContext: BusinessContext;
  ignoredFindingTitles: Set<string>;
  priorityCategories: FindingCategory[];
  notes: string | null;
};

const DEFAULTS: Omit<OrgPreferences, "organizationId"> = {
  preferredProviders: [],
  riskTolerance: "conservative",
  approvalPolicy: "require_all",
  autoApplyEnabled: false,
  outputFormat: "terraform",
  businessContext: "other",
  ignoredFindingTitles: new Set(),
  priorityCategories: [],
  notes: null,
};

// ---------------------------------------------------------------------------
// Load — reads from DB, merges with safe defaults
// ---------------------------------------------------------------------------

export async function loadPreferences(organizationId: string): Promise<OrgPreferences> {
  const row = await prisma.axiomOrgPreferences.findUnique({
    where: { organizationId },
  });

  if (!row) {
    return { organizationId, ...DEFAULTS };
  }

  return {
    organizationId,
    preferredProviders: (row.preferredProviders ?? []) as CloudProvider[],
    riskTolerance: (row.riskTolerance ?? "conservative") as RiskTolerance,
    approvalPolicy: (row.approvalPolicy ?? "require_all") as ApprovalPolicy,
    autoApplyEnabled: row.autoApplyEnabled ?? false,
    outputFormat: (row.outputFormat ?? "terraform") as OutputFormat,
    businessContext: (row.businessContext ?? "other") as BusinessContext,
    ignoredFindingTitles: new Set(row.ignoredFindingTitles ?? []),
    priorityCategories: (row.priorityCategories ?? []) as FindingCategory[],
    notes: row.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Save — upserts preferences (partial updates supported)
// ---------------------------------------------------------------------------

export type PreferenceUpdates = {
  preferredProviders?: string[];
  riskTolerance?: string;
  approvalPolicy?: string;
  autoApplyEnabled?: boolean;
  outputFormat?: string;
  businessContext?: string;
  ignoredFindingTitles?: string[];
  priorityCategories?: string[];
  notes?: string | null;
};

export async function savePreferences(
  organizationId: string,
  updates: PreferenceUpdates,
): Promise<OrgPreferences> {
  await prisma.axiomOrgPreferences.upsert({
    where: { organizationId },
    create: { organizationId, ...updates },
    update: updates,
  });

  return loadPreferences(organizationId);
}

// ---------------------------------------------------------------------------
// Disposition override — adjusts classification based on risk tolerance
//
// SAFETY INVARIANT: this function can only TIGHTEN dispositions (move toward
// approval_required or report_only). It can NEVER promote an item to
// auto_fix_candidate that the base classifier didn't already mark safe.
// ---------------------------------------------------------------------------

export function applyDispositionPolicy(
  baseDisposition: ActionDisposition,
  item: ExecutionPlanItem,
  prefs: OrgPreferences,
): ActionDisposition {
  // require_all: everything needs approval, no auto-apply ever
  if (prefs.approvalPolicy === "require_all") {
    if (baseDisposition === "auto_fix_candidate") return "approval_required";
    return baseDisposition;
  }

  // auto_safe: respect the base classifier's auto_fix_candidate decisions
  if (prefs.approvalPolicy === "auto_safe") {
    if (!prefs.autoApplyEnabled && baseDisposition === "auto_fix_candidate") {
      return "approval_required";
    }
    return baseDisposition;
  }

  // auto_low_risk: auto-apply if base says safe AND risk is low
  if (prefs.approvalPolicy === "auto_low_risk") {
    if (baseDisposition === "auto_fix_candidate" && item.riskLevel === "low") {
      return prefs.autoApplyEnabled ? "auto_fix_candidate" : "approval_required";
    }
    if (baseDisposition === "auto_fix_candidate") return "approval_required";
    return baseDisposition;
  }

  return baseDisposition;
}

// ---------------------------------------------------------------------------
// Risk tolerance gate — can override risk-based disposition tightening
//
// Conservative: medium → approval_required, high → report_only
// Moderate: medium → approval_required (default behavior)
// Aggressive: medium risk items stay as classified
// ---------------------------------------------------------------------------

export function applyRiskTolerance(
  baseDisposition: ActionDisposition,
  riskLevel: RiskLevel,
  tolerance: RiskTolerance,
): ActionDisposition {
  if (tolerance === "conservative") {
    if (riskLevel === "high") return "report_only";
    if (riskLevel === "medium" && baseDisposition === "auto_fix_candidate") {
      return "approval_required";
    }
    return baseDisposition;
  }

  if (tolerance === "aggressive") {
    return baseDisposition;
  }

  // moderate = default behavior, no override
  return baseDisposition;
}

// ---------------------------------------------------------------------------
// Finding filter — removes ignored findings before prioritization
// ---------------------------------------------------------------------------

export function filterIgnoredFindings(
  findings: AgentFinding[],
  prefs: OrgPreferences,
): AgentFinding[] {
  if (prefs.ignoredFindingTitles.size === 0) return findings;

  return findings.filter((f) => !prefs.ignoredFindingTitles.has(f.title));
}

// ---------------------------------------------------------------------------
// Priority boost — adjusts score based on business context + category prefs
// ---------------------------------------------------------------------------

const BUSINESS_CATEGORY_BOOST: Record<string, Record<string, number>> = {
  healthcare:  { compliance: 2.0, security: 1.8, resilience: 1.5 },
  fintech:     { compliance: 1.8, security: 2.0, resilience: 1.5 },
  enterprise:  { security: 1.5, compliance: 1.5, resilience: 1.3 },
  ecommerce:   { performance: 1.5, resilience: 1.3, cost: 1.2 },
  startup:     { cost: 1.5, performance: 1.2 },
  agency:      { cost: 1.3 },
  saas:        { resilience: 1.5, performance: 1.3, cost: 1.2 },
  other:       {},
};

export function categoryBoost(
  category: string,
  prefs: OrgPreferences,
): number {
  // Explicit priority categories override business context
  if (prefs.priorityCategories.length > 0) {
    const idx = prefs.priorityCategories.indexOf(category as FindingCategory);
    if (idx === 0) return 2.0;
    if (idx === 1) return 1.5;
    if (idx >= 2) return 1.2;
    return 1.0;
  }

  // Fall back to business context defaults
  const boosts = BUSINESS_CATEGORY_BOOST[prefs.businessContext] ?? {};
  return boosts[category] ?? 1.0;
}

// ---------------------------------------------------------------------------
// Message tone — adjusts agent copy based on business context
// ---------------------------------------------------------------------------

export function agentTone(prefs: OrgPreferences): {
  complianceWarning: boolean;
  includeRollbackDetail: boolean;
  savingsEmphasis: boolean;
} {
  const ctx = prefs.businessContext;
  return {
    complianceWarning: ctx === "healthcare" || ctx === "fintech" || ctx === "enterprise",
    includeRollbackDetail: prefs.riskTolerance === "conservative",
    savingsEmphasis: ctx === "startup" || ctx === "agency" || ctx === "ecommerce",
  };
}
