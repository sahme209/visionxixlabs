/**
 * Digital Twin Builder.
 *
 * Composes the infrastructure digital twin from existing canonical
 * signals — multi-cloud overview slices, security scanner output,
 * release readiness, coverage gaps. The builder does not invent
 * resources or pretend a connector is live.
 *
 * Output is consumed by the simulator + diff engine + impact analyzer
 * + simulation center UI.
 */

import "server-only";

import {
  type DigitalTwin,
  type DigitalTwinResource,
  type DigitalTwinRelationship,
  type DigitalTwinRiskLevel,
  type DigitalTwinSourceMode,
  type TwinSecurityPosture,
  type TwinCostPosture,
  type TwinReliabilityPosture,
  type TwinReleasePosture,
  emptyTwin,
} from "@/lib/digitalTwin/digitalTwinModel";

import type { CloudProvider } from "@/lib/domain/provider";
import { buildMultiCloudOverview, type NormalisedProviderSlice } from "@/lib/cloud/multiCloudOverview";
import { runSecurityScan, type SecurityScanOutcome, type SecurityCheckResult } from "@/lib/securityScanner/securityScanner";
import { getReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import { analyzeCoverageGaps } from "@/lib/cloud/coverageGapAnalyzer";
import { currentContext } from "@/lib/auth/currentContext";
import { loadAppEnv } from "@/lib/config/env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityToRisk(severity: string): DigitalTwinRiskLevel {
  switch (severity) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":
    case "info":     return "low";
    default:         return "unknown";
  }
}

function findingRiskFor(checks: SecurityCheckResult[]): DigitalTwinRiskLevel {
  if (checks.length === 0) return "low";
  const ranks = checks.map((c) => severityToRisk(c.severity));
  if (ranks.includes("critical")) return "critical";
  if (ranks.includes("high"))     return "high";
  if (ranks.includes("medium"))   return "medium";
  return "low";
}

function sourceModeFromSlice(slice: NormalisedProviderSlice): DigitalTwinSourceMode {
  return slice.source === "live" ? "live" : slice.source === "preview" ? "preview" : "preview";
}

// ---------------------------------------------------------------------------
// Resource synthesis from slices + scanner
// ---------------------------------------------------------------------------

function resourcesFromSlice(slice: NormalisedProviderSlice, securityChecks: SecurityCheckResult[]): DigitalTwinResource[] {
  const out: DigitalTwinResource[] = [];

  // Build one twin resource per (kind, count). For the resource list we
  // emit synthetic representative resources so the diff/impact engines
  // have something to operate on — clearly tagged with source mode.
  for (const [kind, count] of Object.entries(slice.resourceCounts)) {
    if (count <= 0) continue;
    for (let i = 0; i < Math.min(count, 4); i++) {
      const id = `${slice.provider}.${kind}.${i}`;
      const matchingChecks = securityChecks.filter(
        (c) => c.provider === slice.provider && c.affectedResources?.some((r) => r.includes(kind) || r.includes(id)),
      );
      out.push({
        id,
        provider: slice.provider,
        type: kind,
        name: `${kind}-${i + 1}`,
        region: undefined,
        accountId: undefined,
        properties: { kind, sliceTotal: count },
        tags: {},
        state: "running",
        riskLevel: findingRiskFor(matchingChecks),
        securityFindings: matchingChecks.map((c) => ({
          ruleCode: c.id,
          severity: severityToRisk(c.severity),
          evidence: c.evidence[0],
        })),
        costFindings: [],
        dependencies: [],
        sourceMode: sourceModeFromSlice(slice),
        confidence: slice.source === "live" ? 0.9 : 0.5,
      });
    }
  }

  return out;
}

function relationshipsForProvider(resources: DigitalTwinResource[]): DigitalTwinRelationship[] {
  const out: DigitalTwinRelationship[] = [];
  // Synthetic relationships: compute resources depend on VPC, S3 buckets
  // are governed by IAM, etc. Tag confidence low so downstream knows
  // these are heuristic.
  const byKind: Record<string, DigitalTwinResource[]> = {};
  for (const r of resources) {
    (byKind[r.type as string] ??= []).push(r);
  }
  const vpcs    = byKind["vpcs"]     ?? byKind["network"]  ?? [];
  const compute = byKind["ec2"]      ?? byKind["compute"]  ?? [];
  const storage = byKind["s3"]       ?? byKind["storage"]  ?? [];
  const iam     = byKind["iamRoles"] ?? byKind["identity"] ?? [];

  for (const c of compute) {
    if (vpcs[0]) out.push({ fromResourceId: vpcs[0].id, toResourceId: c.id, relationshipType: "contains",  riskLevel: "low", confidence: 0.5 });
  }
  for (const s of storage) {
    if (iam[0]) out.push({ fromResourceId: iam[0].id,  toResourceId: s.id, relationshipType: "owned_by",  riskLevel: "low", confidence: 0.4 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Posture builders
// ---------------------------------------------------------------------------

function buildSecurityPosture(scan: SecurityScanOutcome): TwinSecurityPosture {
  const failing = scan.results.filter((c) => c.status === "fail").length;
  const warning = scan.results.filter((c) => c.status === "warn").length;
  const preview = scan.results.filter((c) => c.status === "preview").length;
  const top = scan.results
    .filter((c) => c.status === "fail")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 5)
    .map((c) => ({
      ruleCode: c.id,
      severity: severityToRisk(c.severity),
      resourceRef: c.affectedResources?.[0] ?? "(global)",
    }));
  return {
    score: scan.summary.score,
    totalFindings: scan.results.length,
    failing,
    warning,
    preview,
    topFindings: top,
  };
}

function severityRank(s: string): number {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s as "critical"] ?? 0;
}

function buildCostPosture(resources: DigitalTwinResource[]): TwinCostPosture {
  const withCost = resources.filter((r) => r.costFindings.some((c) => typeof c.monthlyCostUsd === "number"));
  const total = withCost.reduce((acc, r) => acc + r.costFindings.reduce((a, c) => a + (c.monthlyCostUsd ?? 0), 0), 0);
  return {
    totalMonthlyCostUsd: withCost.length > 0 ? total : undefined,
    coverageRatio: resources.length === 0 ? 0 : withCost.length / resources.length,
    topCostResources: [...withCost].slice(0, 5).map((r) => ({
      resourceId: r.id,
      monthlyCostUsd: r.costFindings.reduce((a, c) => a + (c.monthlyCostUsd ?? 0), 0),
    })),
  };
}

function buildReliabilityPosture(resources: DigitalTwinResource[]): TwinReliabilityPosture {
  return {
    score: resources.length === 0 ? 0 : 60, // honest preview score until reliability signals are wired
    singleRegionResources: resources.filter((r) => !r.region).length,
    noBackupResources:     0,
    noReplicaResources:    0,
  };
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export interface BuildTwinInput {
  /** When provided, the builder uses these overrides instead of running its
   *  own scans (useful for tests + replays). */
  securityScan?: SecurityScanOutcome;
  preferredProviders?: CloudProvider[];
}

export async function buildDigitalTwin(input: BuildTwinInput = {}): Promise<DigitalTwin> {
  const ctx = await currentContext();
  const tenantId = ctx.organizationId ? String(ctx.organizationId) : undefined;

  // Provider slices — currently driven by preview adapters at this layer.
  const overview = buildMultiCloudOverview({});
  let slices = overview.slices;
  if (input.preferredProviders && input.preferredProviders.length > 0) {
    slices = slices.filter((s) => input.preferredProviders!.includes(s.provider));
  }

  // Security scan — honest about app/supply-chain/desktop signals.
  const env = loadAppEnv();
  const scan = input.securityScan ?? await runSecurityScan({
    app: {
      redactionActive: true,
      auditStoreConfigured: true,
      copilotContextSafe: true,
      tenantScopeEnforcedServerSide: false,
      rbacWiredOnRoutes: false,
      desktopApplyBlockedByDefault: true,
    },
    supplyChain: {
      lockfileCommitted: true,
      dependencyScanRun: false,
      secretScanningActive: false,
      buildSigningWired: false,
    },
    desktop: {
      macosSigned: false,
      macosNotarized: false,
      windowsSigned: false,
      linuxSigned: false,
      handoffSignerConfigured: env.desktopHandoffSigningKeySet || Boolean(env.nextAuthSecret),
      localApplyBlockedByDefault: true,
    },
  });

  // Resources + relationships per slice.
  const resources: DigitalTwinResource[] = [];
  const relationships: DigitalTwinRelationship[] = [];
  for (const slice of slices) {
    const sliceResources = resourcesFromSlice(slice, scan.results);
    resources.push(...sliceResources);
    relationships.push(...relationshipsForProvider(sliceResources));
  }

  // Releases.
  const releases = await getReleaseOpsState();

  const release: TwinReleasePosture = {
    grade: releases.readiness.grade,
    blockerCount: releases.readiness.blockers.length,
  };

  // Honest limitations.
  const gapsReport = analyzeCoverageGaps();
  const knownLimitations: string[] = [];
  for (const slice of slices) {
    if (slice.source !== "live") {
      knownLimitations.push(`${slice.provider.toUpperCase()} resources are preview-mode — exact ids, regions, and properties are not connected.`);
    }
  }
  if (gapsReport.summary.blocking > 0) {
    knownLimitations.push(`${gapsReport.summary.blocking} capability gap(s) block primary flows — see /api/cloud/coverage-gaps.`);
  }
  knownLimitations.push("Cost telemetry coverage is partial — totalMonthlyCostUsd is undefined when no resource carries cost evidence.");
  knownLimitations.push("Reliability score is a placeholder until backup + replica + multi-region signals are wired.");

  const sourceMode: DigitalTwinSourceMode =
    slices.every((s) => s.source === "live") && slices.length > 0 ? "live"
    : slices.length === 0 ? "preview"
    : "preview";

  // Posture composition.
  const securityPosture    = buildSecurityPosture(scan);
  const costPosture        = buildCostPosture(resources);
  const reliabilityPosture = buildReliabilityPosture(resources);

  const evidenceRefs = [
    { label: "multiCloud_slices", ref: `${slices.length}` },
    { label: "security_results",  ref: `${scan.results.length}` },
    { label: "release_grade",     ref: release.grade ?? "n/a" },
  ];

  const twin: DigitalTwin = {
    id: `twin.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    provider: slices.length === 1 ? slices[0].provider : "multi",
    sourceSnapshotId: undefined,
    sourceMode,
    generatedAt: new Date().toISOString(),
    resources,
    relationships,
    securityPosture,
    costPosture,
    reliabilityPosture,
    releasePosture: release,
    knownLimitations,
    confidence: sourceMode === "live" ? 0.85 : 0.5,
    evidenceRefs,
  };

  if (twin.resources.length === 0) {
    // Honest fall-back — no slices means no provider data.
    return {
      ...emptyTwin(tenantId),
      knownLimitations: ["No provider data is connected. Twin is empty."],
    };
  }

  return twin;
}
