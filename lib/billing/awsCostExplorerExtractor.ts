/**
 * AWS Cost Explorer live extractor.
 *
 * Real SDK traversal that populates the Billing Connectors model
 * with confirmed-dollar spend over the last 30 days (and the prior
 * 30-day baseline). Gated behind:
 *
 *   - AWS mode === "live"
 *   - host broker credentials available (same pattern as live
 *     inventory)
 *   - AWS_COST_EXPLORER_ENABLED env flag (operator opt-in — Cost
 *     Explorer API has per-request cost)
 *
 * Pure read-only. Never tags, never deletes line items. The
 * extractor returns an extra typed `liveExtraction` envelope so
 * the builder can merge it into the canonical
 * BillingProviderPosture without losing the honest-preview default
 * when extraction fails.
 */

import "server-only";

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandInput,
} from "@aws-sdk/client-cost-explorer";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "@/lib/cloud/aws/awsConfig";
import type {
  BillingAnomaly,
  BillingAnomalyKind,
} from "./billingConnectorsModel";

// ---------------------------------------------------------------------------
// Public envelope
// ---------------------------------------------------------------------------

export interface AwsCostExplorerExtraction {
  /** Honest mode — only "live" when SDK round-tripped successfully. */
  mode: "live" | "preview" | "blocked" | "disabled";
  /** Confirmed USD spend over T-30 to T-0. */
  confirmedDollarsLast30d: number;
  /** Confirmed USD spend over T-60 to T-30 (baseline). */
  confirmedDollarsPrev30d: number;
  /** Anomalies derived from the period comparison. */
  anomalies: BillingAnomaly[];
  /** Wall-clock cost of the extraction in ms. */
  durationMs: number;
  /** Honest limitations seen during this run. */
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 12_000;
const SPIKE_THRESHOLD_PCT = 20; // ≥ 20% increase over baseline flags as spend_spike_7d

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function extractAwsCostExplorerSpend(): Promise<AwsCostExplorerExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.awsCostExplorerEnabled) {
    return blocked(start, "AWS_COST_EXPLORER_ENABLED is not set — Cost Explorer extraction skipped.");
  }

  const awsCfg = getAwsConfig();
  if (awsCfg.mode !== "live") {
    return preview(start, "AWS mode is not live — extractor returned honest preview.");
  }

  // Need broker creds + role arn + external id to AssumeRole.
  const brokerKey = env.awsBrokerAccessKeyId;
  const brokerSecret = env.awsBrokerSecretAccessKey;
  if (!brokerKey || !brokerSecret) {
    return blocked(start, "Broker credentials missing — set AWS_CONNECTOR_BROKER_* env vars.");
  }
  const roleArn = env.awsAmbientRoleArn;
  const externalId = env.awsAmbientExternalId;
  const region = env.awsAmbientRegion;
  if (!roleArn || !externalId || !region) {
    return blocked(start, "Ambient AWS_ROLE_ARN + AWS_EXTERNAL_ID + AWS_REGION are required for tenant-scoped Cost Explorer reads.");
  }

  // AssumeRole into the customer account using the broker credentials.
  let creds: { accessKeyId: string; secretAccessKey: string; sessionToken: string };
  try {
    const sts = new STSClient({
      region,
      credentials: { accessKeyId: brokerKey, secretAccessKey: brokerSecret },
    });
    const assumed = await withTimeout(
      sts.send(new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `axiom-billing-${Date.now()}`,
        ExternalId: externalId,
        DurationSeconds: 900,
      })),
      DEFAULT_TIMEOUT_MS,
      "sts.assume_role",
    );
    const c = assumed.Credentials;
    if (!c?.AccessKeyId || !c?.SecretAccessKey || !c?.SessionToken) {
      return blocked(start, "AssumeRole returned no credentials.");
    }
    creds = { accessKeyId: c.AccessKeyId, secretAccessKey: c.SecretAccessKey, sessionToken: c.SessionToken };
  } catch (err) {
    return blocked(start, `AssumeRole failed: ${redact(errMessage(err))}`);
  }

  // Cost Explorer is a global service in us-east-1. Region pinned regardless
  // of the customer's primary region.
  const ce = new CostExplorerClient({ region: "us-east-1", credentials: creds });

  // Two period queries: current 30 days + prior 30 days.
  const now = new Date();
  const t0 = isoDay(now);
  const t30 = isoDay(daysAgo(now, 30));
  const t60 = isoDay(daysAgo(now, 60));

  const limitations: string[] = [];
  let confirmedLast30 = 0;
  let confirmedPrev30 = 0;

  try {
    const last30 = await withTimeout(
      ce.send(new GetCostAndUsageCommand(buildCostQuery(t30, t0))),
      DEFAULT_TIMEOUT_MS,
      "ce.get_last_30",
    );
    confirmedLast30 = sumUnblendedUsd(last30);
  } catch (err) {
    limitations.push(`Last-30 cost fetch failed: ${redact(errMessage(err))}`);
  }

  try {
    const prev30 = await withTimeout(
      ce.send(new GetCostAndUsageCommand(buildCostQuery(t60, t30))),
      DEFAULT_TIMEOUT_MS,
      "ce.get_prev_30",
    );
    confirmedPrev30 = sumUnblendedUsd(prev30);
  } catch (err) {
    limitations.push(`Prev-30 cost fetch failed: ${redact(errMessage(err))}`);
  }

  // ---------------------------------------------------------------------------
  // Anomaly derivation — only when both periods produced confident numbers.
  // ---------------------------------------------------------------------------
  const anomalies: BillingAnomaly[] = [];
  if (confirmedLast30 > 0 && confirmedPrev30 > 0) {
    const deltaPct = ((confirmedLast30 - confirmedPrev30) / confirmedPrev30) * 100;
    if (deltaPct >= SPIKE_THRESHOLD_PCT) {
      anomalies.push({
        id: `billing:aws_cost_explorer:spike_7d:${Date.now()}`,
        kind: "spend_spike_7d" as BillingAnomalyKind,
        severity: deltaPct >= 50 ? "critical" : deltaPct >= 35 ? "high" : "medium",
        scope: "All AWS services",
        headline: `AWS spend up ${deltaPct.toFixed(1)}% vs. prior 30 days`,
        impactSummary: `Confirmed dollar delta: +$${(confirmedLast30 - confirmedPrev30).toFixed(2)} over baseline.`,
        deltaUsd: confirmedLast30 - confirmedPrev30,
        baselinePeriod: `${t60} → ${t30}`,
        sourceProvider: "aws_cost_explorer",
        evidenceRef: "aws:cost_explorer:GetCostAndUsage",
        confidence: 0.92,
        safeNextAction: { label: "Open FinOps", href: "/dashboard/finops" },
      });
    }
  }

  return {
    mode: "live",
    confirmedDollarsLast30d: confirmedLast30,
    confirmedDollarsPrev30d: confirmedPrev30,
    anomalies,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCostQuery(startIso: string, endIso: string): GetCostAndUsageCommandInput {
  return {
    TimePeriod: { Start: startIso, End: endIso },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
  };
}

function sumUnblendedUsd(out: { ResultsByTime?: Array<{ Total?: Record<string, { Amount?: string; Unit?: string }> }> }): number {
  let total = 0;
  for (const row of out.ResultsByTime ?? []) {
    const amt = row.Total?.UnblendedCost?.Amount;
    const unit = row.Total?.UnblendedCost?.Unit;
    if (typeof amt !== "string" || (unit && unit !== "USD")) continue;
    const n = Number(amt);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function preview(start: number, note: string): AwsCostExplorerExtraction {
  return {
    mode: "preview",
    confirmedDollarsLast30d: 0,
    confirmedDollarsPrev30d: 0,
    anomalies: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}

function blocked(start: number, note: string): AwsCostExplorerExtraction {
  return {
    mode: "blocked",
    confirmedDollarsLast30d: 0,
    confirmedDollarsPrev30d: 0,
    anomalies: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Strip likely-credential substrings from error messages before surfacing. */
function redact(msg: string): string {
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}
