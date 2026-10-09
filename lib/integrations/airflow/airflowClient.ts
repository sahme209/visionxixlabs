import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type AirflowCredential =
  | { authMode: "username_password"; username: string; password: string }
  | { authMode: "token"; token: string };

export interface AirflowDag {
  dagId: string;
  displayName: string;
  description: string | null;
  paused: boolean;
  owners: string[];
  tags: string[];
}

export interface AirflowDagRun {
  dagId: string;
  dagRunId: string;
  state: string;
  logicalDate: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

function unsafeAddress(address: string): boolean {
  if (address === "::" || address === "::1") return true;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

/** Validates the user-controlled Airflow origin before every connection save. */
export async function validateAirflowBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("airflow_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("airflow_https_url_required");
  if (url.pathname !== "/" && url.pathname !== "") throw new Error("airflow_origin_only_required");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("airflow_private_host_blocked");
  const allowlist = (process.env.AIRFLOW_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(hostname)) throw new Error("airflow_host_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("airflow_private_host_blocked");
  return `${url.origin}`;
}

export class AirflowClient {
  constructor(private readonly baseUrl: string, private readonly credential: AirflowCredential) {}

  private async authorization(): Promise<string> {
    if (this.credential.authMode === "token") return `Bearer ${this.credential.token}`;
    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username: this.credential.username, password: this.credential.password }),
    });
    if (!response.ok) throw new Error(`airflow_auth_failed:${response.status}`);
    const body = await response.json() as { access_token?: unknown };
    if (typeof body.access_token !== "string" || !body.access_token) throw new Error("airflow_auth_response_invalid");
    return `Bearer ${body.access_token}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/v2${path}`, {
      ...init,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", authorization: await this.authorization(), ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    });
    if (!response.ok) throw new Error(`airflow_api_failed:${response.status}`);
    return response.json();
  }

  async validate(): Promise<{ version: string | null; dagCount: number }> {
    const [version, dags] = await Promise.all([this.request("/version"), this.request("/dags?limit=1")]);
    const versionBody = version as { version?: unknown };
    const dagBody = dags as { total_entries?: unknown; dags?: unknown[] };
    return { version: typeof versionBody.version === "string" ? versionBody.version : null, dagCount: typeof dagBody.total_entries === "number" ? dagBody.total_entries : (dagBody.dags?.length ?? 0) };
  }

  async listDags(): Promise<AirflowDag[]> {
    const body = await this.request("/dags?limit=500&order_by=dag_id") as { dags?: Array<Record<string, unknown>> };
    return (body.dags ?? []).map((dag) => ({
      dagId: String(dag.dag_id ?? ""),
      displayName: String(dag.display_name ?? dag.dag_id ?? ""),
      description: typeof dag.description === "string" ? dag.description : null,
      paused: dag.is_paused === true,
      owners: Array.isArray(dag.owners) ? dag.owners.filter((item): item is string => typeof item === "string") : [],
      tags: Array.isArray(dag.tags) ? dag.tags.map((item) => typeof item === "string" ? item : String((item as { name?: unknown })?.name ?? "")).filter(Boolean) : [],
    })).filter((dag) => dag.dagId);
  }

  async listDagRuns(dagId: string, limit = 50): Promise<AirflowDagRun[]> {
    const body = await this.request(`/dags/${encodeURIComponent(dagId)}/dagRuns?limit=${Math.min(100, Math.max(1, limit))}&order_by=-logical_date`) as { dag_runs?: Array<Record<string, unknown>> };
    return (body.dag_runs ?? []).map((run) => ({
      dagId: String(run.dag_id ?? dagId), dagRunId: String(run.dag_run_id ?? ""), state: String(run.state ?? "unknown"),
      logicalDate: typeof run.logical_date === "string" ? run.logical_date : null,
      startedAt: typeof run.start_date === "string" ? run.start_date : null,
      endedAt: typeof run.end_date === "string" ? run.end_date : null,
    })).filter((run) => run.dagRunId);
  }

  async triggerDag(dagId: string, conf: Record<string, unknown> = {}): Promise<AirflowDagRun> {
    const runId = `axiom__${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
    const body = await this.request(`/dags/${encodeURIComponent(dagId)}/dagRuns`, { method: "POST", body: JSON.stringify({ dag_run_id: runId, logical_date: null, conf, note: "Triggered by Axiom Agent" }) }) as Record<string, unknown>;
    return { dagId, dagRunId: String(body.dag_run_id ?? runId), state: String(body.state ?? "queued"), logicalDate: typeof body.logical_date === "string" ? body.logical_date : null, startedAt: typeof body.start_date === "string" ? body.start_date : null, endedAt: typeof body.end_date === "string" ? body.end_date : null };
  }
}
