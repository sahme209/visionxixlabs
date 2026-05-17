/**
 * AWS multi-region read-only inventory orchestrator.
 *
 * Calls the single-region collector (`runLiveAwsInventory`) in parallel
 * across N regions discovered via EC2 `DescribeRegions`, then merges the
 * results into a single `PreviewScanOutcome`-shaped snapshot.
 *
 * Hard rules:
 *  - Read-only end-to-end. The orchestrator only spreads existing
 *    read-only calls across regions; it never adds a mutation path.
 *  - Bounded parallelism. Caps at MAX_REGIONS to keep STS + AWS API
 *    cost predictable. Operators can pass their own region list when
 *    they need full coverage.
 *  - Partial failure honesty. Per-region errors are captured as
 *    `limitations`; the orchestrator never throws when a single region
 *    can't be read.
 *  - Stable ordering. Regions are sorted alphabetically so snapshot
 *    hashes are deterministic across runs.
 */

import "server-only";

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";

import { loadAppEnv } from "@/lib/config/env";
import type { OrganizationId, SnapshotId } from "@/lib/domain/ids";
import { id } from "@/lib/domain/ids";
import type { PreviewSnapshot, PreviewFinding, PreviewRecommendation } from "./awsPreviewScanner";
import { runLiveAwsInventory, type AwsLiveInventoryResult } from "./awsLiveInventory";

const MAX_REGIONS_DEFAULT = 4;
const REGION_DISCOVER_TIMEOUT_MS = 6_000;

export interface AwsMultiRegionInventoryInput {
  organizationId: OrganizationId;
  roleArn: string;
  externalId: string;
  /** Optional explicit region list. If omitted we discover via DescribeRegions. */
  regions?: string[];
  /** Region from which to discover the region list. Defaults to "us-east-1". */
  discoveryRegion?: string;
  /** Cap on region count (default 4). 0 = run every region returned by AWS — use carefully. */
  maxRegions?: number;
  /** Per-call timeout passed through to single-region inventory. */
  perCallTimeoutMs?: number;
}

export interface AwsMultiRegionInventoryResult {
  /** Merged snapshot — resources from every region under one snapshot id. */
  snapshot: PreviewSnapshot;
  findings: PreviewFinding[];
  recommendations: PreviewRecommendation[];
  durationMs: number;
  /** Top-level honesty tag rolled up across all regions. */
  source: "live" | "partial" | "preview";
  /** Account id from STS (set when the AssumeRole succeeds at least once). */
  accountId?: string;
  /** Region-by-region status summary. */
  perRegion: {
    region: string;
    source: AwsLiveInventoryResult["source"];
    resourceCount: number;
    findingCount: number;
    limitationCount: number;
  }[];
  /** Aggregated limitations across regions. */
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export async function runMultiRegionAwsInventory(input: AwsMultiRegionInventoryInput): Promise<AwsMultiRegionInventoryResult> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.awsBrokerConfigured) {
    return emptyResult(input, start, ["AWS broker credentials are not configured — cannot perform multi-region read."]);
  }
  if (env.awsScanMode !== "live") {
    return emptyResult(input, start, [`AWS scan mode is ${env.awsScanMode}, not "live".`]);
  }

  // 1) Resolve the region list.
  let regions: string[];
  let regionListLimitations: string[] = [];
  if (input.regions && input.regions.length > 0) {
    regions = [...new Set(input.regions)];
  } else {
    const discovery = await discoverRegions(input.discoveryRegion ?? "us-east-1");
    regions = discovery.regions;
    if (discovery.limitations.length > 0) regionListLimitations = discovery.limitations;
    if (regions.length === 0) {
      // Fall back to the discovery region so we still attempt one scan.
      regions = [input.discoveryRegion ?? "us-east-1"];
      regionListLimitations.push("DescribeRegions returned no regions — falling back to single discovery region.");
    }
  }

  // Bound region count, alphabetic ordering for determinism.
  const cap = input.maxRegions ?? MAX_REGIONS_DEFAULT;
  regions = [...regions].sort((a, b) => a.localeCompare(b));
  if (cap > 0) regions = regions.slice(0, cap);

  // 2) Fan out — but cap parallelism at 3 to be polite to STS + per-region rate limits.
  const perRegionResults: AwsLiveInventoryResult[] = [];
  const concurrency = Math.min(3, regions.length);
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push((async () => {
      while (true) {
        const i = cursor++;
        if (i >= regions.length) break;
        const region = regions[i];
        const result = await runLiveAwsInventory({
          organizationId: input.organizationId,
          roleArn: input.roleArn,
          externalId: input.externalId,
          region,
          perCallTimeoutMs: input.perCallTimeoutMs,
        });
        perRegionResults.push(result);
      }
    })());
  }
  await Promise.all(workers);

  // 3) Merge.
  const merged = mergeRegions(input, perRegionResults, start, regions, regionListLimitations);
  return merged;
}

// ---------------------------------------------------------------------------
// Region discovery — uses the BROKER credentials only (no role assumption).
// STS DescribeRegions is callable with broker creds, no cross-account call yet.
// ---------------------------------------------------------------------------

async function discoverRegions(discoveryRegion: string): Promise<{ regions: string[]; limitations: string[] }> {
  try {
    const client = new EC2Client({
      region: discoveryRegion,
      credentials: {
        accessKeyId: process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY!,
      },
    });
    const out = await withTimeout(
      client.send(new DescribeRegionsCommand({ AllRegions: false })),
      REGION_DISCOVER_TIMEOUT_MS,
      "ec2.describe_regions",
    );
    const regions = (out.Regions ?? [])
      .map((r) => r.RegionName)
      .filter((r): r is string => typeof r === "string");
    return { regions, limitations: [] };
  } catch (err) {
    return {
      regions: [],
      limitations: [`DescribeRegions failed via broker creds: ${classify(err)}.`],
    };
  }
}

// ---------------------------------------------------------------------------
// Merge — sum counts, concat resources, dedupe findings/recommendations.
// ---------------------------------------------------------------------------

function mergeRegions(
  input: AwsMultiRegionInventoryInput,
  results: AwsLiveInventoryResult[],
  start: number,
  attemptedRegions: string[],
  regionListLimitations: string[],
): AwsMultiRegionInventoryResult {
  const snapshotId = id.snapshot(`snp_aws_multi_${Date.now().toString(36)}`);
  const merged: PreviewSnapshot = {
    snapshotId,
    organizationId: input.organizationId,
    provider: "aws",
    region: attemptedRegions.length === 1 ? attemptedRegions[0] : `multi:${attemptedRegions.length}`,
    generatedAt: new Date().toISOString(),
    source: "live",
    resourceCounts: { ec2: 0, s3: 0, rds: 0, iamRoles: 0, vpcs: 0 },
    resources: [],
  };
  const findings: PreviewFinding[] = [];
  const recommendations: PreviewRecommendation[] = [];
  const limitations: string[] = [...regionListLimitations];
  const perRegion: AwsMultiRegionInventoryResult["perRegion"] = [];
  let accountId: string | undefined;
  let anyPartial = false;
  let anyEmpty = false;

  for (const r of results) {
    if (r.accountId) accountId = r.accountId;
    merged.resources.push(...r.snapshot.resources);
    merged.resourceCounts.ec2 += r.snapshot.resourceCounts.ec2 ?? 0;
    merged.resourceCounts.s3  += r.snapshot.resourceCounts.s3 ?? 0;
    merged.resourceCounts.rds += r.snapshot.resourceCounts.rds ?? 0;
    merged.resourceCounts.iamRoles += r.snapshot.resourceCounts.iamRoles ?? 0;
    merged.resourceCounts.vpcs += r.snapshot.resourceCounts.vpcs ?? 0;
    findings.push(...r.findings);
    recommendations.push(...r.recommendations);
    if (r.limitations.length > 0) limitations.push(...r.limitations);
    perRegion.push({
      region: r.snapshot.region,
      source: r.source,
      resourceCount: r.snapshot.resources.length,
      findingCount: r.findings.length,
      limitationCount: r.limitations.length,
    });
    if (r.source === "partial") anyPartial = true;
    if (r.snapshot.resources.length === 0) anyEmpty = true;
  }

  // Honest top-level source mode.
  let source: AwsMultiRegionInventoryResult["source"] = "live";
  if (limitations.length > 0 || anyPartial) source = "partial";
  if (merged.resources.length === 0 && anyEmpty) source = "preview";
  merged.source = source === "live" ? "live" : source === "partial" ? "partial" : "preview";

  return {
    snapshot: merged,
    findings,
    recommendations,
    durationMs: Date.now() - start,
    source,
    accountId,
    perRegion,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(input: AwsMultiRegionInventoryInput, start: number, limitations: string[]): AwsMultiRegionInventoryResult {
  const snapshotId = id.snapshot(`snp_aws_multi_empty_${Date.now().toString(36)}`);
  return {
    snapshot: {
      snapshotId,
      organizationId: input.organizationId,
      provider: "aws",
      region: "multi:0",
      generatedAt: new Date().toISOString(),
      source: "preview",
      resourceCounts: { ec2: 0, s3: 0, rds: 0, iamRoles: 0, vpcs: 0 },
      resources: [],
    },
    findings: [],
    recommendations: [],
    durationMs: Date.now() - start,
    source: "partial",
    perRegion: [],
    limitations,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, op: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${op} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function classify(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return String(err).slice(0, 200);
}

// Silence unused-import warning for STSClient (kept for future expansion when
// we need to broker GetCallerIdentity against the assumed role to surface
// `accountId` even when per-region inventory fails — see follow-on sprint).
export type _STSClient = typeof STSClient;
