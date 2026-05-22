/**
 * GET /api/admin/agi-smoke-test — admin only.
 *
 * Exercises the full platform end-to-end with REAL connectors:
 *  1. AWS — S3 ListBuckets via broker creds.
 *  2. GCP — Storage list-buckets via SA.
 *  3. Azure — resourceGroups.list via SP.
 *  4. GitHub — recent repos via PAT.
 *  5. Anthropic — given the four read summaries above, ask Claude to
 *     draft a 4-line "first-day situation report" for the operator.
 *
 * Returns everything in one envelope so we can see in one shot which
 * legs are live and what the AI says about the real-data context.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import { ClientSecretCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { resolveAwsCredentials } from "@/lib/cloud/aws/awsCredentialResolver";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LegResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

async function awsLeg(): Promise<LegResult> {
  try {
    const r = await resolveAwsCredentials({ sessionLabel: "smoke" });
    if (r.mode === "blocked") return { ok: false, summary: `AWS blocked: ${r.reason}` };
    const s3 = new S3Client({ region: r.region, credentials: r.credentials });
    const out = await s3.send(new ListBucketsCommand({}));
    const count = out.Buckets?.length ?? 0;
    const names = (out.Buckets ?? []).slice(0, 3).map((b) => b.Name ?? "?");
    return {
      ok: true,
      summary: `AWS account reachable · ${count} S3 buckets` + (names.length ? ` (e.g. ${names.join(", ")})` : ""),
      detail: { region: r.region, bucketCount: count, sampleBuckets: names },
    };
  } catch (err) {
    return { ok: false, summary: `AWS error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function gcpLeg(): Promise<LegResult> {
  try {
    const projectId = process.env.GCP_PROJECT_ID?.trim();
    const rawJson = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
    if (!projectId || !rawJson) return { ok: false, summary: "GCP env not set." };
    const sa = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
    const storage = new Storage({
      projectId,
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
    });
    const [buckets] = await storage.getBuckets();
    const names = buckets.slice(0, 3).map((b) => b.name ?? "?");
    return {
      ok: true,
      summary: `GCP project ${projectId} · ${buckets.length} GCS buckets` + (names.length ? ` (e.g. ${names.join(", ")})` : ""),
      detail: { projectId, bucketCount: buckets.length, sampleBuckets: names },
    };
  } catch (err) {
    return { ok: false, summary: `GCP error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function azureLeg(): Promise<LegResult> {
  try {
    const tenantId = process.env.AZURE_TENANT_ID?.trim();
    const clientId = process.env.AZURE_CLIENT_ID?.trim();
    const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID?.trim();
    if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
      return { ok: false, summary: "Azure env not set." };
    }
    const cred = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const client = new ResourceManagementClient(cred, subscriptionId);
    const groups: { name?: string; location?: string }[] = [];
    for await (const g of client.resourceGroups.list()) {
      groups.push({ name: g.name, location: g.location });
      if (groups.length >= 5) break;
    }
    const names = groups.map((g) => g.name ?? "?");
    return {
      ok: true,
      summary: `Azure subscription reachable · ${groups.length} resource groups` + (names.length ? ` (e.g. ${names.join(", ")})` : ""),
      detail: { subscriptionId, groupCount: groups.length, sampleGroups: names },
    };
  } catch (err) {
    return { ok: false, summary: `Azure error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function githubLeg(): Promise<LegResult> {
  try {
    const token = (process.env.GITHUB_PAT ?? process.env.GITHUB_TOKEN ?? "").trim();
    if (!token) return { ok: false, summary: "GitHub PAT not set." };
    const headers = {
      Authorization: `Bearer ${token}`,
      "User-Agent": "visionxixlabs-smoke-test",
      Accept: "application/vnd.github+json",
    };
    const meRes = await fetch("https://api.github.com/user", { headers });
    const me = await meRes.json() as { login?: string };
    const repoRes = await fetch("https://api.github.com/user/repos?per_page=5&sort=updated", { headers });
    const repos = await repoRes.json() as Array<{ full_name?: string; updated_at?: string }>;
    const names = repos.slice(0, 3).map((r) => r.full_name ?? "?");
    return {
      ok: true,
      summary: `GitHub user ${me.login ?? "?"} · ${repos.length} recent repos` + (names.length ? ` (e.g. ${names.join(", ")})` : ""),
      detail: { handle: me.login, repoCount: repos.length, sampleRepos: names },
    };
  } catch (err) {
    return { ok: false, summary: `GitHub error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function aiSitrep(awsR: LegResult, gcpR: LegResult, azR: LegResult, ghR: LegResult): Promise<{ ok: boolean; report: string; usage?: unknown; reason?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, report: "", reason: "ANTHROPIC_API_KEY not set." };
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const context = [
      `AWS: ${awsR.summary}`,
      `GCP: ${gcpR.summary}`,
      `Azure: ${azR.summary}`,
      `GitHub: ${ghR.summary}`,
    ].join("\n");
    const prompt = `You are an AI ops engineer. Below are real read-only observations of an operator's connected accounts. Write a 4-line situation report (one line per surface) that calls out anything worth investigating, and end with one concrete next step. Be terse, no hedging, no greetings.\n\n${context}`;
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && "text" in block ? block.text : "";
    return {
      ok: true,
      report: text,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (err) {
    return { ok: false, report: "", reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const startedAt = Date.now();
  const [aws, gcp, azure, github] = await Promise.all([awsLeg(), gcpLeg(), azureLeg(), githubLeg()]);
  const ai = await aiSitrep(aws, gcp, azure, github);
  const durationMs = Date.now() - startedAt;

  const legsOk = [aws.ok, gcp.ok, azure.ok, github.ok, ai.ok];
  const allOk = legsOk.every(Boolean);

  return NextResponse.json({
    ok: allOk,
    durationMs,
    legs: {
      aws,
      gcp,
      azure,
      github,
      ai,
    },
    legsSummary: {
      total: legsOk.length,
      passing: legsOk.filter(Boolean).length,
    },
  });
}
