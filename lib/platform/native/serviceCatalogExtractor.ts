/**
 * Service catalog auto-discovery extractor.
 *
 * Walks the connected accounts (AWS, GCP, GitHub) and produces a typed
 * `ServiceCatalogView` of services + environments + dependencies that
 * the engineer workspace can render. No persistence yet — this is a
 * pure read across the connectors that are already validated tonight.
 *
 * Discovery heuristics (kept honest):
 *   - AWS S3 bucket             → kind: "static_asset"
 *   - GCP GCS bucket            → kind: "static_asset"
 *   - GitHub repo               → kind: "api" candidate (will refine
 *                                  when workflow + Dockerfile detection
 *                                  lands)
 *
 * No fabricated services. If a connector is missing creds or returns
 * empty, that connector's slice is empty in the catalog — never faked.
 */

import "server-only";

import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import { resolveAwsCredentials } from "@/lib/cloud/aws/awsCredentialResolver";
import type { ServiceRef, ServiceEnvironment, ServiceCatalogView } from "./serviceCatalog";
import type { OrganizationId } from "@/lib/domain/ids";

interface ExtractInput {
  organizationId: OrganizationId;
}

export interface ExtractResult {
  catalog: ServiceCatalogView;
  perConnector: {
    aws:    { ok: boolean; count: number; reason?: string };
    gcp:    { ok: boolean; count: number; reason?: string };
    github: { ok: boolean; count: number; reason?: string };
  };
  durationMs: number;
}

export async function extractServiceCatalog(input: ExtractInput): Promise<ExtractResult> {
  const startedAt = Date.now();
  const services: ServiceRef[] = [];
  const environments: ServiceEnvironment[] = [];

  const [awsResult, gcpResult, githubResult] = await Promise.all([
    extractAws(input.organizationId, services, environments),
    extractGcp(input.organizationId, services, environments),
    extractGithub(input.organizationId, services, environments),
  ]);

  return {
    catalog: { services, environments, dependencies: [], health: {} },
    perConnector: { aws: awsResult, gcp: gcpResult, github: githubResult },
    durationMs: Date.now() - startedAt,
  };
}

async function extractAws(orgId: OrganizationId, services: ServiceRef[], envs: ServiceEnvironment[]): Promise<ExtractResult["perConnector"]["aws"]> {
  try {
    const resolved = await resolveAwsCredentials({ sessionLabel: "service-catalog-extract" });
    if (resolved.mode === "blocked") return { ok: false, count: 0, reason: resolved.reason };
    const s3 = new S3Client({ region: resolved.region, credentials: resolved.credentials });
    const out = await s3.send(new ListBucketsCommand({}));
    let count = 0;
    for (const b of out.Buckets ?? []) {
      if (!b.Name) continue;
      const id = `aws_s3_${b.Name}`;
      services.push({
        organizationId: orgId,
        id,
        name: b.Name,
        kind: "static_asset",
        tier: "tier_3_internal",
        discoveredFrom: ["aws"],
        tags: ["aws", "s3"],
        createdAt: b.CreationDate?.toISOString() ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      envs.push({
        organizationId: orgId,
        id: `${id}_env_prod`,
        serviceId: id,
        kind: "production",
        externalRef: `arn:aws:s3:::${b.Name}`,
        region: resolved.region,
      });
      count++;
    }
    return { ok: true, count };
  } catch (err) {
    return { ok: false, count: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function extractGcp(orgId: OrganizationId, services: ServiceRef[], envs: ServiceEnvironment[]): Promise<ExtractResult["perConnector"]["gcp"]> {
  try {
    const projectId = process.env.GCP_PROJECT_ID?.trim();
    const rawJson = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
    if (!projectId || !rawJson) return { ok: false, count: 0, reason: "GCP env not set." };
    const sa = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
    const storage = new Storage({
      projectId,
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
    });
    const [buckets] = await storage.getBuckets();
    let count = 0;
    for (const b of buckets) {
      if (!b.name) continue;
      const id = `gcp_gcs_${b.name}`;
      services.push({
        organizationId: orgId,
        id,
        name: b.name,
        kind: "static_asset",
        tier: "tier_3_internal",
        discoveredFrom: ["gcp"],
        tags: ["gcp", "gcs", projectId],
        createdAt: typeof b.metadata?.timeCreated === "string" ? b.metadata.timeCreated : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      envs.push({
        organizationId: orgId,
        id: `${id}_env_prod`,
        serviceId: id,
        kind: "production",
        externalRef: `gs://${b.name}`,
        region: typeof b.metadata?.location === "string" ? b.metadata.location : undefined,
      });
      count++;
    }
    return { ok: true, count };
  } catch (err) {
    return { ok: false, count: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function extractGithub(orgId: OrganizationId, services: ServiceRef[], envs: ServiceEnvironment[]): Promise<ExtractResult["perConnector"]["github"]> {
  try {
    const token = (process.env.GITHUB_PAT ?? process.env.GITHUB_TOKEN ?? "").trim();
    if (!token) return { ok: false, count: 0, reason: "GitHub PAT not set." };
    const headers = {
      Authorization: `Bearer ${token}`,
      "User-Agent": "visionxixlabs-service-catalog",
      Accept: "application/vnd.github+json",
    };
    const res = await fetch("https://api.github.com/user/repos?per_page=30&sort=updated", { headers });
    if (!res.ok) return { ok: false, count: 0, reason: `GitHub HTTP ${res.status}` };
    const repos = (await res.json()) as Array<{ full_name?: string; private?: boolean; updated_at?: string; created_at?: string; topics?: string[]; html_url?: string; archived?: boolean }>;
    let count = 0;
    for (const r of repos) {
      if (!r.full_name || r.archived) continue;
      const id = `github_${r.full_name.replace(/\//g, "__")}`;
      services.push({
        organizationId: orgId,
        id,
        name: r.full_name,
        kind: "api",
        tier: "tier_3_internal",
        discoveredFrom: ["github"],
        tags: ["github", ...(r.topics ?? [])],
        createdAt: r.created_at ?? new Date().toISOString(),
        updatedAt: r.updated_at ?? new Date().toISOString(),
      });
      envs.push({
        organizationId: orgId,
        id: `${id}_env_main`,
        serviceId: id,
        kind: "production",
        externalRef: r.html_url ?? `https://github.com/${r.full_name}`,
      });
      count++;
    }
    return { ok: true, count };
  } catch (err) {
    return { ok: false, count: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}
