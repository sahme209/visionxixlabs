#!/usr/bin/env node
/**
 * Minimal AWS extractor test harness — runs without tsx/dotenv.
 * Uses only the AWS SDK clients already in node_modules.
 *
 * Reads .env.local manually (just splits on = for AWS_TEST_* keys).
 *
 * Usage:
 *   node scripts/test-aws-quick.mjs
 */

import fs from "node:fs";
import path from "node:path";

// ---- read .env.local manually -----------------------------------------------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const region = process.env.AWS_TEST_REGION ?? "us-east-1";
const credentials = {
  accessKeyId: process.env.AWS_TEST_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_TEST_SECRET_ACCESS_KEY,
};

if (!credentials.accessKeyId || !credentials.secretAccessKey) {
  console.error("Missing AWS_TEST_ACCESS_KEY_ID / AWS_TEST_SECRET_ACCESS_KEY in .env.local");
  process.exit(1);
}

// ---- helpers ----------------------------------------------------------------
const redact = (s) => String(s ?? "")
  .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
  .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
  .replace(/(\d{12})/g, (m) => `***${m.slice(-4)}`)
  .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");

async function timed(name, fn) {
  const t0 = Date.now();
  try {
    const summary = await fn();
    return { name, ok: true, summary, durationMs: Date.now() - t0 };
  } catch (err) {
    return { name, ok: false, summary: redact(err?.message ?? err), durationMs: Date.now() - t0 };
  }
}

// ---- tests ------------------------------------------------------------------
console.log(`\n=== AWS extractor quick test (region: ${region}) ===\n`);

const results = [];

results.push(await timed("STS GetCallerIdentity", async () => {
  const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
  const c = new STSClient({ region, credentials });
  const r = await c.send(new GetCallerIdentityCommand({}));
  return `Account ***${(r.Account ?? "????").slice(-4)} · ARN ${redact(r.Arn)}`;
}));

results.push(await timed("Cost Explorer (last 30d)", async () => {
  const { CostExplorerClient, GetCostAndUsageCommand } = await import("@aws-sdk/client-cost-explorer");
  const c = new CostExplorerClient({ region: "us-east-1", credentials });
  const now = new Date();
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - 30);
  const r = await c.send(new GetCostAndUsageCommand({
    TimePeriod: { Start: start.toISOString().slice(0, 10), End: now.toISOString().slice(0, 10) },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
  }));
  let total = 0;
  for (const row of r.ResultsByTime ?? []) {
    const amt = Number(row.Total?.UnblendedCost?.Amount ?? "0");
    if (Number.isFinite(amt)) total += amt;
  }
  return `$${total.toFixed(2)} unblended`;
}));

results.push(await timed(`ECS ListClusters (${region})`, async () => {
  const { ECSClient, ListClustersCommand } = await import("@aws-sdk/client-ecs");
  const c = new ECSClient({ region, credentials });
  const r = await c.send(new ListClustersCommand({}));
  return `${r.clusterArns?.length ?? 0} cluster(s)`;
}));

results.push(await timed(`EKS ListClusters (${region})`, async () => {
  const { EKSClient, ListClustersCommand } = await import("@aws-sdk/client-eks");
  const c = new EKSClient({ region, credentials });
  const r = await c.send(new ListClustersCommand({}));
  return `${r.clusters?.length ?? 0} cluster(s)`;
}));

results.push(await timed(`CloudWatch DescribeAlarms (${region})`, async () => {
  const { CloudWatchClient, DescribeAlarmsCommand } = await import("@aws-sdk/client-cloudwatch");
  const c = new CloudWatchClient({ region, credentials });
  const r = await c.send(new DescribeAlarmsCommand({ AlarmTypes: ["MetricAlarm"], MaxRecords: 100 }));
  const total = r.MetricAlarms?.length ?? 0;
  const firing = (r.MetricAlarms ?? []).filter((a) => a.StateValue === "ALARM").length;
  return `${total} alarm(s), ${firing} firing`;
}));

// ---- print ------------------------------------------------------------------
let passed = 0;
for (const r of results) {
  const tag = r.ok ? "✓" : "✗";
  console.log(`${tag}  ${r.name.padEnd(36)} ${String(r.durationMs).padStart(5)}ms  ${r.summary}`);
  if (r.ok) passed++;
}
console.log(`\n${passed}/${results.length} passed.\n`);
process.exit(passed === results.length ? 0 : 1);
