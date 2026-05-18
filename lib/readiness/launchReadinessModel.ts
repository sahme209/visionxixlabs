/**
 * Launch readiness model — what does Axiom 1.0 need before we can
 * credibly demo, sell, and onboard a paid customer?
 *
 * This is a STRICTER, HONESTY-FIRST extension to the existing
 * production readiness runner. The production runner scores
 * "does the platform compile and have validation matrix coverage?"
 * The launch runner scores "is this product believable as a v1 SaaS
 * offering today?"
 *
 * Honest by design:
 *  - Scores are bounded in [0..100].
 *  - Every category carries `evidence` (matrix row id / file path /
 *    config presence) — never fabricated.
 *  - The runner does not lie about live state — preview categories
 *    cap at `status: "partial"`, never `launch_ready`.
 */

export type LaunchCategory =
  | "product_clarity"
  | "main_journey"
  | "aws_depth"
  | "github_releaseops_depth"
  | "azure_gcp_foundation"
  | "security_scanner"
  | "remediation_simulation_approval"
  | "desktop_review"
  | "desktop_intelligence"
  | "desktop_releases"
  | "trust_audit_evidence"
  | "self_serve_onboarding"
  | "product_honesty"
  | "route_health"
  | "api_health"
  | "api_safety_module"
  | "intelligence_systems"
  | "governance_systems"
  | "operating_graph_visibility"
  | "persistence"
  | "safety_governance"
  | "enterprise_presentation"
  | "developer_maintainability";

export type LaunchStatus =
  | "launch_ready"     // ≥ 80
  | "acceptable"       // 60..79
  | "partial"          // 40..59
  | "blocked"          // 20..39
  | "failing";         // < 20

export type LaunchSourceMode = "live" | "partial_live" | "preview" | "blocked" | "unknown";

export interface LaunchCategoryRow {
  category: LaunchCategory;
  /** Display label for the UI. */
  label: string;
  /** 0..100. */
  score: number;
  status: LaunchStatus;
  evidence: string;
  sourceMode: LaunchSourceMode;
  blockers: string[];
  topFix?: string;
}

export interface LaunchReadinessReport {
  generatedAt: string;
  overallLaunchScore: number;       // 0..100
  overallStatus: LaunchStatus;
  rows: LaunchCategoryRow[];

  /** Issues that would derail a demo today. */
  mustFixBeforeDemo: { category: LaunchCategory; reason: string }[];

  /** Issues that block onboarding a paid customer. */
  mustFixBeforePaidCustomer: { category: LaunchCategory; reason: string }[];

  /** Honest preview areas that are OK to ship as preview. */
  acceptablePreviewAreas: { category: LaunchCategory; reason: string }[];

  /** Areas blocked on credentials / config / external systems. */
  blockedByExternalConfig: { category: LaunchCategory; reason: string }[];

  /** Top 5 next launch fixes, ordered. */
  nextBestLaunchFixes: { id: string; title: string; category: LaunchCategory }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BANDS: { threshold: number; status: LaunchStatus }[] = [
  { threshold: 80, status: "launch_ready" },
  { threshold: 60, status: "acceptable" },
  { threshold: 40, status: "partial" },
  { threshold: 20, status: "blocked" },
];

export function statusForScore(score: number): LaunchStatus {
  for (const band of STATUS_BANDS) {
    if (score >= band.threshold) return band.status;
  }
  return "failing";
}

export const CATEGORY_LABELS: Record<LaunchCategory, string> = {
  product_clarity:                "Product clarity",
  main_journey:                   "Main customer journey",
  aws_depth:                      "AWS depth",
  github_releaseops_depth:        "GitHub / ReleaseOps depth",
  azure_gcp_foundation:           "Azure + GCP foundation",
  security_scanner:               "Security scanner",
  remediation_simulation_approval: "Remediation / simulation / approval",
  desktop_review:                 "Desktop review",
  desktop_intelligence:           "Desktop Intelligence Workstation",
  desktop_releases:               "Desktop Release Management",
  trust_audit_evidence:           "Trust / audit / evidence",
  self_serve_onboarding:          "Self-serve onboarding",
  product_honesty:                "Product honesty",
  route_health:                   "Route health",
  api_health:                     "API health",
  api_safety_module:              "API safety module",
  intelligence_systems:           "Intelligence systems",
  governance_systems:             "Governance systems",
  operating_graph_visibility:     "Operating Graph visibility",
  persistence:                    "Persistence durability",
  safety_governance:              "Safety + governance",
  enterprise_presentation:        "Enterprise presentation",
  developer_maintainability:      "Developer maintainability",
};
