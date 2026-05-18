/**
 * Vercel deployments extractor.
 *
 * Lists recent deployments for the configured project. Maps each
 * to the canonical PipelineRun shape (kind = vercel deployment).
 *
 * Endpoint: GET https://api.vercel.com/v6/deployments?projectId=...&limit=30
 *
 * Hard rules:
 *   - Only runs when VERCEL_DEPLOYMENTS_EXTRACT_ENABLED + VERCEL_TOKEN +
 *     VERCEL_PROJECT_ID set.
 *   - 8s timeout.
 *   - Never triggers / promotes / deletes a deployment.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import type { PipelineRun, PipelineStatus } from "./cicdOpsModel";

const DEFAULT_TIMEOUT_MS = 8_000;
const VERCEL_BASE = "https://api.vercel.com";

export interface VercelDeploymentsExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  runs: PipelineRun[];
  durationMs: number;
  limitations: string[];
}

interface VercelDeployment {
  uid: string;
  name?: string;
  url?: string;
  state?: "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED" | "INITIALIZING";
  readyState?: string;
  type?: string;
  target?: "production" | "staging" | string;
  created?: number;
  buildingAt?: number;
  ready?: number;
  meta?: {
    githubCommitSha?: string;
    githubCommitRef?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
  };
  inspectorUrl?: string;
}

interface VercelDeploymentsResponse {
  deployments?: VercelDeployment[];
}

export async function extractVercelDeployments(): Promise<VercelDeploymentsExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.vercelDeploymentsEnabled) {
    return blocked(start, "VERCEL_DEPLOYMENTS_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const token = env.vercelToken;
  const projectId = env.vercelProjectId;
  if (!token) return blocked(start, "VERCEL_TOKEN required.");
  if (!projectId) return blocked(start, "VERCEL_PROJECT_ID required.");

  const teamQuery = env.vercelTeamId ? `&teamId=${encodeURIComponent(env.vercelTeamId)}` : "";
  const url = `${VERCEL_BASE}/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=30${teamQuery}`;

  let payload: VercelDeploymentsResponse;
  try {
    const res = await withTimeout(
      fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }),
      DEFAULT_TIMEOUT_MS,
      "vercel.list_deployments",
    );
    if (!res.ok) return blocked(start, `Vercel HTTP ${res.status}.`);
    payload = (await res.json()) as VercelDeploymentsResponse;
  } catch (err) {
    return blocked(start, `Vercel pull failed: ${redact(errMessage(err))}`);
  }

  const runs: PipelineRun[] = (payload.deployments ?? []).map((d) => mapDeployment(d));
  return { mode: "live", runs, durationMs: Date.now() - start, limitations: [] };
}

function mapDeployment(d: VercelDeployment): PipelineRun {
  const started = d.buildingAt ?? d.created ?? Date.now();
  const finished = d.ready ?? (d.state === "READY" || d.state === "ERROR" ? Date.now() : undefined);
  return {
    id: d.uid,
    provider: "aws_codepipeline", // closest typed surface; reusing pipeline shape
    repo: d.meta?.githubCommitRef ? `vercel/${d.name ?? "project"}` : `vercel/${d.name ?? "project"}`,
    workflow: d.target === "production" ? "production" : (d.target ?? "preview"),
    branch: d.meta?.githubCommitRef ?? "unknown",
    commit: d.meta?.githubCommitSha?.slice(0, 12) ?? "unknown",
    status: mapStatus(d.state),
    startedAt: new Date(started).toISOString(),
    finishedAt: finished ? new Date(finished).toISOString() : undefined,
    durationMs: finished ? Math.max(0, finished - started) : undefined,
    triggeredBy: d.meta?.githubCommitAuthorName,
    sourceMode: "live",
    externalRunHref: d.inspectorUrl ?? (d.url ? `https://${d.url}` : undefined),
  };
}

function mapStatus(state: VercelDeployment["state"]): PipelineStatus {
  switch (state) {
    case "READY":        return "success";
    case "ERROR":        return "failed";
    case "BUILDING":     return "running";
    case "QUEUED":       return "queued";
    case "CANCELED":     return "canceled";
    case "INITIALIZING": return "queued";
    default:             return "unknown";
  }
}

function blocked(start: number, note: string): VercelDeploymentsExtraction {
  return { mode: "blocked", runs: [], durationMs: Date.now() - start, limitations: [note] };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{20,}/g, "[redacted]");
}
