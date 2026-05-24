#!/usr/bin/env node
/**
 * One-shot Vercel env-var setup for the visionxixlabs project.
 *
 * Reads token + project id + team id from env. Adds each entry in
 * ENV_VARS via POST /v10/projects/{id}/env (with upsert). Then
 * triggers a redeploy via POST /v13/deployments.
 *
 * Usage:
 *   VERCEL_TOKEN=... VERCEL_PROJECT_ID=... VERCEL_TEAM_ID=... \
 *     node scripts/setup-vercel-env.mjs
 */

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const TEAM = process.env.VERCEL_TEAM_ID;
if (!TOKEN || !PROJECT) {
  console.error("Set VERCEL_TOKEN + VERCEL_PROJECT_ID (and optionally VERCEL_TEAM_ID).");
  process.exit(1);
}

const AWS_KEY    = process.env.AWS_KEY;
const AWS_SECRET = process.env.AWS_SECRET;
if (!AWS_KEY || !AWS_SECRET) {
  console.error("Set AWS_KEY + AWS_SECRET (the broker IAM user credentials).");
  process.exit(1);
}

const ENV_VARS = [
  { key: "AWS_CONNECTOR_BROKER_ACCESS_KEY_ID",     value: AWS_KEY,    type: "encrypted" },
  { key: "AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY", value: AWS_SECRET, type: "encrypted" },
  { key: "AWS_REGION",                              value: "us-east-1", type: "encrypted" },
  { key: "AWS_SCAN_MODE",                           value: "live",      type: "encrypted" },
  { key: "AWS_USE_DIRECT_CREDS",                    value: "true",      type: "encrypted" },
  { key: "AWS_COST_EXPLORER_ENABLED",               value: "true",      type: "encrypted" },
  { key: "AWS_ECS_EXTRACT_ENABLED",                 value: "true",      type: "encrypted" },
  { key: "AWS_EKS_EXTRACT_ENABLED",                 value: "true",      type: "encrypted" },
  { key: "AWS_CLOUDWATCH_PULL_ENABLED",             value: "true",      type: "encrypted" },
];

const base = `https://api.vercel.com/v10/projects/${PROJECT}/env${TEAM ? `?teamId=${TEAM}&upsert=true` : "?upsert=true"}`;

console.log(`Adding ${ENV_VARS.length} env vars to ${PROJECT}...\n`);

let added = 0;
let updated = 0;
let errored = 0;

for (const ev of ENV_VARS) {
  const body = {
    key: ev.key,
    value: ev.value,
    type: ev.type,
    target: ["production", "preview", "development"],
  };
  const res = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`✗ ${ev.key.padEnd(40)} ${res.status} ${data.error?.message ?? ""}`);
    errored++;
  } else {
    const wasUpdate = !!data.updatedAt && data.updatedAt !== data.createdAt;
    console.log(`✓ ${ev.key.padEnd(40)} ${wasUpdate ? "updated" : "added"}`);
    if (wasUpdate) updated++; else added++;
  }
}

console.log(`\nResult: ${added} added · ${updated} updated · ${errored} errored.\n`);

if (errored > 0) {
  process.exit(1);
}

// Trigger redeploy of the latest production deployment.
console.log("Triggering production redeploy...");
const deploysUrl = `https://api.vercel.com/v6/deployments?projectId=${PROJECT}&target=production&limit=1${TEAM ? `&teamId=${TEAM}` : ""}`;
const deploysRes = await fetch(deploysUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
const deploys = await deploysRes.json();
const latest = deploys.deployments?.[0];
if (!latest) {
  console.log("Could not find a previous production deployment to redeploy from. Push a new commit instead.");
  process.exit(0);
}
console.log(`Found previous production deployment: ${latest.uid} (commit ${latest.meta?.githubCommitSha?.slice(0, 7) ?? "n/a"})`);

const redeployUrl = `https://api.vercel.com/v13/deployments${TEAM ? `?teamId=${TEAM}` : ""}`;
const redeployRes = await fetch(redeployUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({
    name: latest.name,
    deploymentId: latest.uid,
    target: "production",
    meta: { source: "axiom-setup-script", redeployReason: "env-var-refresh" },
  }),
});
const redeployData = await redeployRes.json();
if (!redeployRes.ok) {
  console.log(`✗ Redeploy failed: ${redeployRes.status} ${redeployData.error?.message ?? ""}`);
  process.exit(1);
}
console.log(`✓ Redeploy triggered: ${redeployData.url ?? redeployData.id}`);
console.log(`Inspect: https://vercel.com/${TEAM ? "" : ""}deployments/${redeployData.id}`);
