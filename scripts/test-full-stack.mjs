#!/usr/bin/env node
/**
 * Full-stack production test runner.
 *
 * Hits the live web (visionxixlabs.com) + the canonical API surface
 * (dozens of endpoints) + the AWS extractor surface, and prints a
 * pass/fail report.
 *
 * Run: node scripts/test-full-stack.mjs
 */

import fs from "node:fs";
import path from "node:path";

// Load .env.local for AWS test creds (optional)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE = "https://visionxixlabs.com";
const REGION = process.env.AWS_TEST_REGION ?? "us-east-1";
const CREDS = process.env.AWS_TEST_ACCESS_KEY_ID
  ? { accessKeyId: process.env.AWS_TEST_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_TEST_SECRET_ACCESS_KEY }
  : null;

const PUBLIC_PAGES = [
  "/", "/axiom", "/cloud-solutions", "/services", "/insights",
  "/auth/signin", "/contact", "/pricing",
];

const PUBLIC_APIS = [
  { method: "GET",  path: "/api/auth/session",                   expect: 200 },
];

const AUTH_REQUIRED_APIS = [
  { method: "GET", path: "/api/axiom-os/state",                  expect: 400 },
  { method: "GET", path: "/api/risks/queue",                     expect: 400 },
  { method: "GET", path: "/api/notifications",                   expect: 400 },
  { method: "GET", path: "/api/intelligence/priorities",         expect: 400 },
  { method: "GET", path: "/api/intelligence/next-actions",       expect: 400 },
  { method: "GET", path: "/api/intelligence/executive-summary",  expect: 400 },
  { method: "GET", path: "/api/intelligence/approval-packets",   expect: 400 },
  { method: "GET", path: "/api/intelligence/root-causes",        expect: 400 },
  { method: "GET", path: "/api/onboarding/setup-wizard",         expect: 400 },
  { method: "GET", path: "/api/workspace/state",                 expect: 400 },
  { method: "GET", path: "/api/evidence/library",                expect: 400 },
  { method: "GET", path: "/api/finops/summary",                  expect: 400 },
  { method: "GET", path: "/api/integrations/health",             expect: 400 },
  { method: "GET", path: "/api/scheduled-scans",                 expect: 400 },
  { method: "GET", path: "/api/safety/automation-boundaries",    expect: 400 },
  { method: "GET", path: "/api/operating-graph",                 expect: 400 },
  { method: "GET", path: "/api/billing",                         expect: 400 },
  { method: "GET", path: "/api/telemetry",                       expect: 400 },
  { method: "GET", path: "/api/incidents",                       expect: 400 },
  { method: "GET", path: "/api/containers",                      expect: 400 },
  { method: "GET", path: "/api/cicd",                            expect: 400 },
  { method: "GET", path: "/api/cicd/dora",                       expect: 400 },
  { method: "GET", path: "/api/desktop/intelligence",            expect: 400 },
  { method: "GET", path: "/api/desktop/releases",                expect: 400 },
  { method: "GET", path: "/api/closed-loop",                     expect: 400 },
  { method: "POST", path: "/api/autonomy/cycle", body: {},       expect: 400 },
  { method: "GET", path: "/api/github/deep-posture",             expect: 400 },
];

const OPERATOR_FLOW = [
  { method: "POST", path: "/api/cloud-operator/start", body: { provider: "aws" }, expect: 200 },
];

const CRON_PROTECTED = [
  { method: "GET", path: "/api/autonomy/scheduler", expect: 401 }, // no Bearer → 401
];

const WEBHOOK_PROTECTED = [
  { method: "POST", path: "/api/webhooks/telemetry/grafana", body: {}, expect: 401 },
  { method: "POST", path: "/api/webhooks/incidents/pagerduty", body: {}, expect: 401 },
];

// --------- helpers ---------

const results = [];

async function probe(label, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    results.push({ label, ok: r.ok, detail: r.detail, durationMs: Date.now() - t0 });
  } catch (err) {
    results.push({ label, ok: false, detail: (err?.message ?? String(err)).slice(0, 200), durationMs: Date.now() - t0 });
  }
}

async function httpProbe(method, path, expectedStatus, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  // Some expected codes are "300/200/308" — accept the expected exactly, or 2xx/3xx for pages
  const ok = expectedStatus
    ? res.status === expectedStatus
    : (res.status >= 200 && res.status < 400);
  return { ok, detail: `HTTP ${res.status}${ok ? "" : ` (expected ${expectedStatus})`}` };
}

// --------- run ---------

console.log(`\n=== Full-stack test against ${BASE} ===\n`);

// 1. Public pages
console.log("// public pages");
for (const p of PUBLIC_PAGES) {
  await probe(`PAGE ${p}`, () => httpProbe("GET", p, null));
}

// 2. Public APIs
console.log("\n// public APIs");
for (const a of PUBLIC_APIS) {
  await probe(`${a.method} ${a.path}`, () => httpProbe(a.method, a.path, a.expect, a.body));
}

// 3. Auth-required APIs (should all return 400 auth.required when unauthenticated)
console.log("\n// auth-required APIs (expecting 400 auth.required when unauthenticated — that means the endpoint is alive)");
for (const a of AUTH_REQUIRED_APIS) {
  await probe(`${a.method} ${a.path}`, () => httpProbe(a.method, a.path, a.expect, a.body));
}

// 4. Operator flow
console.log("\n// operator onboarding flow");
for (const a of OPERATOR_FLOW) {
  await probe(`${a.method} ${a.path}`, () => httpProbe(a.method, a.path, a.expect, a.body));
}

// 5. Cron protected
console.log("\n// cron-protected (no Bearer = 401)");
for (const a of CRON_PROTECTED) {
  await probe(`${a.method} ${a.path}`, () => httpProbe(a.method, a.path, a.expect, a.body));
}

// 6. Webhook protected
console.log("\n// webhook-protected (no signature = 401)");
for (const a of WEBHOOK_PROTECTED) {
  await probe(`${a.method} ${a.path}`, () => httpProbe(a.method, a.path, a.expect, a.body));
}

// 7. Direct AWS extractors (skips if no creds in .env.local)
if (CREDS) {
  console.log("\n// AWS SDK extractors (direct)");
  await probe("AWS STS GetCallerIdentity", async () => {
    const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
    const c = new STSClient({ region: REGION, credentials: CREDS });
    const r = await c.send(new GetCallerIdentityCommand({}));
    return { ok: !!r.Arn, detail: `Account ***${(r.Account ?? "").slice(-4)}` };
  });
  await probe("AWS Cost Explorer (30d)", async () => {
    const { CostExplorerClient, GetCostAndUsageCommand } = await import("@aws-sdk/client-cost-explorer");
    const c = new CostExplorerClient({ region: "us-east-1", credentials: CREDS });
    const now = new Date(); const s = new Date(now); s.setUTCDate(s.getUTCDate() - 30);
    try {
      const r = await c.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: s.toISOString().slice(0, 10), End: now.toISOString().slice(0, 10) },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      }));
      let total = 0;
      for (const row of r.ResultsByTime ?? []) total += Number(row.Total?.UnblendedCost?.Amount ?? "0");
      return { ok: true, detail: `$${total.toFixed(2)} last 30d` };
    } catch (err) {
      return { ok: false, detail: (err?.message ?? "err").slice(0, 80) };
    }
  });
  await probe(`AWS ECS ListClusters (${REGION})`, async () => {
    const { ECSClient, ListClustersCommand } = await import("@aws-sdk/client-ecs");
    const c = new ECSClient({ region: REGION, credentials: CREDS });
    const r = await c.send(new ListClustersCommand({}));
    return { ok: true, detail: `${r.clusterArns?.length ?? 0} cluster(s)` };
  });
  await probe(`AWS EKS ListClusters (${REGION})`, async () => {
    const { EKSClient, ListClustersCommand } = await import("@aws-sdk/client-eks");
    const c = new EKSClient({ region: REGION, credentials: CREDS });
    const r = await c.send(new ListClustersCommand({}));
    return { ok: true, detail: `${r.clusters?.length ?? 0} cluster(s)` };
  });
  await probe(`AWS CloudWatch DescribeAlarms (${REGION})`, async () => {
    const { CloudWatchClient, DescribeAlarmsCommand } = await import("@aws-sdk/client-cloudwatch");
    const c = new CloudWatchClient({ region: REGION, credentials: CREDS });
    const r = await c.send(new DescribeAlarmsCommand({ AlarmTypes: ["MetricAlarm"], MaxRecords: 100 }));
    const total = r.MetricAlarms?.length ?? 0;
    const firing = (r.MetricAlarms ?? []).filter((a) => a.StateValue === "ALARM").length;
    return { ok: true, detail: `${total} alarm(s), ${firing} firing` };
  });
}

// --------- print ---------

console.log("\n");
let passed = 0;
let failed = 0;
const failedList = [];
for (const r of results) {
  const tag = r.ok ? "✓" : "✗";
  console.log(`${tag}  ${r.label.padEnd(48)} ${String(r.durationMs).padStart(5)}ms  ${r.detail ?? ""}`);
  if (r.ok) passed++;
  else { failed++; failedList.push(r); }
}

console.log(`\n${passed}/${results.length} passed · ${failed} failed.\n`);
if (failed > 0) {
  console.log("Failed checks:");
  for (const r of failedList) console.log(`  ✗ ${r.label} — ${r.detail}`);
  console.log("");
}
process.exit(failed === 0 ? 0 : 1);
