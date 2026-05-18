#!/usr/bin/env node
/**
 * Attaches a minimal read-only inline policy to the test IAM user
 * so the missing extractors (EKS specifically) can list/describe.
 *
 * Requires the user have iam:PutUserPolicy on itself. If not, falls
 * back to printing the policy JSON for manual attachment.
 */

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const credentials = {
  accessKeyId: process.env.AWS_TEST_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_TEST_SECRET_ACCESS_KEY,
};
const region = process.env.AWS_TEST_REGION ?? "us-east-1";

const POLICY_NAME = "AxiomReadOnlyExtractors";
const POLICY = {
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Action: [
      "ce:GetCostAndUsage",
      "ce:GetCostForecast",
      "ce:GetDimensionValues",
      "ecs:ListClusters",
      "ecs:DescribeClusters",
      "ecs:ListServices",
      "ecs:DescribeServices",
      "eks:ListClusters",
      "eks:DescribeCluster",
      "eks:ListNodegroups",
      "eks:DescribeNodegroup",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:ListMetrics",
    ],
    Resource: "*",
  }],
};

const policyJson = JSON.stringify(POLICY, null, 2);

const printManualFallback = (reason) => {
  console.log(`\nCould not auto-attach policy: ${reason}\n`);
  console.log("Paste this manually:");
  console.log("  1. AWS Console → IAM → Users → axiom-test-readonly (or your test user)");
  console.log("  2. Click 'Add permissions' → 'Create inline policy' → 'JSON' tab");
  console.log("  3. Paste the JSON below + Save\n");
  console.log("--- COPY BELOW ---");
  console.log(policyJson);
  console.log("--- COPY ABOVE ---\n");
};

try {
  // 1. Identify which user we are.
  const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
  const sts = new STSClient({ region, credentials });
  const ident = await sts.send(new GetCallerIdentityCommand({}));
  const arn = ident.Arn ?? "";
  // Expect arn:aws:iam::<account>:user/<userName>
  const m = /^arn:aws:iam::\d+:user\/(.+)$/.exec(arn);
  if (!m) {
    printManualFallback(`Caller is not an IAM user (${arn}). Likely an assumed role.`);
    process.exit(2);
  }
  const userName = m[1];
  console.log(`\nAttaching policy "${POLICY_NAME}" to user "${userName}"...`);

  const { IAMClient, PutUserPolicyCommand } = await import("@aws-sdk/client-iam");
  const iam = new IAMClient({ region: "us-east-1", credentials });
  await iam.send(new PutUserPolicyCommand({
    UserName: userName,
    PolicyName: POLICY_NAME,
    PolicyDocument: policyJson,
  }));
  console.log("✓ Policy attached. Re-run scripts/test-aws-quick.mjs to confirm.\n");
} catch (err) {
  printManualFallback(err?.message ?? String(err));
  process.exit(1);
}
