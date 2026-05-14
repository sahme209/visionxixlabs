/**
 * Coverage Gap Analyzer.
 *
 * Axiom must know what it cannot yet do. This module reads the coverage
 * map, identifies non-live capabilities, classifies their severity and
 * customer impact, and emits a typed gap report the brain + UI + roadmap
 * read from. It prevents fake claims and guides what engineering should
 * tackle next.
 */

import { COVERAGE_ROWS, type CapabilityCoverageRow, type CoverageDomain, type CoverageStatus } from "@/lib/cloud/capabilityCoverageMap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GapSeverity = "low" | "medium" | "high" | "critical";
export type CustomerImpact = "minor" | "moderate" | "significant" | "blocking";

export interface CoverageGap {
  id: string;
  domain: CoverageDomain;
  title: string;
  capabilityStatus: CoverageStatus;
  severity: GapSeverity;
  customerImpact: CustomerImpact;
  /** Underlying coverage row id. */
  coverageRef: string;
  requiredCapability: string;
  /** Next engineering task. */
  nextEngineeringTask?: string;
  /** Source mode for the underlying capability. */
  sourceMode: "live" | "preview" | "planned" | "blocked";
  /** Self-serve explanation for the user. */
  selfServeExplanation: string;
}

export interface CoverageGapReport {
  generatedAt: string;
  gaps: CoverageGap[];
  byDomain: Record<CoverageDomain, CoverageGap[]>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    blocking: number;
    significant: number;
  };
}

// ---------------------------------------------------------------------------
// Classification rules
// ---------------------------------------------------------------------------

function severityFor(row: CapabilityCoverageRow): GapSeverity {
  if (row.status === "blocked") return "high";
  if (row.status === "planned") {
    if (row.area === "connection" || row.area === "execution") return "high";
    return "medium";
  }
  if (row.status === "expanding") return "medium";
  // preview
  if (row.area === "connection" || row.area === "execution") return "medium";
  return "low";
}

function impactFor(row: CapabilityCoverageRow): CustomerImpact {
  if (row.area === "connection" && row.status !== "live") return "blocking";
  if (row.area === "execution"  && row.status !== "live") return "significant";
  if (row.status === "blocked")  return "significant";
  if (row.status === "planned")  return "moderate";
  if (row.status === "expanding") return "moderate";
  return "minor";
}

function statusToSourceMode(s: CoverageStatus): CoverageGap["sourceMode"] {
  return s === "expanding" ? "preview" : s;
}

function selfServeExplanationFor(row: CapabilityCoverageRow): string {
  if (row.requiredConfig && row.requiredConfig.length > 0) {
    return `${row.userExplanation} Configure: ${row.requiredConfig.join(", ")}.`;
  }
  return row.userExplanation;
}

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

function severityRank(s: GapSeverity): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s];
}

const ALL_DOMAINS: CoverageDomain[] = ["aws", "azure", "gcp", "github", "security_scanner", "desktop", "command_center", "compliance", "audit"];

export function analyzeCoverageGaps(rows: CapabilityCoverageRow[] = COVERAGE_ROWS): CoverageGapReport {
  const gaps: CoverageGap[] = rows
    .filter((r) => r.status !== "live")
    .map((row) => ({
      id: `gap.${row.id}`,
      domain: row.domain,
      title: row.title,
      capabilityStatus: row.status,
      severity: severityFor(row),
      customerImpact: impactFor(row),
      coverageRef: row.id,
      requiredCapability: row.area,
      nextEngineeringTask: row.nextEngineeringMilestone,
      sourceMode: statusToSourceMode(row.status),
      selfServeExplanation: selfServeExplanationFor(row),
    }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const byDomain = ALL_DOMAINS.reduce((acc, d) => {
    acc[d] = gaps.filter((g) => g.domain === d);
    return acc;
  }, {} as Record<CoverageDomain, CoverageGap[]>);

  const summary = {
    total:        gaps.length,
    critical:     gaps.filter((g) => g.severity === "critical").length,
    high:         gaps.filter((g) => g.severity === "high").length,
    medium:       gaps.filter((g) => g.severity === "medium").length,
    low:          gaps.filter((g) => g.severity === "low").length,
    blocking:     gaps.filter((g) => g.customerImpact === "blocking").length,
    significant:  gaps.filter((g) => g.customerImpact === "significant").length,
  };

  return { generatedAt: new Date().toISOString(), gaps, byDomain, summary };
}

export function topGaps(report: CoverageGapReport, limit = 5): CoverageGap[] {
  return report.gaps.slice(0, limit);
}

export function gapsForDomain(report: CoverageGapReport, domain: CoverageDomain): CoverageGap[] {
  return report.byDomain[domain] ?? [];
}

export const GAP_SEVERITY_LABEL: Record<GapSeverity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

export const CUSTOMER_IMPACT_LABEL: Record<CustomerImpact, string> = {
  blocking:    "Blocking",
  significant: "Significant",
  moderate:    "Moderate",
  minor:       "Minor",
};
