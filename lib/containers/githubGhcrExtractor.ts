/**
 * GitHub Container Registry (GHCR) image inventory extractor.
 *
 * Pulls every container package in a GitHub org via the Packages
 * REST API. Each package becomes a typed ContainerWorkload (kind =
 * "deployment" since GHCR packages are images, not running pods)
 * inside a synthetic "GHCR · {org}" ContainerCluster.
 *
 * Endpoints:
 *   GET /orgs/{org}/packages?package_type=container&per_page=100
 *   GET /orgs/{org}/packages/container/{pkg}/versions?per_page=10
 *     (only when GHCR_DEEP_INSPECT=true — versions cost extra calls)
 *
 * Hard rules:
 *   - Only runs when GitHub mode = live + GHCR_EXTRACT_ENABLED.
 *   - GHCR_ORG must be set (no auto-discovery across all viewer orgs).
 *   - 8s per-call timeout. Cap 100 packages.
 *   - Detects `latest` floating tags → outdated_image_tag risk flag.
 */

import "server-only";

import { createGithubClient } from "@/lib/connectors/github/githubLiveClient";
import { loadAppEnv } from "@/lib/config/env";
import type {
  ContainerCluster,
  ContainerWorkload,
  WorkloadRiskFlag,
} from "./containerOrchestrationModel";

export interface GhcrExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  cluster: ContainerCluster | null;
  durationMs: number;
  limitations: string[];
}

interface GhPackage {
  id: number;
  name: string;
  package_type: string;
  visibility?: "public" | "private" | "internal";
  url?: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  version_count?: number;
}

interface GhVersion {
  id: number;
  name: string;
  metadata?: {
    container?: { tags?: string[] };
  };
  created_at?: string;
}

export async function extractGhcrImages(): Promise<GhcrExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.ghcrExtractEnabled) {
    return blocked(start, "GHCR_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  if (env.githubSyncMode !== "live") {
    return preview(start, "GitHub mode is not live — extractor returned honest preview.");
  }
  const org = env.ghcrOrg;
  if (!org) {
    return blocked(start, "GHCR_ORG is required (organisation slug to scan).");
  }
  const client = createGithubClient();
  if (!client.available) {
    return blocked(start, "GitHub client unavailable — neither GITHUB_PAT nor GITHUB_APP_* configured.");
  }

  const res = await client.get<GhPackage[]>(`/orgs/${encodeURIComponent(org)}/packages?package_type=container&per_page=100`);
  if (!res.ok) {
    return blocked(start, `GHCR list failed: ${res.errorKind} ${res.errorMessage ?? ""}`.trim());
  }
  const packages = res.data ?? [];

  const limitations: string[] = [];
  const workloads: ContainerWorkload[] = [];

  for (const pkg of packages) {
    const risks: WorkloadRiskFlag[] = [];
    let imageTag: string | undefined;

    if (env.ghcrDeepInspect) {
      const verRes = await client.get<GhVersion[]>(
        `/orgs/${encodeURIComponent(org)}/packages/container/${encodeURIComponent(pkg.name)}/versions?per_page=10`,
      );
      if (verRes.ok && verRes.data) {
        const latest = verRes.data[0];
        const tags = latest?.metadata?.container?.tags ?? [];
        if (tags.length > 0) imageTag = tags[0];
        if (tags.some((t) => t === "latest" || t === "main" || t === "master")) {
          risks.push("outdated_image_tag");
        }
      } else if (!verRes.ok) {
        limitations.push(`${pkg.name} versions fetch failed: ${verRes.errorKind}`);
      }
    }

    if (pkg.visibility === "public") {
      // Public images aren't inherently risky, but the operator should
      // know — surface as info via a separate annotation rather than a
      // risk flag (no flag exists for "visible_publicly" and we never
      // invent one).
    }

    workloads.push({
      id: `ghcr:${org}/${pkg.name}`,
      name: pkg.name,
      kind: "deployment",
      replicas: pkg.version_count,
      image: imageTag ? `ghcr.io/${org}/${pkg.name}:${imageTag}` : `ghcr.io/${org}/${pkg.name}`,
      imageDigestPinned: false,
      riskFlags: risks,
      summary: `GHCR · ${pkg.visibility ?? "unknown"} · ${pkg.version_count ?? 0} version(s)`,
      evidenceRef: pkg.html_url ?? `ghcr:${org}/${pkg.name}`,
    });
  }

  if (workloads.length === 0) {
    return {
      mode: "live",
      cluster: null,
      durationMs: Date.now() - start,
      limitations: [`No container packages in org ${org}.`, ...limitations],
    };
  }

  const cluster: ContainerCluster = {
    id: `ghcr:${org}`,
    provider: "github_ghcr",
    name: `GHCR · ${org}`,
    region: "global",
    versionEol: false,
    status: "healthy",
    sourceMode: "live",
    nodePoolCount: 0,
    nodeCount: 0,
    autoscalerEnabled: false,
    podCount: 0,
    workloadCount: workloads.length,
    publicEndpointsCount: workloads.filter((_, i) => packages[i]?.visibility === "public").length,
    networkExposure: "internet_routable",
    secretsPosture: "unknown",
    workloads,
    limitations: env.ghcrDeepInspect ? limitations : [
      ...limitations,
      "Set GHCR_DEEP_INSPECT=true to enumerate per-package versions + tags (extra API calls per package).",
    ],
    safeNextAction: { label: "Open GitHub setup", href: "/dashboard/integrations/github" },
    externalConsoleHref: `https://github.com/orgs/${encodeURIComponent(org)}/packages?ecosystem=container`,
  };

  return {
    mode: "live",
    cluster,
    durationMs: Date.now() - start,
    limitations,
  };
}

function preview(start: number, note: string): GhcrExtraction {
  return { mode: "preview", cluster: null, durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): GhcrExtraction {
  return { mode: "blocked", cluster: null, durationMs: Date.now() - start, limitations: [note] };
}
