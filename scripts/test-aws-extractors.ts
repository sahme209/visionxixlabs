#!/usr/bin/env -S npx tsx
/**
 * AWS extractor test harness.
 *
 * Run with:
 *   npx tsx scripts/test-aws-extractors.ts
 *
 * Reads credentials from .env.local (server-side only; never logged
 * or sent over the network). Calls each AWS extractor directly,
 * prints a redacted summary, and exits 0/1.
 *
 * Two ways to authenticate (the script auto-detects which you set):
 *
 *   PATH A — simple IAM user (easiest for first test):
 *     AWS_TEST_ACCESS_KEY_ID=AKIA...
 *     AWS_TEST_SECRET_ACCESS_KEY=...
 *     AWS_TEST_REGION=us-east-1
 *
 *   PATH B — full multi-tenant broker + AssumeRole flow (matches
 *   what the production extractors use):
 *     AWS_CONNECTOR_BROKER_ACCESS_KEY_ID=AKIA...
 *     AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY=...
 *     AWS_ROLE_ARN=arn:aws:iam::...:role/AxiomReadOnly
 *     AWS_EXTERNAL_ID=...
 *     AWS_REGION=us-east-1
 *
 * Path A is the fastest way to confirm "the SDK can read my AWS
 * account". Path B is what you'd use in production.
 */

import { config as loadDotenv } from "dotenv";
import path from "path";

// Load .env.local first (Next.js convention), then .env as fallback.
loadDotenv({ path: path.join(process.cwd(), ".env.local") });
loadDotenv({ path: path.join(process.cwd(), ".env") });

// ---------------------------------------------------------------------------

interface TestResult {
  name: string;
  ok: boolean;
  summary: string;
  durationMs: number;
}

async function main() {
  console.log("\n=== Axiom AWS extractor test harness ===\n");

  const usingSimple = !!process.env.AWS_TEST_ACCESS_KEY_ID;
  const usingBroker = !!process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID;

  if (!usingSimple && !usingBroker) {
    console.error("❌ No AWS credentials configured.\n");
    console.error("Set EITHER (simple path):");
    console.error("  AWS_TEST_ACCESS_KEY_ID");
    console.error("  AWS_TEST_SECRET_ACCESS_KEY");
    console.error("  AWS_TEST_REGION (defaults to us-east-1)");
    console.error("\nOR (production-style):");
    console.error("  AWS_CONNECTOR_BROKER_ACCESS_KEY_ID");
    console.error("  AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY");
    console.error("  AWS_ROLE_ARN + AWS_EXTERNAL_ID + AWS_REGION\n");
    process.exit(1);
  }

  console.log(`Auth path: ${usingBroker ? "broker + AssumeRole (production-style)" : "simple IAM user"}\n`);

  // If simple path, fan-out the simple creds into what the extractors
  // expect. This makes the existing extractors testable without
  // setting up the full AssumeRole dance.
  if (usingSimple && !usingBroker) {
    process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID = process.env.AWS_TEST_ACCESS_KEY_ID;
    process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY = process.env.AWS_TEST_SECRET_ACCESS_KEY;
    process.env.AWS_REGION = process.env.AWS_TEST_REGION ?? "us-east-1";
    process.env.AWS_SCAN_MODE = "live";
    // Without a role/external id, the extractors would error on AssumeRole.
    // For the simple test path, we run the SDKs directly with the IAM user creds.
    return runSimpleTests();
  }

  // Production path — go through the canonical extractors.
  return runExtractors();
}

// ---------------------------------------------------------------------------
// Simple path — direct SDK calls with IAM user creds (no AssumeRole)
// ---------------------------------------------------------------------------

async function runSimpleTests(): Promise<void> {
  const region = process.env.AWS_TEST_REGION ?? "us-east-1";
  const credentials = {
    accessKeyId: process.env.AWS_TEST_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_TEST_SECRET_ACCESS_KEY!,
  };

  const results: TestResult[] = [];

  // 1. STS — identity check (always works if creds are valid)
  results.push(await timed("STS GetCallerIdentity", async () => {
    const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
    const sts = new STSClient({ region, credentials });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    return `Account ${redactAccount(id.Account)} · ARN ${redactArn(id.Arn)}`;
  }));

  // 2. Cost Explorer — last 30 days
  results.push(await timed("Cost Explorer", async () => {
    const { CostExplorerClient, GetCostAndUsageCommand } = await import("@aws-sdk/client-cost-explorer");
    const ce = new CostExplorerClient({ region: "us-east-1", credentials });
    const now = new Date();
    const start = new Date(now); start.setUTCDate(start.getUTCDate() - 30);
    const res = await ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: start.toISOString().slice(0, 10), End: now.toISOString().slice(0, 10) },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
    }));
    let total = 0;
    for (const row of res.ResultsByTime ?? []) {
      const amt = Number(row.Total?.UnblendedCost?.Amount ?? "0");
      if (Number.isFinite(amt)) total += amt;
    }
    return `Last 30d unblended cost: $${total.toFixed(2)}`;
  }));

  // 3. ECS — list clusters
  results.push(await timed(`ECS (region ${region})`, async () => {
    const { ECSClient, ListClustersCommand } = await import("@aws-sdk/client-ecs");
    const ecs = new ECSClient({ region, credentials });
    const res = await ecs.send(new ListClustersCommand({}));
    return `${res.clusterArns?.length ?? 0} cluster(s)`;
  }));

  // 4. EKS — list clusters
  results.push(await timed(`EKS (region ${region})`, async () => {
    const { EKSClient, ListClustersCommand } = await import("@aws-sdk/client-eks");
    const eks = new EKSClient({ region, credentials });
    const res = await eks.send(new ListClustersCommand({}));
    return `${res.clusters?.length ?? 0} cluster(s)`;
  }));

  // 5. CloudWatch — describe alarms
  results.push(await timed(`CloudWatch (region ${region})`, async () => {
    const { CloudWatchClient, DescribeAlarmsCommand } = await import("@aws-sdk/client-cloudwatch");
    const cw = new CloudWatchClient({ region, credentials });
    const res = await cw.send(new DescribeAlarmsCommand({ AlarmTypes: ["MetricAlarm"], MaxRecords: 100 }));
    const total = res.MetricAlarms?.length ?? 0;
    const firing = (res.MetricAlarms ?? []).filter((a) => a.StateValue === "ALARM").length;
    return `${total} alarm(s), ${firing} firing`;
  }));

  printResults(results);
}

// ---------------------------------------------------------------------------
// Production path — call the canonical extractors
// ---------------------------------------------------------------------------

async function runExtractors(): Promise<void> {
  // Force a fresh env cache read.
  const { __resetEnvCacheForTest } = await import("../lib/config/env");
  __resetEnvCacheForTest();

  const results: TestResult[] = [];

  process.env.AWS_COST_EXPLORER_ENABLED = "true";
  results.push(await timed("Cost Explorer extractor", async () => {
    const { extractAwsCostExplorerSpend } = await import("../lib/billing/awsCostExplorerExtractor");
    const r = await extractAwsCostExplorerSpend();
    if (r.mode !== "live") return `mode=${r.mode}: ${r.limitations.join(" | ")}`;
    return `$${r.confirmedDollarsLast30d.toFixed(2)} last 30d, $${r.confirmedDollarsPrev30d.toFixed(2)} prev 30d, ${r.anomalies.length} anomaly(ies)`;
  }));

  process.env.AWS_ECS_EXTRACT_ENABLED = "true";
  results.push(await timed("ECS extractor", async () => {
    __resetEnvCacheForTest();
    const { extractAwsEcsClusters } = await import("../lib/containers/awsEcsExtractor");
    const r = await extractAwsEcsClusters();
    if (r.mode !== "live") return `mode=${r.mode}: ${r.limitations.join(" | ")}`;
    return `${r.clusters.length} ECS cluster(s), ${r.clusters.reduce((s, c) => s + c.workloads.length, 0)} workload(s)`;
  }));

  process.env.AWS_EKS_EXTRACT_ENABLED = "true";
  results.push(await timed("EKS extractor", async () => {
    __resetEnvCacheForTest();
    const { extractAwsEksClusters } = await import("../lib/containers/awsEksExtractor");
    const r = await extractAwsEksClusters();
    if (r.mode !== "live") return `mode=${r.mode}: ${r.limitations.join(" | ")}`;
    return `${r.clusters.length} EKS cluster(s), ${r.clusters.filter((c) => c.versionEol).length} EOL`;
  }));

  process.env.AWS_CLOUDWATCH_PULL_ENABLED = "true";
  results.push(await timed("CloudWatch extractor", async () => {
    __resetEnvCacheForTest();
    const { extractAwsCloudWatchAlarms } = await import("../lib/telemetry/awsCloudWatchExtractor");
    const r = await extractAwsCloudWatchAlarms();
    if (r.mode !== "live") return `mode=${r.mode}: ${r.limitations.join(" | ")}`;
    const firing = r.signals.filter((s) => s.kind === "alert_firing").length;
    return `${r.signals.length} signal(s), ${firing} firing`;
  }));

  printResults(results);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function timed(name: string, fn: () => Promise<string>): Promise<TestResult> {
  const t0 = Date.now();
  try {
    const summary = await fn();
    return { name, ok: true, summary, durationMs: Date.now() - t0 };
  } catch (err) {
    return { name, ok: false, summary: redact(err instanceof Error ? err.message : String(err)), durationMs: Date.now() - t0 };
  }
}

function printResults(results: TestResult[]): void {
  console.log("");
  let passed = 0;
  for (const r of results) {
    const tag = r.ok ? "✓" : "✗";
    console.log(`${tag}  ${r.name.padEnd(32)} ${r.durationMs.toString().padStart(5)}ms  ${r.summary}`);
    if (r.ok) passed++;
  }
  console.log(`\n${passed}/${results.length} passed.\n`);
  process.exit(passed === results.length ? 0 : 1);
}

function redactAccount(acct: string | undefined): string {
  if (!acct || acct.length < 4) return "[redacted]";
  return `***${acct.slice(-4)}`;
}

function redactArn(arn: string | undefined): string {
  if (!arn) return "[redacted]";
  return arn.replace(/(\d{12})/g, (m) => `***${m.slice(-4)}`);
}

function redact(msg: string): string {
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/(\d{12})/g, (m) => `***${m.slice(-4)}`)
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}

main().catch((err) => {
  console.error("Harness crashed:", redact(err instanceof Error ? err.message : String(err)));
  process.exit(2);
});
