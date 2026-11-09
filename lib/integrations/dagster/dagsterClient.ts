import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";

/**
 * Dagster read-only inventory client (A8, second new Batches provider).
 *
 * Observation only: every request sends one of the fixed GraphQL *queries*
 * below. No mutation (launch, re-execute, terminate, wipe, sensor or schedule
 * toggle) exists here, and callers cannot pass their own GraphQL text.
 * Never returns logs, run config, asset materialisation values or credentials.
 * Asset-check results are evidence, not execution authority.
 */

export type DagsterCredential = { authMode: "api_token"; token: string };
export interface DagsterJob { location: string; repository: string; name: string; description: string | null }
export interface DagsterRun { runId: string; jobName: string; status: string; startedAt: string | null; endedAt: string | null }

export const DAGSTER_PAGE_LIMIT = 50;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,199}$/;
const STATUSES = new Set(["QUEUED", "NOT_STARTED", "MANAGED", "STARTING", "STARTED", "SUCCESS", "FAILURE", "CANCELING", "CANCELED"]);

export const DAGSTER_QUERIES = Object.freeze({
  jobs: "query AxiomJobs { repositoriesOrError { __typename ... on RepositoryConnection { nodes { name location { name } jobs { name description isJob } } } } }",
  runs: "query AxiomRuns($filter: RunsFilter, $limit: Int) { runsOrError(filter: $filter, limit: $limit) { __typename ... on Runs { results { runId jobName status startTime endTime } } } }",
});

/** Dagster+ (`https://<org>.dagster.cloud/<deployment>`) or self-hosted root / one path segment. Public HTTPS only. */
export async function validateDagsterBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("dagster_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("dagster_https_url_required");
  const raw = value.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
  if (!raw || !/^(?:\/|\/[A-Za-z0-9_-]+\/?)?$/.test(raw[1]) || /^\/graphql\/?$/i.test(raw[1])) throw new Error("dagster_base_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("dagster_private_host_blocked");
  const allowlist = (process.env.DAGSTER_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(hostname)) throw new Error("dagster_host_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("dagster_private_host_blocked");
  return `${url.origin}${raw[1].replace(/\/$/, "")}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const seconds = (v: unknown): string | null => (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e11 ? new Date(v * 1000).toISOString() : null);

export class DagsterClient {
  constructor(private readonly baseUrl: string, private readonly credential: DagsterCredential) {}

  private async query(name: keyof typeof DAGSTER_QUERIES, variables: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", "content-type": "application/json", "Dagster-Cloud-Api-Token": this.credential.token },
      body: JSON.stringify({ query: DAGSTER_QUERIES[name], variables }),
    });
    if (!response.ok) throw new Error(`dagster_api_failed:${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || body.errors !== undefined || !isRecord(body.data)) throw new Error("dagster_response_invalid");
    return body.data;
  }

  async listJobs(): Promise<DagsterJob[]> {
    const data = await this.query("jobs");
    const result = data.repositoriesOrError;
    if (!isRecord(result) || result.__typename !== "RepositoryConnection" || !Array.isArray(result.nodes)) throw new Error("dagster_job_response_invalid");
    const jobs: DagsterJob[] = [];
    const seen = new Set<string>();
    for (const repo of result.nodes) {
      if (!isRecord(repo) || typeof repo.name !== "string" || !isRecord(repo.location) || typeof repo.location.name !== "string" || !Array.isArray(repo.jobs)) throw new Error("dagster_job_response_invalid");
      for (const job of repo.jobs) {
        if (!isRecord(job) || typeof job.name !== "string" || !NAME.test(job.name)) throw new Error("dagster_job_response_invalid");
        if (job.isJob === false || job.name.startsWith("__ASSET_JOB")) continue; // legacy pipelines and implicit asset jobs
        const key = `${repo.location.name}/${repo.name}/${job.name}`;
        if (seen.has(key)) throw new Error("dagster_job_response_invalid");
        seen.add(key);
        jobs.push({ location: repo.location.name.slice(0, 200), repository: repo.name.slice(0, 200), name: job.name, description: typeof job.description === "string" ? job.description.slice(0, 300) : null });
        if (jobs.length >= DAGSTER_PAGE_LIMIT) return jobs;
      }
    }
    return jobs;
  }

  async listRuns(jobName: string): Promise<DagsterRun[]> {
    if (!NAME.test(jobName)) throw new Error("dagster_selection_invalid");
    const data = await this.query("runs", { filter: { pipelineName: jobName }, limit: DAGSTER_PAGE_LIMIT });
    const result = data.runsOrError;
    if (!isRecord(result) || result.__typename !== "Runs" || !Array.isArray(result.results) || result.results.length > DAGSTER_PAGE_LIMIT) throw new Error("dagster_run_response_invalid");
    const ids = new Set<string>();
    return result.results.map((run): DagsterRun => {
      // A run for another job means the filter was not honoured: refuse the whole page.
      if (!isRecord(run) || typeof run.runId !== "string" || !RUN_ID.test(run.runId) || ids.has(run.runId) || run.jobName !== jobName) throw new Error("dagster_run_response_invalid");
      ids.add(run.runId);
      return { runId: run.runId, jobName, status: typeof run.status === "string" && STATUSES.has(run.status) ? run.status : "UNKNOWN", startedAt: seconds(run.startTime), endedAt: seconds(run.endTime) };
    });
  }
}
