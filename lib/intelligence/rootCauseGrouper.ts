/**
 * Root Cause grouper.
 *
 * Pure read-only composition over the Risk Queue. Groups related risks
 * by shared properties:
 *
 *   - same provider + blocked status
 *   - same missing config (env var prefix)
 *   - same readiness blocker
 *   - same severity cluster (when ≥ 3 critical/high in same source)
 *
 * Calls every cause "suspected" — never "proven". Confidence is
 * derived from evidence count + group size.
 */

import "server-only";

import { buildRiskQueue } from "@/lib/risk/riskQueueBuilder";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { RiskItem } from "@/lib/risk/riskQueueModel";
import type {
  RootCauseConfidence,
  RootCauseGroup,
  RootCauseReport,
} from "./rootCauseModel";

export interface BuildRootCausesInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildRootCauses(input: BuildRootCausesInput): Promise<RootCauseReport> {
  const risk = await buildRiskQueue({ tenantId: input.tenantId, actorUserId: input.actorUserId });
  const items = risk.items;

  const groups: RootCauseGroup[] = [];
  const grouped = new Set<string>(); // ids already assigned to a group

  // ---------------------------------------------------------------------------
  // Pattern 1: same provider + blocked
  // ---------------------------------------------------------------------------
  const providerBuckets = new Map<string, RiskItem[]>();
  for (const r of items) {
    if (r.status !== "blocked") continue;
    const key = r.sourceSystem;
    if (!providerBuckets.has(key)) providerBuckets.set(key, []);
    providerBuckets.get(key)!.push(r);
  }
  for (const [provider, bucket] of providerBuckets) {
    if (bucket.length < 2) continue; // single blocked = not a group
    groups.push({
      id: `rc:provider_blocked:${provider}`,
      title: `${provider.toUpperCase()} · ${bucket.length} blocked signals`,
      suspectedCause: `Suspected cause: ${provider.toUpperCase()} source missing config — multiple risks blocked behind the same connector.`,
      pattern: "same_provider_blocked",
      confidence: confidenceFromGroupSize(bucket.length),
      relatedCount: bucket.length,
      relatedSignalIds: bucket.map((r) => r.id),
      affectedSystems: [provider],
      sourceMode: bucket[0].sourceMode,
      whyItMatters: `Resolving the ${provider.toUpperCase()} connector clears ${bucket.length} downstream risks at once. Investigating individual items risks duplicate work.`,
      evidenceRefs: dedupe(bucket.flatMap((r) => r.evidenceRefs)),
      limitations: dedupe(bucket.flatMap((r) => r.limitations)),
      safeNextAction: { label: `Open ${provider.toUpperCase()} setup`, href: `/dashboard/${provider}` },
    });
    bucket.forEach((r) => grouped.add(r.id));
  }

  // ---------------------------------------------------------------------------
  // Pattern 2: same missing config (env-var-like limitations)
  // ---------------------------------------------------------------------------
  const configBuckets = new Map<string, RiskItem[]>();
  for (const r of items) {
    if (grouped.has(r.id)) continue;
    const envHint = r.limitations.find((l) => /[A-Z_]{4,}/.test(l));
    if (!envHint) continue;
    const key = envHint.match(/[A-Z][A-Z0-9_]+/)?.[0] ?? "ENV";
    if (!configBuckets.has(key)) configBuckets.set(key, []);
    configBuckets.get(key)!.push(r);
  }
  for (const [envVar, bucket] of configBuckets) {
    if (bucket.length < 2) continue;
    groups.push({
      id: `rc:missing_config:${envVar}`,
      title: `${bucket.length} risks blocked by missing ${envVar}`,
      suspectedCause: `Suspected cause: ${envVar} not configured on the host — every related path returns honest preview.`,
      pattern: "same_missing_config",
      confidence: confidenceFromGroupSize(bucket.length),
      relatedCount: bucket.length,
      relatedSignalIds: bucket.map((r) => r.id),
      affectedSystems: dedupe(bucket.map((r) => r.sourceSystem)),
      sourceMode: bucket[0].sourceMode,
      whyItMatters: `Setting ${envVar} unblocks ${bucket.length} downstream paths in one operator action.`,
      evidenceRefs: dedupe(bucket.flatMap((r) => r.evidenceRefs)),
      limitations: [`Missing env: ${envVar}`],
      safeNextAction: { label: "Open Sources", href: "/dashboard/sources" },
    });
    bucket.forEach((r) => grouped.add(r.id));
  }

  // ---------------------------------------------------------------------------
  // Pattern 3: same readiness blocker (persistence)
  // ---------------------------------------------------------------------------
  const readinessBucket = items.filter(
    (r) => !grouped.has(r.id) && r.category === "readiness_blocker",
  );
  if (readinessBucket.length >= 2) {
    groups.push({
      id: "rc:readiness_persistence",
      title: `${readinessBucket.length} readiness blockers in this snapshot`,
      suspectedCause: "Suspected cause: persistence not yet wired — multiple readiness items expect DATABASE_URL durability.",
      pattern: "same_readiness_blocker",
      confidence: confidenceFromGroupSize(readinessBucket.length),
      relatedCount: readinessBucket.length,
      relatedSignalIds: readinessBucket.map((r) => r.id),
      affectedSystems: dedupe(readinessBucket.map((r) => r.sourceSystem)),
      sourceMode: readinessBucket[0].sourceMode,
      whyItMatters: "Persistence shipping moves multiple readiness items from preview → live in one step.",
      evidenceRefs: dedupe(readinessBucket.flatMap((r) => r.evidenceRefs)),
      limitations: ["Persistence is a pilot-readiness prerequisite — operator action: set DATABASE_URL."],
      safeNextAction: { label: "Open Readiness", href: "/dashboard/readiness" },
    });
    readinessBucket.forEach((r) => grouped.add(r.id));
  }

  // ---------------------------------------------------------------------------
  // Pattern 4: severity cluster (≥ 3 critical/high from same source)
  // ---------------------------------------------------------------------------
  const sevBuckets = new Map<string, RiskItem[]>();
  for (const r of items) {
    if (grouped.has(r.id)) continue;
    if (r.severity !== "critical" && r.severity !== "high") continue;
    const key = r.sourceSystem;
    if (!sevBuckets.has(key)) sevBuckets.set(key, []);
    sevBuckets.get(key)!.push(r);
  }
  for (const [source, bucket] of sevBuckets) {
    if (bucket.length < 3) continue;
    groups.push({
      id: `rc:severity_cluster:${source}`,
      title: `${source} · ${bucket.length} critical/high signals cluster`,
      suspectedCause: `Suspected cause: configuration drift or recent change in ${source} producing multiple critical/high signals.`,
      pattern: "same_severity_cluster",
      confidence: confidenceFromGroupSize(bucket.length),
      relatedCount: bucket.length,
      relatedSignalIds: bucket.map((r) => r.id),
      affectedSystems: [source],
      sourceMode: bucket[0].sourceMode,
      whyItMatters: `When ${bucket.length}+ critical/high signals share a source, investigating the source itself is more efficient than per-finding.`,
      evidenceRefs: dedupe(bucket.flatMap((r) => r.evidenceRefs)),
      limitations: dedupe(bucket.flatMap((r) => r.limitations)),
      safeNextAction: { label: `Open ${source}`, href: `/dashboard/${source}` },
    });
    bucket.forEach((r) => grouped.add(r.id));
  }

  // Sort: high-confidence + larger groups first
  groups.sort((a, b) => {
    const conf = confidenceWeight(b.confidence) - confidenceWeight(a.confidence);
    if (conf !== 0) return conf;
    return b.relatedCount - a.relatedCount;
  });

  const totalSignalsCovered = grouped.size;
  const singletons = items.length - totalSignalsCovered;

  return {
    generatedAt: risk.generatedAt,
    tenantId: String(input.tenantId),
    groups,
    summary: {
      totalGroups:         groups.length,
      totalSignalsCovered,
      singletons,
      highConfidence:      groups.filter((g) => g.confidence === "high").length,
      mediumConfidence:    groups.filter((g) => g.confidence === "medium").length,
      lowConfidence:       groups.filter((g) => g.confidence === "low").length,
    },
    safetyContract: "grouping_only_no_resolution",
    limitations: [
      "Root cause grouper merges current-snapshot signals — historical persistence is not yet wired.",
      "Every cause is labeled 'suspected' — none are claimed as proven without operator verification.",
    ],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function confidenceFromGroupSize(n: number): RootCauseConfidence {
  if (n >= 5) return "high";
  if (n >= 3) return "medium";
  return "low";
}

function confidenceWeight(c: RootCauseConfidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
